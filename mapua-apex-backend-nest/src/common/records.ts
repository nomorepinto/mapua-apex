export type Item = Record<string, unknown>;

export function str(item: Item, key: string): string | null {
  const value = item[key];
  return typeof value === 'string' ? value : null;
}

export function num(item: Item, key: string): number | null {
  const value = item[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (
    typeof value === 'string' &&
    value !== '' &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

export function bool(item: Item, key: string): boolean {
  return item[key] === true;
}

export function list(item: Item, key: string): unknown[] {
  const value = item[key];
  return Array.isArray(value) ? value : [];
}

export function record(value: unknown): Item | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Item;
  }
  return null;
}

export function isConditionalCheckFailed(error: unknown): boolean {
  return (
    error instanceof Error && error.name === 'ConditionalCheckFailedException'
  );
}
