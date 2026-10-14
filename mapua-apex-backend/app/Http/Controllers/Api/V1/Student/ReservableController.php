<?php

namespace App\Http\Controllers\Api\V1\Student;

use App\Aws\DynamoDb\BookingRecords;
use App\Aws\DynamoDb\CampusRecords;
use App\Aws\DynamoDb\ReservableRecords;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\CampusResource;
use App\Http\Resources\Api\V1\ReservableAvailabilityResource;
use App\Http\Resources\Api\V1\ReservableResource;
use App\Support\AvailabilityWindow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only catalog for the SAAF reservation step: campuses, their reservables,
 * and live per-date availability.
 */
class ReservableController extends Controller
{
    public function campuses(CampusRecords $campuses): AnonymousResourceCollection
    {
        return CampusResource::collection($campuses->list());
    }

    public function index(string $campus, CampusRecords $campuses, ReservableRecords $reservables): AnonymousResourceCollection
    {
        $campuses->require($campus);

        return ReservableResource::collection($reservables->listByCampus($campus));
    }

    public function availability(
        Request $request,
        string $campus,
        string $reservable,
        ReservableRecords $reservables,
        BookingRecords $bookings,
    ): ReservableAvailabilityResource {
        $item = $reservables->require($campus, $reservable);
        ['start' => $start, 'end' => $end] = AvailabilityWindow::resolve($request);

        return new ReservableAvailabilityResource(array_merge(
            ['reservable' => $item],
            $bookings->availabilityFor($item, $start, $end),
        ));
    }
}
