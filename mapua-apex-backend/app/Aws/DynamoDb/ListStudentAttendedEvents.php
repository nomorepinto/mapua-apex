<?php

namespace App\Aws\DynamoDb;

use App\Support\Arcus\EventWindow;

/**
 * Events a given student actually attended that are still inside a visibility
 * window, for the arcus-evaluation student landing page.
 *
 * There is no student->events index (arcus-attendance writes each check-in as
 * PK=EVENT#{id}, SK=MEMBER#{studentId} with no reverse GSI), so this reuses the
 * published-events list for the requested window — already a small set, since a
 * window only spans the event day (attendance) or the event day plus the
 * post-evaluation window (evaluation) — and keeps just those events where the
 * student has a check-in child in the EVENT partition.
 */
final class ListStudentAttendedEvents
{
    public function __construct(
        private ListPublishedEvents $events,
        private DynamoDbItems $items,
    ) {}

    /**
     * @return list<array<string, mixed>> the attended published submission items
     */
    public function handle(string $studentId, string $window = EventWindow::EVALUATION): array
    {
        if ($studentId === '') {
            return [];
        }

        $memberKey = DynamoKeys::member($studentId);
        $events = $this->events->handle(null, $window);
        $keys = [];

        foreach ($events as $item) {
            $eventId = DynamoKeys::strip($item['PK'] ?? null, 'EVENT#');

            if (! is_string($eventId) || $eventId === '') {
                continue;
            }

            $keys[] = ['PK' => DynamoKeys::event($eventId), 'SK' => $memberKey];
        }

        $attended = array_fill_keys(array_column($this->items->batchGet($keys), 'PK'), true);

        return array_values(array_filter(
            $events,
            static fn (array $item): bool => isset($attended[$item['PK'] ?? '']),
        ));
    }
}
