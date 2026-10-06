<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\ListCollaborationSubmissions;
use App\Aws\DynamoDb\ListOrgSubmissions;
use App\Aws\DynamoDb\SignatoryChainResolver;
use App\Aws\DynamoDb\SubmissionAccess;
use App\Aws\DynamoDb\WriteSubmission;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\StoreSubmissionRequest;
use App\Http\Requests\Api\V1\Student\UpdateSubmissionRequest;
use App\Http\Resources\Api\V1\SubmissionResource;
use App\Support\Email\SubmissionEmailer;
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

    public function store(StoreSubmissionRequest $request, WriteSubmission $write, SubmissionEmailer $emailer): JsonResponse
    {
        $item = $write->create(CognitoIdentity::organizationId($request), $request->validated());

        // Create writes no NOTIFICATION row, so the desk-1 routing email is fired here.
        $emailer->submitted($item);

        return (new SubmissionResource($item))->response()->setStatusCode(201);
    }

    public function show(
        Request $request,
        string $event,
        string $submission,
        GetEvent $events,
        GetSubmission $submissions,
        SubmissionAccess $access,
        SignatoryChainResolver $chain,
    ): SubmissionResource {
        $item = $submissions->require($event, $submission);
        $organizationId = CognitoIdentity::organizationId($request);
        $proponentOrgKey = (string) ($events->handle($event)['GSI1PK'] ?? '');
        $access->authorize($item, $organizationId, $proponentOrgKey);

        // Tag the view so dependents render read-only in the client.
        $item['role'] = $proponentOrgKey !== '' && $proponentOrgKey === DynamoKeys::organization($organizationId)
            ? 'proponent'
            : 'dependent';

        // The submission item carries the proponent org key on GSI1PK; fall back to
        // the event's key for legacy rows written before that field was stored.
        if (! isset($item['GSI1PK']) && $proponentOrgKey !== '') {
            $item['GSI1PK'] = $proponentOrgKey;
        }

        $item['signatory_chain'] = $chain->handle($item);

        return new SubmissionResource($item);
    }

    public function update(
        UpdateSubmissionRequest $request,
        string $event,
        string $submission,
        WriteSubmission $write,
        GetSubmission $submissions,
        SubmissionEmailer $emailer,
    ): SubmissionResource {
        // WriteSubmission::update enforces proponent ownership via the event's org
        // and rejects approved/denied papers, so dependents cannot edit or resubmit.
        $wasReturned = ($submissions->handle($event, $submission)['status'] ?? null) === 'returned';
        $item = $write->update(CognitoIdentity::organizationId($request), $event, $submission, $request->validated());

        // Only a resubmitted returned paper notifies its desk; plain edits of pending papers stay silent.
        if ($wasReturned) {
            $emailer->resubmitted($item);
        }

        return new SubmissionResource($item);
    }
}
