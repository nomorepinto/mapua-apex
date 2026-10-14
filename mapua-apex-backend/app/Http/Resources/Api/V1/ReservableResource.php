<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\ReservableSchedule;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ReservableResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];
        $min = is_numeric($item['min_participants'] ?? null) ? (int) $item['min_participants'] : null;
        $max = is_numeric($item['max_participants'] ?? null) ? (int) $item['max_participants'] : null;

        return [
            'reservable_id' => DynamoKeys::strip($item['SK'] ?? null, 'RESERVABLE#'),
            'campus_id' => DynamoKeys::strip($item['PK'] ?? null, 'CAMPUS#'),
            'name' => $item['name'] ?? null,
            'type' => $item['type'] ?? null,
            'schedule' => ReservableSchedule::normalize($item['schedule'] ?? []),
            // Room-only participant bounds; null when unstated (no limit).
            'min_participants' => $min,
            'max_participants' => $max,
            'capacity_label' => $min !== null || $max !== null ? ReservableSchedule::capacityLabel($item) : null,
            // Room-only classroom flag (equipment is always false).
            'is_classroom' => ($item['type'] ?? null) === 'room' && (bool) ($item['is_classroom'] ?? false),
        ];
    }
}
