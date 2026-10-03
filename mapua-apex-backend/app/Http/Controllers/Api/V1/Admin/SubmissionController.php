<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\GetSubmissionAudit;
use App\Aws\DynamoDb\ScanSubmissions;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\SubmissionAuditResource;
use App\Http\Resources\Api\V1\SubmissionResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SubmissionController extends Controller
{
    public function index(Request $request, ScanSubmissions $scan): AnonymousResourceCollection
    {
        return SubmissionResource::collection($scan->handle([
            'status' => is_string($request->query('status')) ? $request->query('status') : null,
            'activity_type' => is_string($request->query('activity_type')) ? $request->query('activity_type') : null,
            'organization_id' => is_string($request->query('organization_id')) ? $request->query('organization_id') : null,
        ]));
    }

    public function show(string $event, string $submission, GetSubmissionAudit $audit): SubmissionAuditResource
    {
        return new SubmissionAuditResource($audit->handle($event, $submission));
    }
}
