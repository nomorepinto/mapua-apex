/**
 * Pure planning logic for the campus departments backfill (C-1), shared by
 * `scripts/backfill-campus-departments.mjs` and its unit test. Campuses are
 * matched to the catalog by name (case-insensitive, trimmed); campuses that
 * already carry departments are skipped so re-running the backfill is safe.
 *
 * Plain JavaScript (JSDoc types only) so both Node and the test bundler can
 * load it without a TypeScript transform.
 */

/**
 * @typedef {Object} BackfillCatalogEntry
 * @property {string} campus
 * @property {unknown[]} departments
 */

/**
 * @typedef {Object} BackfillCampusRow
 * @property {string} PK
 * @property {string} SK
 * @property {string} [name]
 * @property {unknown[]} [departments]
 */

/**
 * @typedef {Object} BackfillUpdate
 * @property {string} PK
 * @property {string} SK
 * @property {string} name
 * @property {unknown[]} departments
 */

/**
 * @typedef {Object} BackfillPlan
 * @property {BackfillUpdate[]} updates
 * @property {string[]} skipped
 * @property {string[]} unmatched
 */

const normalize = (value) => (value ?? '').trim().toLowerCase();

/**
 * @param {BackfillCampusRow[]} campuses
 * @param {BackfillCatalogEntry[]} catalog
 * @returns {BackfillPlan}
 */
export function planBackfill(campuses, catalog) {
  const byName = new Map(
    catalog.map((entry) => [normalize(entry.campus), entry]),
  );
  const updates = [];
  const skipped = [];
  const unmatched = [];
  for (const campus of campuses) {
    const name = campus.name ?? '';
    const entry = byName.get(normalize(name));
    if (!entry) {
      unmatched.push(name);
      continue;
    }
    if (Array.isArray(campus.departments) && campus.departments.length > 0) {
      skipped.push(name);
      continue;
    }
    updates.push({
      PK: campus.PK,
      SK: campus.SK,
      name,
      departments: entry.departments,
    });
  }
  return { updates, skipped, unmatched };
}