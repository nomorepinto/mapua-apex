<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\OrganizationRecords;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\OrganizationResource;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function show(Request $request, OrganizationRecords $organizations): OrganizationResource
    {
        $item = $organizations->get(CognitoIdentity::organizationId($request));

        if ($item === null) {
            abort(404, 'Organization not found.');
        }

        return new OrganizationResource($item);
    }
}
