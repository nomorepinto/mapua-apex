<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\OrganizationRecords;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\OrganizationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function show(Request $request, OrganizationRecords $organizations): OrganizationResource
    {
        $item = $organizations->get(CognitoIdentity::organizationId($request));

        if ($item === null) {
            abort(404, 'Organization not found.');
        }

        return new OrganizationResource($item);
    }

    /**
     * Directory of organizations (id + name only) for selecting collaboration
     * dependents. The current organization is returned too; the client filters it.
     */
    public function index(OrganizationRecords $organizations): JsonResponse
    {
        $data = array_values(array_map(static fn (array $organization): array => [
            'organization_id' => DynamoKeys::strip($organization['PK'] ?? null, 'ORGANIZATION#'),
            'name' => $organization['name'] ?? null,
        ], $organizations->list()));

        return response()->json(['data' => $data]);
    }
}
