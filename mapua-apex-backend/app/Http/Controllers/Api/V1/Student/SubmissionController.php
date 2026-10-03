<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\GetEvent;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\ListOrgSubmissions;
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
    public function index(Request $request, ListOrgSubmissions $list): AnonymousResourceCollection
    {
        return SubmissionResource::collection($list->handle(CognitoIdentity::organizationId($request)));
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
    ): SubmissionResource {
        $events->forOrganization($event, CognitoIdentity::organizationId($request));

        return new SubmissionResource($submissions->require($event, $submission));
    }

    public function update(
        UpdateSubmissionRequest $request,
        string $event,
        string $submission,
        WriteSubmission $write,
    ): SubmissionResource {
        $item = $write->update(CognitoIdentity::organizationId($request), $event, $submission, $request->validated());

        return new SubmissionResource($item);
    }
}
