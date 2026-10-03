<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\AnnouncementRecords;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\AnnouncementResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AnnouncementController extends Controller
{
    public function index(AnnouncementRecords $announcements): AnonymousResourceCollection
    {
        return AnnouncementResource::collection($announcements->list());
    }
}
