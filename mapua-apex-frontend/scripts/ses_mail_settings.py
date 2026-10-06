"""Gather the SES-backed MAIL_* settings (see `.env.example` lines 65-72) with boto3.

Those eight environment variables are just a local mail transport stub. On AWS
they map onto Amazon SES:

    MAIL_MAILER         -> "ses"
    MAIL_SCHEME         -> "ssl" (port 465) or "tls" (port 587 STARTTLS)
    MAIL_HOST           -> SES SMTP endpoint, "email-smtp.<region>.amazonaws.com"
    MAIL_PORT           -> 465 (SSL) / 587 or 2587 (STARTTLS)
    MAIL_USERNAME       -> SES SMTP user name   (= the IAM access key id)
    MAIL_PASSWORD       -> SES SMTP password     (SigV4-derived from the secret key)
    MAIL_FROM_ADDRESS   -> a *verified* SES email identity
    MAIL_FROM_NAME      -> the app display name (not an AWS value; pass with --from-name)

The SMTP user name / password are not stored anywhere - AWS derives them from
an IAM access key with a fixed Signature V4 recipe (see `derive_smtp_credentials`).
Because that recipe needs the *secret access key*, it only produces credentials
that SES will accept when the session is backed by long-lived IAM keys. With
temporary STS credentials (instance role / SSO / assume-role) the derived
password is rejected by SMTP; use `aws ses create-access-key`-style permanent
keys or the SES console "Connect > SMTP Settings > Create SMTP credentials".

IMPORTANT for this repo: the backend sends mail through the SES *API*
(`App\\Support\\Email\\SesEmailSender` -> `SesClient::sendEmail`), not SMTP, so
at runtime it only reads `MAIL_FROM_ADDRESS`. The full SMTP set above is what
you would need if the transport were switched to the SES SMTP interface.

The password is masked in the printed output unless `--reveal` is passed, and
nothing is written to any `.env` file.

Examples:

    # What would go in .env (password masked), using the active AWS profile:
    python scripts/ses_mail_settings.py --region ap-southeast-1

    # Pick a specific verified identity and the STARTTLS port:
    python scripts/ses_mail_settings.py --port 587 --from-address ops@mapua.edu.ph

    # Machine-readable:
    python scripts/ses_mail_settings.py --json

    from ses_mail_settings import gather_mail_settings
    settings = gather_mail_settings(port=465, reveal=True)
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

# SES region: mirrors config/aws.php ('ses' -> AWS_SES_REGION -> AWS_DEFAULT_REGION).
# Default ap-southeast-1, where the project's AWS resources actually live.
AWS_REGION = os.environ.get(
    "AWS_SES_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)

# SMTP port -> (Laravel MAIL_SCHEME, human label). 2587 is STARTTLS on a
# non-standard port for networks that block 587.
_PORT_SCHEMES = {465: "ssl", 587: "tls", 2587: "tls"}


def smtp_host(region: str) -> str:
    """Return the SES SMTP endpoint hostname for a region."""
    return f"email-smtp.{region}.amazonaws.com"


def derive_smtp_credentials(access_key: str, secret_key: str, region: str) -> tuple[str, str]:
    """Derive the SES SMTP (user name, password) from IAM keys via SigV4.

    This is the fixed recipe AWS documents for its "Create SMTP credentials"
    button: the signing key is built from the secret with a hard-coded date and
    the ``ses`` service scope, then used to sign the access key id. The result
    is stable (no time component), so the same keys always yield the same
    password. Requires the *secret* access key, hence unusable with temporary
    STS credentials.
    """
    key = ("AWS4" + secret_key).encode("utf-8")
    dated = hmac.new(key, b"20151001", hashlib.sha256).digest()
    regional = hmac.new(dated, region.encode("utf-8"), hashlib.sha256).digest()
    serviced = hmac.new(regional, b"ses", hashlib.sha256).digest()
    signing = hmac.new(serviced, b"aws4_request", hashlib.sha256).digest()
    signature = hmac.new(signing, access_key.encode("utf-8"), hashlib.sha256).hexdigest()
    password = base64.b64encode(signature.encode("ascii")).decode("ascii")
    return access_key, password


def list_verified_identities(ses_client) -> list[str]:
    """Return verified email identities (Configuration Set API, paginated)."""
    identities: list[str] = []
    start: str | None = None
    while True:
        kwargs: dict[str, Any] = {"IdentityType": "Email"}
        if start:
            kwargs["NextToken"] = start
        response = ses_client.list_identities(**kwargs)
        identities.extend(response.get("Identities", []))
        start = response.get("NextToken")
        if not start:
            break

    if not identities:
        return []

    verified: list[str] = []
    for chunk_start in range(0, len(identities), 100):
        batch = identities[chunk_start : chunk_start + 100]
        attrs = ses_client.get_identity_verification_attributes(Identities=batch)
        for identity, detail in attrs.get("VerificationAttributes", {}).items():
            if detail.get("VerificationStatus") == "Success":
                verified.append(identity)
    return verified


def gather_mail_settings(
    region: str = AWS_REGION,
    port: int = 465,
    from_address: str | None = None,
    from_name: str | None = None,
    session=None,
    reveal: bool = False,
    skip_aws_lookup: bool = False,
) -> dict[str, Any]:
    """Build the MAIL_* values from AWS SES; returns a dict keyed by env name.

    Args:
        region: SES region for the SMTP endpoint and credential derivation.
        port: 465 (SSL) / 587 or 2587 (STARTTLS); sets MAIL_SCHEME accordingly.
        from_address: Force a specific sender; otherwise a verified identity is
            auto-selected (first alphabetically) from SES.
        from_name: Display name (MAIL_FROM_NAME); not an AWS value.
        session: Optional pre-built boto3 Session (defaults to the active chain).
        reveal: Include the real SMTP password; when False it is masked.
        skip_aws_lookup: Only derive from credentials, do not call SES APIs
            (skips listing verified identities). Useful for a dry check.

    Returns:
        Dict with keys MAIL_MAILER, MAIL_SCHEME, MAIL_HOST, MAIL_PORT,
        MAIL_USERNAME, MAIL_PASSWORD (masked unless `reveal`), MAIL_FROM_ADDRESS,
        MAIL_FROM_NAME, plus a private ``_notes`` list of caveats.
    """
    if port not in _PORT_SCHEMES:
        raise ValueError(f"Unsupported SMTP port {port!r}; expected one of {sorted(_PORT_SCHEMES)}.")

    session = session or boto3.session.Session()
    notes: list[str] = []

    credentials = session.get_credentials()
    frozen = credentials.get_frozen_credentials() if credentials else None

    username = password = None
    if frozen and frozen.secret_key and getattr(frozen, "token", None):
        notes.append(
            "Active credentials look temporary (session token present); SMTP auth "
            "needs long-lived IAM keys, so the derived password will be rejected."
        )
    if frozen and frozen.access_key and frozen.secret_key:
        username, password = derive_smtp_credentials(frozen.access_key, frozen.secret_key, region)
    else:
        notes.append("No secret access key available; MAIL_USERNAME/MAIL_PASSWORD could not be derived.")

    verified: list[str] = []
    if not skip_aws_lookup:
        ses_client = session.client("ses", region_name=region)
        try:
            verified = list_verified_identities(ses_client)
        except (ClientError, BotoCoreError) as error:
            notes.append(f"Could not list verified SES identities: {error}")

    if from_address:
        sender = from_address
        if verified and from_address not in verified:
            notes.append(f"{from_address!r} is not in the verified-identity list; sending may fail.")
    elif verified:
        sender = sorted(verified)[0]
    else:
        sender = ""
        notes.append("No verified SES email identity found; MAIL_FROM_ADDRESS left empty.")

    return {
        "MAIL_MAILER": "ses",
        "MAIL_SCHEME": _PORT_SCHEMES[port],
        "MAIL_HOST": smtp_host(region),
        "MAIL_PORT": str(port),
        "MAIL_USERNAME": username or "",
        "MAIL_PASSWORD": password if reveal else _mask(password),
        "MAIL_FROM_ADDRESS": sender,
        "MAIL_FROM_NAME": from_name or os.environ.get("APP_NAME") or "",
        "_notes": notes,
        "_verified_identities": verified,
    }


def _mask(value: str | None) -> str:
    return "******** (hidden; pass --reveal to show)" if value else ""


def _to_env_lines(settings: dict[str, Any]) -> str:
    keys = [
        "MAIL_MAILER",
        "MAIL_SCHEME",
        "MAIL_HOST",
        "MAIL_PORT",
        "MAIL_USERNAME",
        "MAIL_PASSWORD",
        "MAIL_FROM_ADDRESS",
        "MAIL_FROM_NAME",
    ]
    lines = []
    for key in keys:
        value = settings[key]
        needs_quotes = value == "" or (" " in value) or value.startswith("-")
        lines.append(f'{key}="{value}"' if needs_quotes else f"{key}={value}")
    return "\n".join(lines)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print the SES-backed MAIL_* settings (from .env.example lines 65-72) using boto3.",
    )
    parser.add_argument("--region", default=AWS_REGION, help=f"SES region (default: {AWS_REGION}).")
    parser.add_argument("--port", type=int, default=465, choices=sorted(_PORT_SCHEMES), help="SMTP port; sets MAIL_SCHEME.")
    parser.add_argument("--from-address", help="Verified SES identity to use as MAIL_FROM_ADDRESS (default: auto-pick).")
    parser.add_argument("--from-name", help="Display name for MAIL_FROM_NAME (not an AWS value).")
    parser.add_argument("--profile", help="Named AWS profile to use instead of the default chain.")
    parser.add_argument("--reveal", action="store_true", help="Print the real SMTP password (masked by default).")
    parser.add_argument("--skip-aws-lookup", action="store_true", help="Do not call SES APIs (only derive SMTP credentials).")
    parser.add_argument("--json", action="store_true", help="Emit the settings as JSON instead of .env lines.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    session = boto3.session.Session(profile_name=args.profile) if args.profile else None

    try:
        settings = gather_mail_settings(
            region=args.region,
            port=args.port,
            from_address=args.from_address,
            from_name=args.from_name,
            session=session,
            reveal=args.reveal,
            skip_aws_lookup=args.skip_aws_lookup,
        )
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(settings, indent=2))
    else:
        print(_to_env_lines(settings))

    verified = settings.get("_verified_identities") or []
    if verified:
        print("\n# Verified SES identities:", file=sys.stderr)
        for identity in verified:
            print(f"#   - {identity}", file=sys.stderr)

    for note in settings.get("_notes", []):
        print(f"# note: {note}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
