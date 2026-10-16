"""Provision GSI6 index on the DynamoDB table (boto3).

Usage:
    python scripts/provision_gsi6_index.py [--table mapua-apex] [--region ap-southeast-1]

Adds Global Secondary Index GSI6 (GSI6PK / GSI6SK, Projection: ALL) to the
DynamoDB table for the CDM reservation-changes per-campus queue.
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

    print(f"--- Checking existing table configuration: {args.table} in {args.region} ---")
    try:
        desc = client.describe_table(TableName=args.table)["Table"]
        billing_mode = desc.get("BillingModeSummary", {}).get("BillingMode")
        table_status = desc.get("TableStatus")

        if table_status != "ACTIVE":
            print(f"Table is currently in status: {table_status}. Wait until it is ACTIVE before updating.", file=sys.stderr)
            return 1

        existing_gsis = {gsi["IndexName"]: gsi["IndexStatus"] for gsi in desc.get("GlobalSecondaryIndexes", [])}
        if "GSI6" in existing_gsis:
            print(f"GSI6 already exists with status: {existing_gsis['GSI6']}")
            return 0

        print("Provisioning GSI6 index...")
        gsi_create = {
            "IndexName": "GSI6",
            "KeySchema": [
                {"AttributeName": "GSI6PK", "KeyType": "HASH"},
                {"AttributeName": "GSI6SK", "KeyType": "RANGE"},
            ],
            "Projection": {
                "ProjectionType": "ALL",
            },
        }

        # If provisioned billing mode, provide default read/write capacity units
        if billing_mode != "PAY_PER_REQUEST":
            throughput = desc.get("ProvisionedThroughput", {})
            gsi_create["ProvisionedThroughput"] = {
                "ReadCapacityUnits": throughput.get("ReadCapacityUnits", 5),
                "WriteCapacityUnits": throughput.get("WriteCapacityUnits", 5),
            }

        update_params = {
            "TableName": args.table,
            "AttributeDefinitions": [
                {"AttributeName": "GSI6PK", "AttributeType": "S"},
                {"AttributeName": "GSI6SK", "AttributeType": "S"},
            ],
            "GlobalSecondaryIndexUpdates": [
                {
                    "Create": gsi_create,
                }
            ],
        }

        response = client.update_table(**update_params)
        print("Update requested successfully!")
        status = response.get("TableDescription", {}).get("TableStatus")
        print(f"Table status is now: {status}. GSI6 is building in AWS (status: CREATING).")
        print("Note: In AWS DynamoDB, backfilling the index typically takes a few minutes.")

    except ClientError as exc:
        print(f"Error provisioning GSI6: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
