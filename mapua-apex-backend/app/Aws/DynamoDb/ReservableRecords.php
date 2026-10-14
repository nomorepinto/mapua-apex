<?php

namespace App\Aws\DynamoDb;

use Illuminate\Support\Str;

final class ReservableRecords
{
    public function __construct(private DynamoDbItems $items) {}

    /**
     * All rooms/equipment under a campus.
     *
     * @return list<array<string, mixed>>
     */
    public function listByCampus(string $campusId): array
    {
        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::campus($campusId)],
                ':sk' => ['S' => 'RESERVABLE#'],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(string $campusId, string $reservableId): ?array
    {
        return $this->items->get(
            DynamoKeys::campus($campusId),
            DynamoKeys::reservable($reservableId),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function require(string $campusId, string $reservableId): array
    {
        $item = $this->get($campusId, $reservableId);

        if ($item === null) {
            abort(404, 'The selected room or equipment does not exist.');
        }

        return $item;
    }

    /**
     * @param  array<string, mixed>  $schedule
     * @return array<string, mixed>
     */
    public function create(string $campusId, string $name, string $type, array $schedule, ?int $minParticipants = null, ?int $maxParticipants = null, bool $isClassroom = false): array
    {
        return $this->write($campusId, (string) Str::uuid(), $name, $type, $schedule, $minParticipants, $maxParticipants, $isClassroom);
    }

    /**
     * @param  array<string, mixed>  $schedule
     * @return array<string, mixed>
     */
    public function update(string $campusId, string $reservableId, string $name, string $type, array $schedule, ?int $minParticipants = null, ?int $maxParticipants = null, bool $isClassroom = false): array
    {
        if ($this->get($campusId, $reservableId) === null) {
            abort(404);
        }

        return $this->write($campusId, $reservableId, $name, $type, $schedule, $minParticipants, $maxParticipants, $isClassroom);
    }

    /**
     * Permanently remove a reservable, refusing when it still has bookings that
     * would be left dangling.
     */
    public function delete(string $campusId, string $reservableId): void
    {
        $id = DynamoKeys::strip($reservableId, 'RESERVABLE#') ?? $reservableId;
        $pk = DynamoKeys::campus($campusId);
        $sk = DynamoKeys::reservable($id);

        if ($this->items->get($pk, $sk) === null) {
            abort(404);
        }

        if ($this->hasBookings($id)) {
            abort(409, 'This room or equipment still has bookings and cannot be deleted.');
        }

        $this->items->delete($pk, $sk);
    }

    private function hasBookings(string $reservableId): bool
    {
        return $this->items->query([
            'KeyConditionExpression' => 'PK = :pk AND begins_with(SK, :sk)',
            'ExpressionAttributeValues' => [
                ':pk' => ['S' => DynamoKeys::reservable($reservableId)],
                ':sk' => ['S' => 'BOOKING#'],
            ],
            'Limit' => 1,
        ], allPages: false) !== [];
    }

    /**
     * Persist one reservable. Participant bounds and the classroom flag are
     * room-only: they are stored solely when they apply, so equipment (and rooms
     * without a stated capacity) keep no attributes and stay unlimited/plain.
     *
     * @param  array<string, mixed>  $schedule
     * @return array<string, mixed>
     */
    private function write(string $campusId, string $id, string $name, string $type, array $schedule, ?int $minParticipants, ?int $maxParticipants, bool $isClassroom): array
    {
        $type = Str::lower($type);

        $item = [
            'PK' => DynamoKeys::campus($campusId),
            'SK' => DynamoKeys::reservable($id),
            'name' => $name,
            'type' => $type,
            'schedule' => ReservableSchedule::normalize($schedule),
        ];

        if ($type === 'room' && ($minParticipants !== null || $maxParticipants !== null)) {
            $item['min_participants'] = $minParticipants;
            $item['max_participants'] = $maxParticipants;
        }

        if ($type === 'room' && $isClassroom) {
            $item['is_classroom'] = true;
        }

        $this->items->put($item);

        return $item;
    }
}
