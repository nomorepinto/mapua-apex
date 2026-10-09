<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\ListSubmissionNotifications;
use App\Aws\DynamoDb\NotificationRecords;
use App\Aws\DynamoDb\SubmissionAccess;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreNotificationRequest;
use App\Http\Requests\Api\V1\UpdateNotificationRequest;
use App\Http\Resources\Api\V1\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NotificationController extends Controller
{
    public function index(
        Request $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
        ListSubmissionNotifications $notifications,
    ): AnonymousResourceCollection {
        // Dependents receive a read-only copy of every notification as it is sent.
        $this->authorize($request, $event, $submission, $events, $submissions, $access, requireProponent: false);

        return NotificationResource::collection($notifications->handle($submission));
    }

    public function store(
        StoreNotificationRequest $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
        NotificationRecords $notifications,
    ): JsonResponse {
        $paper = $this->authorize($request, $event, $submission, $events, $submissions, $access, requireProponent: true);

        $item = $notifications->create(
            $submission,
            (string) $request->validated('signatory'),
            (string) $request->validated('notif_type'),
            $request->comment(),
            submission: $paper,
        );

        return (new NotificationResource($item))->response()->setStatusCode(201);
    }

    public function update(
        UpdateNotificationRequest $request,
        string $event,
        string $submission,
        string $notification,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
        NotificationRecords $notifications,
    ): NotificationResource {
        $this->authorize($request, $event, $submission, $events, $submissions, $access, requireProponent: true);

        return new NotificationResource($notifications->update(
            $submission,
            $notification,
            (string) $request->validated('signatory'),
            (string) $request->validated('notif_type'),
            $request->comment(),
        ));
    }

    /**
     * @return array<string, mixed>
     */
    private function authorize(
        Request $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
        bool $requireProponent,
    ): array {
        $item = $submissions->require($event, $submission);
        $proponentOrgKey = (string) ($events->handle($event)['GSI1PK'] ?? '');
        $access->authorize($item, CognitoIdentity::organizationId($request), $proponentOrgKey, requireProponent: $requireProponent);

        return $item;
    }
}
