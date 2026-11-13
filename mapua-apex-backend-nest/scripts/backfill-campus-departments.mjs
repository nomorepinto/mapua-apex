/**
 * Idempotent backfill of campus departments + courses (C-1).
 *
 * Seeds the campus master data from the ported Arcus catalog
 * (`src/campuses/campus-academic-catalog.ts`). Campuses are matched by name;
 * campuses that already have departments are skipped, so re-running is safe.
 *
 * Run from `mapua-apex-backend-nest`:
 *   node scripts/backfill-campus-departments.mjs
 *
 * Reads the same environment as the app: AWS_DYNAMODB_TABLE (required),
 * AWS_DYNAMODB_REGION / AWS_DEFAULT_REGION / AWS_REGION, and the optional
 * DYNAMODB_ENDPOINT / AWS_ENDPOINT for local DynamoDB. Credentials come from
 * the SDK default chain (env keys or the Lambda role).
 */
import { readFile } from 'node:fs/promises';
import { transformSync } from 'esbuild';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { planBackfill } from './backfill-campus-departments.lib.mjs';

// The catalog is plain TypeScript (interfaces + a const array, no runtime
// imports), so strip its types with esbuild and load it as an ES module.
const catalogUrl = new URL(
  '../src/campuses/campus-academic-catalog.ts',
  import.meta.url,
);
const { code } = transformSync(await readFile(catalogUrl, 'utf8'), {
  loader: 'ts',
  format: 'esm',
});
const { CAMPUS_ACADEMIC_CATALOG } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const table = (process.env.AWS_DYNAMODB_TABLE ?? '').trim();
if (!table) {
  console.error('AWS_DYNAMODB_TABLE is not set; cannot backfill campuses.');
  process.exit(1);
}
const region = (
  process.env.AWS_DYNAMODB_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  process.env.AWS_REGION ??
  'us-east-1'
).trim();
const endpoint =
  (process.env.DYNAMODB_ENDPOINT ?? process.env.AWS_ENDPOINT ?? '').trim() ||
  undefined;

const client = new DynamoDBClient({ region, ...(endpoint ? { endpoint } : {}) });
const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Scan every campus record (PK = SK = CAMPUS#id), following pagination.
const campuses = [];
let startKey;
do {
  const page = await doc.send(
    new ScanCommand({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND PK = SK',
      ExpressionAttributeValues: { ':pk': 'CAMPUS#' },
      ...(startKey ? { ExclusiveStartKey: startKey } : {}),
    }),
  );
  campuses.push(...(page.Items ?? []));
  startKey = page.LastEvaluatedKey;
} while (startKey);

const { updates, skipped, unmatched } = planBackfill(
  campuses,
  CAMPUS_ACADEMIC_CATALOG,
);
for (const name of unmatched) {
  console.log(`- No catalog match for campus "${name}" (skipped).`);
}
for (const name of skipped) {
  console.log(`- "${name}" already has departments (skipped).`);
}
for (const update of updates) {
  await doc.send(
    new UpdateCommand({
      TableName: table,
      Key: { PK: update.PK, SK: update.SK },
      UpdateExpression: 'SET departments = :departments',
      ExpressionAttributeValues: { ':departments': update.departments },
    }),
  );
  console.log(
    `- Backfilled "${update.name}" with ${update.departments.length} departments.`,
  );
}

console.log(
  `Done. updated=${updates.length} skipped=${skipped.length} unmatched=${unmatched.length} total=${campuses.length}`,
);
client.destroy();