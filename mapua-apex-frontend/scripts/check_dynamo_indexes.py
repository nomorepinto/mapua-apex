"""Check DynamoDB Table Global Secondary Indexes (GSIs).

Usage:
    python scripts/check_dynamo_indexes.py [--table mapua-apex] [--region ap-southeast-1]

Inspects the DynamoDB table configuration and prints all Global Secondary
Indexes (GSIs) and their statuses, identifying whether GSI6 exists.
"""

import argparse
import os
import sys
from pathlib import Path
import boto3
from botocore.exceptions import ClientError


def load_env_file(filepath: Path) -> dict:
    env_vars = {}
    if not filepath.exists():
        return env_vars
    for line in filepath.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            env_vars[key] = val
    return env_vars


def main() -> int:
    # Resolve root .env if environment variables are not set
    root_env = Path(__file__).resolve().parents[2] / ".env"
    env_data = load_env_file(root_env)

    default_region = os.environ.get("AWS_DEFAULT_REGION") or env_data.get("AWS_DEFAULT_REGION", "ap-southeast-1")
    default_table = os.environ.get("AWS_DYNAMODB_TABLE") or env_data.get("AWS_DYNAMODB_TABLE", "mapua-apex")
    access_key = os.environ.get("AWS_ACCESS_KEY_ID") or env_data.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or env_data.get("AWS_SECRET_ACCESS_KEY")

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", default=default_table, help="DynamoDB table name")
    parser.add_argument("--region", default=default_region, help="AWS region")
    args = parser.parse_args()

    client_kwargs = {"region_name": args.region}
    if access_key and secret_key:
        client_kwargs["aws_access_key_id"] = access_key
        client_kwargs["aws_secret_access_key"] = secret_key

    client = boto3.client("dynamodb", **client_kwargs)

    print(f"--- Inspecting DynamoDB table: {args.table} in {args.region} ---")
    try:
        resp = client.describe_table(TableName=args.table)
        table = resp["Table"]
        print(f"Table Status: {table.get('TableStatus')}")
        print(f"Item Count: {table.get('ItemCount')}")

        gsis = table.get("GlobalSecondaryIndexes", [])
        print(f"\nGlobal Secondary Indexes ({len(gsis)} found):")

        gsi_names = []
        for gsi in gsis:
            name = gsi.get("IndexName")
            status = gsi.get("IndexStatus")
            gsi_names.append(name)
            key_schema = gsi.get("KeySchema", [])
            pk = next((k["AttributeName"] for k in key_schema if k["KeyType"] == "HASH"), "None")
            sk = next((k["AttributeName"] for k in key_schema if k["KeyType"] == "RANGE"), "None")
            print(f"  - {name}: Status={status}, PartitionKey={pk}, SortKey={sk}")

        print("\n--- GSI6 Check ---")
        if "GSI6" in gsi_names:
            print("  [OK] GSI6 is provisioned on the table.")
        else:
            print("  [MISSING] GSI6 is NOT present on the table!")
            print("  -> Queries specifying IndexName='GSI6' (such as CDM reservation-changes) will fail with:")
            print("     'ValidationException: The table does not have the specified index: GSI6'")

    except ClientError as exc:
        print(f"Error describing table {args.table}: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
