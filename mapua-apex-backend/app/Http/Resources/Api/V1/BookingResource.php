<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return [
            'booking_id' => DynamoKeys::strip($item['SK'] ?? null, 'BOOKING#'),
            'reservable_id' => DynamoKeys::strip($item['PK'] ?? null, 'RESERVABLE#'),
            'reservable_name' => $item['reservable_name'] ?? null,
            'reservable_type' => $item['reservable_type'] ?? null,
            'campus_id' => $item['campus_id'] ?? null,
            'source' => $item['source'] ?? null,
            'timestamp' => $item['timestamp'] ?? null,
            'schedule_selected' => $item['schedule_selected'] ?? [],
            'reason' => $item['reason'] ?? null,
            'booked_by' => DynamoKeys::strip($item['booked_by'] ?? null, 'SIGNATORY#'),
            'organization_id' => DynamoKeys::strip(
                $item['organization_id'] ?? $item['GSI5PK'] ?? null,
                'ORGANIZATION#',
            ),
            'submission_id' => $item['submission_id'] ?? null,
            'event_id' => $item['event_id'] ?? null,
        ];
    }
}
