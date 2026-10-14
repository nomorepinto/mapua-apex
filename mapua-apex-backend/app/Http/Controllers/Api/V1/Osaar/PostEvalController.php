<?php

namespace App\Http\Controllers\Api\V1\Osaar;

use App\Aws\DynamoDb\ApprovePostEval;
use App\Aws\DynamoDb\DenyPostEval;
use App\Aws\DynamoDb\GetPostEval;
use App\Aws\DynamoDb\ScanPostEvals;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\PostEvalResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * OSAAR post-evaluation review desk. Post-evals route directly to OSAAR (no
 * other signatories), so this is a cross-organization queue: approve finishes
 * the linked submission, deny leaves it approved. Guarded by cognito.jwt:admin
 * (the SPA maps the osaar role onto the admin API key).
 */
class PostEvalController extends Controller
{
    public function index(Request $request, ScanPostEvals $scan): AnonymousResourceCollection
    {
        return PostEvalResource::collection($scan->handle([
            'status' => is_string($request->query('status')) ? $request->query('status') : null,
            'organization_id' => is_string($request->query('organization_id')) ? $request->query('organization_id') : null,
        ]));
    }

    public function show(string $event, string $posteval, GetPostEval $postEvals): PostEvalResource
    {
        return new PostEvalResource($postEvals->require($event, $posteval));
    }

    public function approve(string $event, string $posteval, ApprovePostEval $approve): PostEvalResource
    {
        return new PostEvalResource($approve->handle($event, $posteval));
    }

    public function deny(string $event, string $posteval, DenyPostEval $deny): PostEvalResource
    {
        return new PostEvalResource($deny->handle($event, $posteval));
    }
}
