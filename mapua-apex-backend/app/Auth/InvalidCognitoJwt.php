<?php

namespace App\Auth;

use Illuminate\Contracts\Debug\ShouldntReport;
use RuntimeException;

class InvalidCognitoJwt extends RuntimeException implements ShouldntReport
{
    //
}
