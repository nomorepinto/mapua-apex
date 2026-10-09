"""List verified SES identities and sandbox status (boto3, read-only).

Usage:
    python scripts/check_ses_verifications.py [--region ap-southeast-1] [--email someone@example.com]

Prints every verified email/domain identity in the region, optionally checks a
specific address against them (account-level or its verified domain), and
reports whether the account is still in the SES sandbox.
"""

import argparse
import sys

import boto3
from botocore.exceptions import ClientError


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default="ap-southeast-1")
    parser.add_argument("--email", help="also check whether this destination is verified")
    args = parser.parse_args()

    ses = boto3.client("ses", region_name=args.region)
    sesv2 = boto3.client("sesv2", region_name=args.region)

    print(f"--- SES account / sandbox status ({args.region}) ---")
    try:
        account = sesv2.get_account()
        production = account.get("ProductionAccessEnabled")
        print(f"ProductionAccessEnabled: {production} ({'NOT in sandbox' if production else 'still in SANDBOX mode'})")
        quota = account.get("SendQuota", {})
        print(f"Send quota - Max24HourSend: {quota.get('Max24HourSend')}")
        print(f"Send quota - MaxMessagesPerSecond: {quota.get('MaxMessagesPerSecond')}")
        print(f"Sent last 24h: {quota.get('SentLast24Hours')}")
    except ClientError as exc:
        print(f"could not get account: {exc}", file=sys.stderr)

    # v1 GetSendQuota mirrors the same numbers and is the classic rate-limit view.
    try:
        sq = ses.get_send_quota()
        print(f"\n[v1 GetSendQuota] Max24HourSend={sq.get('Max24HourSend')} "
              f"MaxSentLast24Hours={sq.get('MaxSentLast24Hours')} "
              f"MaxMessagesPerSecond={sq.get('MaxMessagesPerSecond')}")
    except ClientError as exc:
        print(f"could not get send quota: {exc}", file=sys.stderr)

    print("\n--- Verified email identities ---")
    identities = ses.list_identities(IdentityType="EmailAddress")["Identities"]
    for ident in identities:
        attrs = ses.get_identity_verification_attributes(Identities=[ident])["VerificationAttributes"][ident]
        print(f"  {ident}: {attrs['VerificationStatus']}")
    if not identities:
        print("  (none)")

    print("\n--- Verified domains (send-to also allowed for any address @ these) ---")
    domains = ses.list_identities(IdentityType="Domain")["Identities"]
    for domain in domains:
        attrs = ses.get_identity_verification_attributes(Identities=[domain])["VerificationAttributes"][domain]
        print(f"  @{domain}: {attrs['VerificationStatus']}")
        # DKIM enabled means subaddressing/enforcement off is not required for +tags
        try:
            dkim = ses.get_identity_dkim_attributes(Identities=[domain])["DkimAttributes"][domain]
            print(f"    DKIM: {dkim['DkimEnabled']}")
        except ClientError:
            pass
    if not domains:
        print("  (none)")

    if args.email:
        print(f"\n--- Destination check: {args.email} ---")
        local, _, domain_part = args.email.partition("@")
        verified = args.email in identities or (domain_part and f"{local}@{domain_part}" in identities)
        if not verified and domain_part:
            # sandbox + strict receiving requires exact identity; a verified domain
            # only makes it a valid *Source*, not necessarily a valid destination
            # unless DKIM is enabled (which permits any address at the domain).
            verified = domain_part in domains
        print(f"  {'VERIFIED - can receive mail in sandbox' if verified else 'NOT VERIFIED - SendEmail will fail with MessageRejected in sandbox'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
