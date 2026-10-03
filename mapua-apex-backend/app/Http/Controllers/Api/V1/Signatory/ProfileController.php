<?php

namespace App\Http\Controllers\Api\V1\Signatory;

use App\Aws\DynamoDb\SignatoryRecords;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\SignatoryResource;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request, SignatoryRecords $signatories): SignatoryResource
    {
        $item = $signatories->get(CognitoIdentity::signatoryId($request));

        if ($item === null) {
            abort(404, 'Signatory not found.');
        }

        return new SignatoryResource($item);
    }
}
