<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\OrganizationRecords;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class OrganizationController extends Controller
{
    public function index(OrganizationRecords $organizations): JsonResponse
    {
        $data = array_values(array_map(static fn (array $organization): array => [
            'organization_id' => DynamoKeys::strip($organization['PK'] ?? null, 'ORGANIZATION#'),
            'name' => $organization['name'] ?? null,
        ], $organizations->list()));

        return response()->json(['data' => $data]);
    }
}
