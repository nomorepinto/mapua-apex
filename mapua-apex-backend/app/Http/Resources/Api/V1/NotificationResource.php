<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return [
            'submission_id' => DynamoKeys::strip($item['PK'] ?? null, 'SUBMISSION#'),
            'sent_at' => DynamoKeys::strip($item['SK'] ?? null, 'NOTIFICATION#'),
            'signatory' => DynamoKeys::strip($item['signatory'] ?? null, 'SIGNATORY#'),
            'notif_type' => $item['notif_type'] ?? null,
            'comment' => $item['comment'] ?? '',
        ];
    }
}
