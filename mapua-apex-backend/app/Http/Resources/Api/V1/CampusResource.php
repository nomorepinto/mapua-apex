<?php

namespace App\Http\Resources\Api\V1;

use App\Aws\DynamoDb\CampusClassroomNaming;
use App\Aws\DynamoDb\DynamoKeys;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CampusResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];
        $prefixes = CampusClassroomNaming::prefixes($item);
        $digits = CampusClassroomNaming::digits($item);

        return [
            'campus_id' => DynamoKeys::strip($item['PK'] ?? null, 'CAMPUS#'),
            'name' => $item['name'] ?? null,
            // Classroom naming format; empty list + null digits = no rule.
            'classroom_name_prefixes' => $prefixes,
            'classroom_name_digits' => $digits,
            'classroom_name_hint' => $prefixes !== [] && $digits !== null
                ? CampusClassroomNaming::hint($prefixes, $digits)
                : null,
        ];
    }
}
