<?php

namespace App\Http\Controllers\Api\V1\Public;

use App\Http\Controllers\Controller;
use App\Models\DynamoDB\AnnouncementRecords;

class AnnouncementController extends Controller
{
    public function __construct(
        private readonly AnnouncementRecords $announcementRecords
    ) {}

    /**
     * Display a listing of announcements for public viewing (unauthenticated).
     */
    public function index()
    {
        $records = $this->announcementRecords->list();

        // Sort descending by sent_at
        usort($records, function ($a, $b) {
            return strtotime($b['sent_at']) - strtotime($a['sent_at']);
        });

        return response()->json([
            'data' => $records,
        ]);
    }
}
