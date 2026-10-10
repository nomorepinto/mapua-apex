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

        return [
            'reservable_id' => DynamoKeys::strip($item['SK'] ?? null, 'RESERVABLE#'),
            'campus_id' => DynamoKeys::strip($item['PK'] ?? null, 'CAMPUS#'),
            'name' => $item['name'] ?? null,
            'type' => $item['type'] ?? null,
            'schedule' => ReservableSchedule::normalize($item['schedule'] ?? []),
        ];
    }
}
