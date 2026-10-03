<?php

namespace App\Http\Controllers\Api\V1\Signatory;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\NotificationRecords;
use App\Aws\DynamoDb\SignatoryDesk;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreNotificationRequest;
use App\Http\Requests\Api\V1\UpdateNotificationRequest;
use App\Http\Resources\Api\V1\NotificationResource;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    public function store(
        StoreNotificationRequest $request,
        string $event,
        string $submission,
        GetSubmission $submissions,
        NotificationRecords $notifications,
    ): JsonResponse {
        $paper = $submissions->require($event, $submission);
        $signatoryId = CognitoIdentity::signatoryId($request);
        SignatoryDesk::requireOpen($paper, $signatoryId);

        $item = $notifications->create(
            $submission,
            $signatoryId,
            (string) $request->validated('notif_type'),
            $request->comment(),
        );

        return (new NotificationResource($item))->response()->setStatusCode(201);
    }

    public function update(
        UpdateNotificationRequest $request,
        string $event,
        string $submission,
        string $notification,
        GetSubmission $submissions,
        NotificationRecords $notifications,
    ): NotificationResource {
        $submissions->require($event, $submission);
        $existing = $notifications->require($submission, $notification);
        $signatoryId = CognitoIdentity::signatoryId($request);

        if (($existing['signatory'] ?? null) !== DynamoKeys::signatory($signatoryId)) {
            abort(404);
        }

        return new NotificationResource($notifications->update(
            $submission,
            $notification,
            $signatoryId,
            (string) $request->validated('notif_type'),
            $request->comment(),
        ));
    }
}
