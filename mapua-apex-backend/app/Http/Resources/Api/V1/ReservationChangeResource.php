<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Projects a RESERVATION_CHANGE item. The change carries the frozen `bookings`
 * linkage (which holds the request targets) and, once resolved, the `applied`
 * before/after audit trail.
 *
 * When a controller attaches a `submission` snapshot (list + detail), the
 * resource denormalizes the event title / organization name so the CDM queue
 * renders without a second client round-trip, and exposes the full snapshot for
 * the detail panel.
 */
class ReservationChangeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];
        $submission = is_array($item['submission'] ?? null) ? $item['submission'] : null;
        $details = is_array($submission['activity_details'] ?? null) ? $submission['activity_details'] : [];

        return [
            'change_id' => DynamoKeys::strip($item['SK'] ?? null, 'RESERVATION_CHANGE#'),
            'event_id' => DynamoKeys::strip($item['PK'] ?? null, 'EVENT#'),
            'submission_id' => $item['submission_id'] ?? null,
            'organization_id' => $item['organization_id'] ?? null,
            'campus_id' => $item['campus_id'] ?? null,
            'requested_by' => DynamoKeys::strip($item['requested_by'] ?? null, 'STUDENT#') ?? ($item['requested_by'] ?? null),
            'requested_at' => $item['requested_at'] ?? null,
            'request_type' => $item['request_type'] ?? null,
            'reason' => $item['reason'] ?? null,
            'suggested_date' => $item['suggested_date'] ?? null,
            'status' => $item['status'] ?? null,
            'bookings' => array_values(array_map(
                fn (array $hold): array => $this->booking($hold),
                array_filter(is_array($item['bookings'] ?? null) ? $item['bookings'] : [], 'is_array'),
            )),
            'decision' => $item['decision'] ?? null,
            'resolved_by' => DynamoKeys::strip($item['resolved_by'] ?? null, 'SIGNATORY#'),
            'resolved_at' => $item['resolved_at'] ?? null,
            'comment' => $item['comment'] ?? null,
            'applied' => $this->when(array_key_exists('applied', $item), fn () => $item['applied'] ?? null),
            // Denormalized only when context rode along from the controller.
            'event_title' => $this->when($submission !== null, fn () => $this->stringOrNull($details['title_and_nature'] ?? null)),
            'organization_name' => $this->stringOrNull($item['organization_name'] ?? $submission['organization_name'] ?? null),
            'submission' => $this->when(
                $submission !== null,
                fn () => new SubmissionResource($submission),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $hold
     * @return array<string, mixed>
     */
    private function booking(array $hold): array
    {
        return [
            'pk' => $hold['pk'] ?? null,
            'sk' => $hold['sk'] ?? null,
            'reservable_id' => $hold['reservable_id'] ?? DynamoKeys::strip($hold['pk'] ?? null, 'RESERVABLE#'),
            'reservable_name' => $hold['reservable_name'] ?? null,
            'reservable_type' => $hold['reservable_type'] ?? null,
            'schedule_selected' => $hold['schedule_selected'] ?? [],
        ];
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
