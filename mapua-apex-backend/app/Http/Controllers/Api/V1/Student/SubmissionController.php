<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\ListCollaborationSubmissions;
use App\Aws\DynamoDb\ListOrgSubmissions;
use App\Aws\DynamoDb\SubmissionAccess;
use App\Aws\DynamoDb\WriteSubmission;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\StoreSubmissionRequest;
use App\Http\Requests\Api\V1\Student\UpdateSubmissionRequest;
use App\Http\Resources\Api\V1\SubmissionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SubmissionController extends Controller
{
    public function index(
        Request $request,
        ListOrgSubmissions $list,
        ListCollaborationSubmissions $collaborations,
    ): AnonymousResourceCollection {
        $organizationId = CognitoIdentity::organizationId($request);

        $proponentItems = $list->handle($organizationId);

        foreach ($proponentItems as &$item) {
            $item['role'] = 'proponent';
        }

        unset($item);

        $items = array_merge($proponentItems, $collaborations->handle($organizationId));

        // De-duplicate on submission id, then order newest first.
        $unique = [];

        foreach ($items as $item) {
            $key = ($item['PK'] ?? '').'|'.($item['SK'] ?? '');
            $unique[$key] = $item;
        }

        usort($unique, static fn (array $a, array $b): int => strcmp(
            (string) ($b['sent_at'] ?? ''),
            (string) ($a['sent_at'] ?? ''),
        ));

        return SubmissionResource::collection(array_values($unique));
    }

    public function store(StoreSubmissionRequest $request, WriteSubmission $write): JsonResponse
    {
        $item = $write->create(CognitoIdentity::organizationId($request), $request->validated());

        return (new SubmissionResource($item))->response()->setStatusCode(201);
    }

    public function show(
        Request $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
    ): SubmissionResource {
        $item = $submissions->require($event, $submission);
        $organizationId = CognitoIdentity::organizationId($request);
        $proponentOrgKey = (string) ($events->handle($event)['GSI1PK'] ?? '');
        $access->authorize($item, $organizationId, $proponentOrgKey);

        // Tag the view so dependents render read-only in the client.
        $item['role'] = $proponentOrgKey !== '' && $proponentOrgKey === DynamoKeys::organization($organizationId)
            ? 'proponent'
            : 'dependent';

        return new SubmissionResource($item);
    }

    public function update(
        UpdateSubmissionRequest $request,
        string $event,
        string $submission,
        WriteSubmission $write,
    ): SubmissionResource {
        // WriteSubmission::update enforces proponent ownership via the event's org
        // and rejects approved/denied papers, so dependents cannot edit or resubmit.
        $item = $write->update(CognitoIdentity::organizationId($request), $event, $submission, $request->validated());

        return new SubmissionResource($item);
    }
}
