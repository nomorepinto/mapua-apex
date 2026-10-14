<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\AggregateEventParticipants;
use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetPostEval;
use App\Aws\DynamoDb\ListEligiblePostEvalEvents;
use App\Aws\DynamoDb\ListOrgPostEvals;
use App\Aws\DynamoDb\WritePostEval;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\StorePostEvalRequest;
use App\Http\Resources\Api\V1\PostEvalResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Organization-submitter post-evaluation endpoints. Every route resolves the
 * organization from the Cognito JWT (never a client header for a student token)
 * and scopes reads/writes to it, so a submitter can only see and file for their
 * own organization's events.
 */
class PostEvalController extends Controller
{
    /**
     * Step-1 picker: passed, still-in-window events with no active post-eval.
     */
    public function events(Request $request, ListEligiblePostEvalEvents $eligible): JsonResponse
    {
        return response()->json([
            'data' => $eligible->handle(CognitoIdentity::organizationId($request)),
        ]);
    }

    /**
     * Dashboard table: every post-eval the organization has filed.
     */
    public function index(Request $request, ListOrgPostEvals $list): AnonymousResourceCollection
    {
        return PostEvalResource::collection($list->handle(CognitoIdentity::organizationId($request)));
    }

    public function store(StorePostEvalRequest $request, WritePostEval $write): JsonResponse
    {
        $item = $write->create(CognitoIdentity::organizationId($request), $request->validated());

        return (new PostEvalResource($item))->response()->setStatusCode(201);
    }

    /**
     * Detail view: the filed post-eval plus a live re-aggregation of the event's
     * attendance/evaluations so the submitter sees current numbers.
     */
    public function show(
        Request $request,
        string $event,
        string $posteval,
        GetPostEval $postEvals,
        AggregateEventParticipants $participants,
    ): PostEvalResource {
        $item = $postEvals->forOrganization($event, $posteval, CognitoIdentity::organizationId($request));
        $item['participation'] = $participants->handle($event);

        return new PostEvalResource($item);
    }

    /**
     * Wizard Section 3 preview: live attendance + evaluation aggregation for an
     * event the organization owns, before any post-eval exists.
     */
    public function participants(
        Request $request,
        string $event,
        GetEvent $events,
        AggregateEventParticipants $participants,
    ): JsonResponse {
        $events->forOrganization($event, CognitoIdentity::organizationId($request));

        return response()->json([
            'data' => $participants->handle($event),
        ]);
    }
}
