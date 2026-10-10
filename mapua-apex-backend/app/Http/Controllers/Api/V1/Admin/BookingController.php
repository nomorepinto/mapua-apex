<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\BookingRecords;
use App\Aws\DynamoDb\ReservableRecords;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\StoreBookingRequest;
use App\Http\Resources\Api\V1\BookingResource;
use App\Http\Resources\Api\V1\ReservableAvailabilityResource;
use App\Support\AvailabilityWindow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * CDM Reserve/View endpoints: read availability, list bookings, create and
 * release manual (source:cdm) holds.
 */
class BookingController extends Controller
{
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

    public function index(
        Request $request,
        string $campus,
        string $reservable,
        ReservableRecords $reservables,
        BookingRecords $bookings,
    ): AnonymousResourceCollection {
        $reservables->require($campus, $reservable);
        ['start' => $start, 'end' => $end] = AvailabilityWindow::resolve($request);

        return BookingResource::collection($bookings->listBookings($reservable, $start, $end));
    }

    public function store(
        StoreBookingRequest $request,
        string $campus,
        string $reservable,
        BookingRecords $bookings,
    ): JsonResponse {
        $validated = $request->validated();
        $item = $bookings->createManual(
            $campus,
            $reservable,
            $validated['selections'],
            CognitoIdentity::signatoryId($request),
            $validated['reason'] ?? null,
        );

        return (new BookingResource($item))->response()->setStatusCode(201);
    }

    public function destroy(string $campus, string $reservable, string $booking, BookingRecords $bookings): Response
    {
        $bookings->deleteBooking($reservable, $booking);

        return response()->noContent();
    }
}
