/**
 * Room categories a room reservable can belong to. Only `classroom` carries
 * the campus naming rule (prefixes + digit count); the other categories have
 * no extra restrictions.
 */
export const ROOM_TYPES = [
  'function_room',
  'classroom',
  'multi_purpose_hall',
  'open_space',
  'laboratory',
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export function isRoomType(value: unknown): value is RoomType {
  return (
    typeof value === 'string' && (ROOM_TYPES as readonly string[]).includes(value)
  );
}