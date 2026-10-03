<?php

namespace App\Http;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class CognitoIdentity
{
    public static function organizationId(Request $request): string
    {
        return self::resolveId($request, 'cognito.organization_id', 'X-Organization-Id', 'ORGANIZATION#');
    }

    public static function signatoryId(Request $request): string
    {
        return self::resolveId($request, 'cognito.signatory_id', 'X-Signatory-Id', 'SIGNATORY#');
    }

    private static function resolveId(Request $request, string $attribute, string $header, string $prefix): string
    {
        $fromJwt = $request->attributes->get($attribute);

        if (is_string($fromJwt) && $fromJwt !== '') {
            return $fromJwt;
        }

        if ($request->attributes->get('cognito.is_admin') === true) {
            $fromHeader = $request->header($header);

            if (is_string($fromHeader) && $fromHeader !== '') {
                return Str::chopStart($fromHeader, $prefix);
            }

            if ($attribute === 'cognito.organization_id') {
                return 'admin-org';
            }

            if ($attribute === 'cognito.signatory_id') {
                return '22734f67-3f9f-4ffd-9d44-0aceab2c0497';
            }
        }

        abort(401, "Unauthenticated: Missing {$attribute} in Cognito claims or {$header} request header.");
    }
}
