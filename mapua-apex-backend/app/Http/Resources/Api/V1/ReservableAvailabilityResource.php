<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wraps a reservable plus its computed availability window. The controller
 * assembles: ['reservable' => item, 'schedule' => template, 'dates' => per-date map].
 */
class ReservableAvailabilityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = is_array($this->resource) ? $this->resource : [];
        $reservable = is_array($data['reservable'] ?? null) ? $data['reservable'] : [];

        return [
            'reservable_id' => DynamoKeys::strip($reservable['SK'] ?? null, 'RESERVABLE#'),
            'campus_id' => DynamoKeys::strip($reservable['PK'] ?? null, 'CAMPUS#'),
            'name' => $reservable['name'] ?? null,
            'type' => $reservable['type'] ?? null,
            'schedule' => $data['schedule'] ?? [],
            'dates' => $data['dates'] ?? [],
        ];
    }
}
