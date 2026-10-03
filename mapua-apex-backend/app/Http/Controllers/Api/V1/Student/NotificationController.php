<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\ListSubmissionNotifications;
use App\Aws\DynamoDb\NotificationRecords;
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
        ListSubmissionNotifications $notifications,
    ): AnonymousResourceCollection {
        $this->submissionInOrganization($request, $event, $submission, $events, $submissions);

        return NotificationResource::collection($notifications->handle($submission));
    }

    public function store(
        StoreNotificationRequest $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        NotificationRecords $notifications,
    ): JsonResponse {
        $this->submissionInOrganization($request, $event, $submission, $events, $submissions);

        $item = $notifications->create(
            $submission,
            (string) $request->validated('signatory'),
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
        GetEvent $events,
        GetSubmission $submissions,
        NotificationRecords $notifications,
    ): NotificationResource {
        $this->submissionInOrganization($request, $event, $submission, $events, $submissions);

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
    private function submissionInOrganization(
        Request $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
    ): array {
        $events->forOrganization($event, CognitoIdentity::organizationId($request));

        return $submissions->require($event, $submission);
    }
}
