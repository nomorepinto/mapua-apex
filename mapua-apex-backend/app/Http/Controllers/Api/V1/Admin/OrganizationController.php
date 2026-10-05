<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\OrganizationRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreOrganizationRequest;
use App\Http\Requests\Api\V1\Admin\UpdateOrganizationRequest;
use App\Http\Resources\Api\V1\OrganizationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class OrganizationController extends Controller
{
    public function index(OrganizationRecords $organizations): AnonymousResourceCollection
    {
        return OrganizationResource::collection($organizations->list());
    }

    public function store(StoreOrganizationRequest $request, OrganizationRecords $organizations): JsonResponse
    {
        $validated = $request->validated();
        $item = $organizations->create(
            $validated['name'],
            $validated['signatories'] ?? [],
            (bool) ($validated['is_higher_council'] ?? false),
        );

        return (new OrganizationResource($item))->response()->setStatusCode(201);
    }

    public function update(
        UpdateOrganizationRequest $request,
        string $organization,
        OrganizationRecords $organizations,
    ): OrganizationResource {
        $validated = $request->validated();

        return new OrganizationResource($organizations->update(
            $organization,
            $validated['name'],
            $validated['signatories'],
            array_key_exists('is_higher_council', $validated)
                ? (bool) $validated['is_higher_council']
                : null,
        ));
    }

    public function destroy(string $organization, OrganizationRecords $organizations): Response
    {
        $organizations->delete($organization);

        return response()->noContent();
    }
}
