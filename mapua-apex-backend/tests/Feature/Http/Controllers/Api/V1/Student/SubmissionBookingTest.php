<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Student;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\Support\SaafPayload;
use Tests\TestCase;

class SubmissionBookingTest extends TestCase
{
    // 2026-10-12 is a Monday, offered by the all-available Mon-Sat template.
    private const DATE = '2026-10-12';

    private function seedCatalog(InMemoryDynamoDb $db): void
    {
        DynamoFixtures::event($db);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        DynamoFixtures::campus($db, 'c001');
        DynamoFixtures::reservable($db, 'c001', 'r001');
    }

    /**
     * @param  list<int>  $slots
     * @return array<string, mixed>
     */
    private function payloadWithReservation(array $slots): array
    {
        return SaafPayload::valid([
            'venue_reservation' => [
                'has_reservation' => true,
                'reservations' => [
                    SaafPayload::reservation('c001', 'r001', self::DATE, $slots),
                ],
            ],
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function itemsWithSkPrefix(InMemoryDynamoDb $db, string $prefix): array
    {
        return array_values(array_filter(
            $db->all(),
            static fn (array $item): bool => str_starts_with((string) ($item['SK'] ?? ''), $prefix),
        ));
    }

    public function test_creating_a_submission_with_a_reservation_writes_a_booking_and_refs(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedCatalog($db);

        $response = $this->withStudentAuth()->postJson(
            '/api/v1/students/submissions',
            $this->payloadWithReservation([0, 1]),
        );

        $response->assertCreated();
        $submissionId = $response->json('data.submission_id');
        $this->assertIsString($submissionId);

        $stored = $db->find('EVENT#e001', 'SUBMISSION#'.$submissionId);
        $refs = $stored['booking_refs'] ?? null;
        $this->assertIsArray($refs);
        $this->assertCount(1, $refs);

        $booking = $db->find($refs[0]['pk'], $refs[0]['sk']);
        $this->assertIsArray($booking);
        $this->assertSame('submission', $booking['source'] ?? null);
        $this->assertSame('ORGANIZATION#a1b2', $booking['GSI5PK'] ?? null);
        $this->assertSame($submissionId, $booking['submission_id'] ?? null);
        $this->assertSame([['date' => self::DATE, 'slots' => [0, 1]]], $booking['schedule_selected'] ?? null);
    }

    public function test_a_conflicting_reservation_returns_409_and_persists_nothing(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedCatalog($db);
        DynamoFixtures::booking($db, 'r001', 'existing', [['date' => self::DATE, 'slots' => [0]]]);

        $this->withStudentAuth()
            ->postJson('/api/v1/students/submissions', $this->payloadWithReservation([0]))
            ->assertConflict();

        $this->assertCount(0, $this->itemsWithSkPrefix($db, 'SUBMISSION#'));
        $this->assertCount(1, $this->itemsWithSkPrefix($db, 'BOOKING#'));
    }

    public function test_denying_a_submission_releases_its_bookings(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]]);
        DynamoFixtures::submission($db, [
            'booking_refs' => [['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']],
        ]);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/deny', ['comment' => 'No room.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'denied');

        $this->assertNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));
        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertArrayNotHasKey('booking_refs', $stored ?? []);
    }

    public function test_returning_a_submission_releases_its_bookings(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::event($db);
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]]);
        DynamoFixtures::submission($db, [
            'booking_refs' => [['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']],
        ]);

        $this->withSignatoryAuth()
            ->postJson('/api/v1/signatories/events/e001/submissions/s001/return', ['comment' => 'Pick another time.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'returned');

        $this->assertNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));
        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $this->assertArrayNotHasKey('booking_refs', $stored ?? []);
    }

    public function test_updating_a_submission_reconciles_bookings(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        $this->seedCatalog($db);
        DynamoFixtures::booking($db, 'r001', 'b001', [['date' => self::DATE, 'slots' => [0]]]);
        DynamoFixtures::submission($db, [
            'booking_refs' => [['pk' => 'RESERVABLE#r001', 'sk' => 'BOOKING#b001']],
        ]);

        $payload = $this->payloadWithReservation([2]);
        unset($payload['event_id']);

        $this->withStudentAuth()
            ->putJson('/api/v1/students/events/e001/submissions/s001', $payload)
            ->assertOk();

        // Old hold released.
        $this->assertNull($db->find('RESERVABLE#r001', 'BOOKING#b001'));

        // New hold written and referenced.
        $stored = $db->find('EVENT#e001', 'SUBMISSION#s001');
        $refs = $stored['booking_refs'] ?? null;
        $this->assertIsArray($refs);
        $this->assertCount(1, $refs);
        $this->assertNotSame('BOOKING#b001', $refs[0]['sk']);

        $booking = $db->find($refs[0]['pk'], $refs[0]['sk']);
        $this->assertSame([['date' => self::DATE, 'slots' => [2]]], $booking['schedule_selected'] ?? null);
    }
}
