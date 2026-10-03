<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeadlineResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return [
            'event_id' => DynamoKeys::strip($item['PK'] ?? null, 'EVENT#'),
            'deadline_id' => DynamoKeys::strip($item['SK'] ?? null, 'DEADLINE#'),
            'sent_at' => $item['sent_at'] ?? null,
            'deadline' => $item['deadline'] ?? null,
        ];
    }
}
