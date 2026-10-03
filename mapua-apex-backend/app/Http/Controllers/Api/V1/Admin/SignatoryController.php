<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\SignatoryRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreSignatoryRequest;
use App\Http\Requests\Api\V1\Admin\UpdateSignatoryRequest;
use App\Http\Resources\Api\V1\SignatoryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SignatoryController extends Controller
{
    public function index(SignatoryRecords $signatories): AnonymousResourceCollection
    {
        return SignatoryResource::collection($signatories->list());
    }

    public function store(StoreSignatoryRequest $request, SignatoryRecords $signatories): JsonResponse
    {
        $validated = $request->validated();
        $item = $signatories->create($validated['name'], $validated['role'], $validated['department'] ?? null);

        return (new SignatoryResource($item))->response()->setStatusCode(201);
    }

    public function update(
        UpdateSignatoryRequest $request,
        string $signatory,
        SignatoryRecords $signatories,
    ): SignatoryResource {
        $validated = $request->validated();

        return new SignatoryResource($signatories->update(
            $signatory,
            $validated['name'],
            $validated['role'],
            $validated['department'] ?? null,
        ));
    }
}
