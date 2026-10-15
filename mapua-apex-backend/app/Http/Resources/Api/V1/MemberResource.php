<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MemberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return [
            'student_number' => DynamoKeys::strip($item['SK'] ?? null, 'MEMBER#') ?? ($item['student_number'] ?? null),
            'lastname' => $item['lastname'] ?? null,
            'firstname' => $item['firstname'] ?? null,
        ];
    }
}
