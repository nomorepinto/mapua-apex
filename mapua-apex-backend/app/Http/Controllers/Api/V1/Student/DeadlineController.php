<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\ListOrgDeadlines;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\DeadlineResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DeadlineController extends Controller
{
    public function index(Request $request, ListOrgDeadlines $deadlines): AnonymousResourceCollection
    {
        return DeadlineResource::collection($deadlines->handle(CognitoIdentity::organizationId($request)));
    }
}
