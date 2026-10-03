<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\AnnouncementRecords;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreAnnouncementRequest;
use App\Http\Requests\Api\V1\Admin\UpdateAnnouncementRequest;
use App\Http\Resources\Api\V1\AnnouncementResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class AnnouncementController extends Controller
{
    public function index(AnnouncementRecords $announcements): AnonymousResourceCollection
    {
        return AnnouncementResource::collection($announcements->list());
    }

    public function store(StoreAnnouncementRequest $request, AnnouncementRecords $announcements): JsonResponse
    {
        $item = $announcements->create($request->validated('content'));

        return (new AnnouncementResource($item))->response()->setStatusCode(201);
    }

    public function show(string $announcement, AnnouncementRecords $announcements): AnnouncementResource
    {
        $item = $announcements->get($announcement);

        if ($item === null) {
            abort(404);
        }

        return new AnnouncementResource($item);
    }

    public function update(
        UpdateAnnouncementRequest $request,
        string $announcement,
        AnnouncementRecords $announcements,
    ): AnnouncementResource {
        return new AnnouncementResource($announcements->update(
            $announcement,
            $request->validated('content'),
        ));
    }

    public function destroy(string $announcement, AnnouncementRecords $announcements): Response
    {
        $announcements->delete($announcement);

        return response()->noContent();
    }
}
