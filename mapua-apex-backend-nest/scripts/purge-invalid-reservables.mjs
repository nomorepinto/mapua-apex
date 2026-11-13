/**
 * One-off purge of reservables that are invalid under the room_type structure.
 *
 * Rooms used to carry a boolean `is_classroom`; they now require a `room_type`
 * category (function_room | classroom | multi_purpose_hall | open_space |
 * laboratory). Every legacy room lacks that attribute, so all previously
 * registered rooms are invalid and removed here, together with their BOOKING
 * holds (a hold cannot exist without its reservable). Equipment is untouched.
 *
 * Run from `mapua-apex-backend-nest`:
 *   node scripts/purge-invalid-reservables.mjs           # dry run (default)
 *   node scripts/purge-invalid-reservables.mjs --apply   # actually delete
 *
 * Reads the same environment as the app: AWS_DYNAMODB_TABLE (required),
 * AWS_DYNAMODB_REGION / AWS_DEFAULT_REGION / AWS_REGION, and the optional
 * DYNAMODB_ENDPOINT / AWS_ENDPOINT for local DynamoDB. When the table env is
 * missing, the monorepo root `.env` is loaded first. Credentials come from the
 * SDK default chain (env keys or the Lambda role).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const ROOM_TYPES = new Set([
  'function_room',
  'classroom',
  'multi_purpose_hall',
  'open_space',
  'laboratory',
]);

const apply = process.argv.includes('--apply');

// Same root-env resolution as src/config/root-env.ts (local dev only).
if (!process.env.AWS_DYNAMODB_TABLE) {
  for (const candidate of [
    resolve(process.cwd(), '..', '.env'),
    resolve(process.cwd(), '.env'),
  ]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      break;
    }
  }
}

const table = (process.env.AWS_DYNAMODB_TABLE ?? '').trim();
if (!table) {
  console.error('AWS_DYNAMODB_TABLE is not set; cannot purge reservables.');
  process.exit(1);
}
// Empty overrides in the root .env must fall through to the next candidate.
const region =
  [
    process.env.AWS_DYNAMODB_REGION,
    process.env.AWS_DEFAULT_REGION,
    process.env.AWS_REGION,
  ]
    .map((value) => (value ?? '').trim())
    .find((value) => value !== '') ?? 'us-east-1';
const endpoint =
  (process.env.DYNAMODB_ENDPOINT ?? process.env.AWS_ENDPOINT ?? '').trim() ||
  undefined;

const client = new DynamoDBClient({ region, ...(endpoint ? { endpoint } : {}) });
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Scan every reservable record, following pagination.
const reservables = [];
let startKey;
do {
  const page = await doc.send(
    new ScanCommand({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': 'CAMPUS#', ':sk': 'RESERVABLE#' },
      ...(startKey ? { ExclusiveStartKey: startKey } : {}),
    }),
  );
  reservables.push(...(page.Items ?? []));
  startKey = page.LastEvaluatedKey;
} while (startKey);

const invalid = reservables.filter(
  (item) => item.type === 'room' && !ROOM_TYPES.has(item.room_type),
);

console.log(
  `${apply ? 'Purging' : 'Dry run:'} ${invalid.length} invalid room(s) of ${reservables.length} reservable(s) scanned.`,
);

let deletedBookings = 0;
for (const item of invalid) {
  // Collect the room's holds (PK = RESERVABLE#id, SK = BOOKING#...).
  const bookings = [];
  let bookingStartKey;
  do {
    const page = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': item.SK, ':sk': 'BOOKING#' },
        ...(bookingStartKey ? { ExclusiveStartKey: bookingStartKey } : {}),
      }),
    );
    bookings.push(...(page.Items ?? []));
    bookingStartKey = page.LastEvaluatedKey;
  } while (bookingStartKey);

  console.log(
    `- "${item.name}" (${item.SK})${bookings.length > 0 ? ` + ${bookings.length} booking(s)` : ''}`,
  );
  if (!apply) {
    deletedBookings += bookings.length;
    continue;
  }
  for (const booking of bookings) {
    await doc.send(
      new DeleteCommand({
        TableName: table,
        Key: { PK: booking.PK, SK: booking.SK },
      }),
    );
    deletedBookings += 1;
  }
  await doc.send(
    new DeleteCommand({
      TableName: table,
      Key: { PK: item.PK, SK: item.SK },
    }),
  );
}

console.log(
  apply
    ? `Done. deletedReservables=${invalid.length} deletedBookings=${deletedBookings}`
    : `Dry run complete. Would delete ${invalid.length} reservable(s) and ${deletedBookings} booking(s). Re-run with --apply to delete.`,
);
client.destroy();