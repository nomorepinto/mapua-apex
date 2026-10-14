<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\CampusRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreCampusRequest;
use App\Http\Requests\Api\V1\Admin\UpdateCampusRequest;
use App\Http\Resources\Api\V1\CampusResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class CampusController extends Controller
{
    public function index(CampusRecords $campuses): AnonymousResourceCollection
    {
        return CampusResource::collection($campuses->list());
    }

    public function store(StoreCampusRequest $request, CampusRecords $campuses): JsonResponse
    {
        $validated = $request->validated();
        $item = $campuses->create(
            $validated['name'],
            $this->prefixes($validated['classroom_name_prefixes'] ?? null),
            $this->digits($validated['classroom_name_digits'] ?? null),
        );

        return (new CampusResource($item))->response()->setStatusCode(201);
    }

    public function update(UpdateCampusRequest $request, string $campus, CampusRecords $campuses): CampusResource
    {
        $validated = $request->validated();

        return new CampusResource($campuses->update(
            $campus,
            $validated['name'],
            $this->prefixes($validated['classroom_name_prefixes'] ?? null),
            $this->digits($validated['classroom_name_digits'] ?? null),
        ));
    }

    public function destroy(string $campus, CampusRecords $campuses): Response
    {
        $campuses->delete($campus);

        return response()->noContent();
    }

    /**
     * @return array<int, string>|null
     */
    private function prefixes(mixed $value): ?array
    {
        return is_array($value) ? $value : null;
    }

    private function digits(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }
}
