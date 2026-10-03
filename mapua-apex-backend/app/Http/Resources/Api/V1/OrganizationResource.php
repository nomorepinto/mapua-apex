<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return [
            'organization_id' => DynamoKeys::strip($item['PK'] ?? null, 'ORGANIZATION#'),
            'name' => $item['name'] ?? null,
            'is_higher_council' => ($item['is_higher_council'] ?? false) === true,
            'signatories' => $this->signatories($item['signatories'] ?? []),
        ];
    }

    /**
     * @return list<array{role: string|null, signatory_id: string|null}>
     */
    private function signatories(mixed $entries): array
    {
        if (! is_array($entries)) {
            return [];
        }

        $signatories = [];

        foreach ($entries as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $signatories[] = [
                'role' => $entry['role'] ?? null,
                'signatory_id' => DynamoKeys::strip($entry['signatory_id'] ?? null, 'SIGNATORY#'),
            ];
        }

        return $signatories;
    }
}
