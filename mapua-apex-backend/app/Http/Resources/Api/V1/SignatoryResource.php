<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SignatoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return [
            'signatory_id' => DynamoKeys::strip($item['PK'] ?? null, 'SIGNATORY#'),
            'name' => $item['name'] ?? null,
            'role' => $item['role'] ?? null,
            'department' => $item['department'] ?? null,
            'organization_id' => $item['organization_id'] ?? null,
        ];
    }
}
