<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\MemberRecords;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Student\BulkStoreMembersRequest;
use App\Http\Requests\Api\V1\Student\StoreMemberRequest;
use App\Http\Requests\Api\V1\Student\UpdateMemberRequest;
use App\Http\Resources\Api\V1\MemberResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    /**
     * List all members belonging to the authenticated student's organization.
     */
    public function index(Request $request, MemberRecords $members): JsonResponse
    {
        $organizationId = CognitoIdentity::organizationId($request);
        $items = $members->list($organizationId);

        return MemberResource::collection($items)->response();
    }

    /**
     * Add a single member to the organization.
     */
    public function store(StoreMemberRequest $request, MemberRecords $members): JsonResponse
    {
        $organizationId = CognitoIdentity::organizationId($request);

        $item = $members->create(
            $organizationId,
            $request->validated('student_number'),
            $request->validated('lastname'),
            $request->validated('firstname'),
        );

        return (new MemberResource($item))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Bulk-add members (CSV import).
     */
    public function bulkStore(BulkStoreMembersRequest $request, MemberRecords $members): JsonResponse
    {
        $organizationId = CognitoIdentity::organizationId($request);

        $result = $members->bulkCreate($organizationId, $request->validated('members'));

        return response()->json([
            'created' => MemberResource::collection($result['created'])->resolve(),
            'failed' => $result['failed'],
        ], 201);
    }

    /**
     * Update a member's lastname/firstname.
     */
    public function update(UpdateMemberRequest $request, MemberRecords $members, string $studentId): JsonResponse
    {
        $organizationId = CognitoIdentity::organizationId($request);

        $item = $members->update(
            $organizationId,
            $studentId,
            $request->validated('lastname'),
            $request->validated('firstname'),
        );

        return (new MemberResource($item))->response();
    }

    /**
     * Remove a member from the organization.
     */
    public function destroy(Request $request, MemberRecords $members, string $studentId): JsonResponse
    {
        $organizationId = CognitoIdentity::organizationId($request);
        $members->delete($organizationId, $studentId);

        return response()->json(null, 204);
    }
}
