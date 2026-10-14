<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\CampusRecords;
use App\Aws\DynamoDb\ReservableRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreReservableRequest;
use App\Http\Requests\Api\V1\Admin\UpdateReservableRequest;
use App\Http\Resources\Api\V1\ReservableResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ReservableController extends Controller
{
    public function index(string $campus, CampusRecords $campuses, ReservableRecords $reservables): AnonymousResourceCollection
    {
        $campuses->require($campus);

        return ReservableResource::collection($reservables->listByCampus($campus));
    }

    public function store(StoreReservableRequest $request, string $campus, CampusRecords $campuses, ReservableRecords $reservables): JsonResponse
    {
        $campuses->require($campus);
        $validated = $request->validated();
        $item = $reservables->create(
            $campus,
            $validated['name'],
            $validated['type'],
            $validated['schedule'] ?? [],
            $this->participantBound($validated['min_participants'] ?? null),
            $this->participantBound($validated['max_participants'] ?? null),
            $request->boolean('is_classroom'),
        );

        return (new ReservableResource($item))->response()->setStatusCode(201);
    }

    public function update(
        UpdateReservableRequest $request,
        string $campus,
        string $reservable,
        ReservableRecords $reservables,
    ): ReservableResource {
        $validated = $request->validated();

        return new ReservableResource($reservables->update(
            $campus,
            $reservable,
            $validated['name'],
            $validated['type'],
            $validated['schedule'] ?? [],
            $this->participantBound($validated['min_participants'] ?? null),
            $this->participantBound($validated['max_participants'] ?? null),
            $request->boolean('is_classroom'),
        ));
    }

    public function destroy(string $campus, string $reservable, ReservableRecords $reservables): Response
    {
        $reservables->delete($campus, $reservable);

        return response()->noContent();
    }

    /**
     * Normalise a participant bound to int|null (validation already gated the shape).
     */
    private function participantBound(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }
}
