<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\RequestReservationChange;
use App\Aws\DynamoDb\ReservationChangeRecords;
use App\Aws\DynamoDb\SubmissionAccess;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\StoreReservationChangeRequest;
use App\Http\Resources\Api\V1\ReservationChangeResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Student side of the reservation change loop: request a cancel/reschedule on an
 * approved paper's holds, and read back the paper's request history.
 */
class ReservationChangeController extends Controller
{
    public function store(
        StoreReservationChangeRequest $request,
        string $event,
        string $submission,
        RequestReservationChange $action,
    ): JsonResponse {
        $validated = $request->validated();
        $change = $action->handle(
            CognitoIdentity::organizationId($request),
            'STUDENT#'.(string) $request->attributes->get('cognito.sub'),
            $event,
            $submission,
            (string) $validated['request_type'],
            (string) $validated['reason'],
            isset($validated['suggested_date']) ? (string) $validated['suggested_date'] : null,
        );

        return (new ReservationChangeResource($change))->response()->setStatusCode(201);
    }

    public function index(
        Request $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
        ReservationChangeRecords $changes,
    ): AnonymousResourceCollection {
        $item = $submissions->require($event, $submission);
        $organizationId = CognitoIdentity::organizationId($request);
        $proponentOrgKey = (string) ($events->handle($event)['GSI1PK'] ?? '');
        $access->authorize($item, $organizationId, $proponentOrgKey);

        return ReservationChangeResource::collection($changes->listForSubmission($event, $submission));
    }
}
