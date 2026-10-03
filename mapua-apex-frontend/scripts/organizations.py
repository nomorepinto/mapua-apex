"""Organization name -> organization_id lookup for student Cognito accounts.

IDs match DynamoDB `ORGANIZATION#<id>` records and Cognito `custom:organization_id`.
"""

ORGANIZATIONS: dict[str, str] = {
    "Admin Test Organization": "admin-org",
    "MGC": "b5786dcb-1251-4979-9c43-bd92e4f9d76a",
    "Organization X": "40f61ea5-eb27-4e7b-9496-3f1a9bdea6dc",
}
