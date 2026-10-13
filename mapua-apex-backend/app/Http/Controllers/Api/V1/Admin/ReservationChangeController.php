<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\OrganizationRecords;
use App\Aws\DynamoDb\ReservationChangeRecords;
use App\Aws\DynamoDb\ResolveReservationChange;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Admin\ResolveReservationChangeRequest;
use App\Http\Resources\Api\V1\ReservationChangeResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * CDM reservation-change desk: the per-campus queue of student requests
 * (cancel/reschedule), a detail view, and the resolve endpoint that applies the
 * decision to the linked bookings + submission.
 */
class ReservationChangeController extends Controller
{
    public function index(
        Request $request,
        string $campus,
        ReservationChangeRecords $changes,
        GetSubmission $submissions,
        OrganizationRecords $organizations,
    ): AnonymousResourceCollection {
        $status = is_string($request->query('status')) ? $request->query('status') : null;
        $items = array_map(
            fn (array $change): array => $this->attachContext($change, $submissions, $organizations),
            $changes->listForCampus($campus, $status),
        );

        return ReservationChangeResource::collection(array_values($items));
    }

    public function show(
        string $campus,
        string $change,
        ReservationChangeRecords $changes,
        GetSubmission $submissions,
        OrganizationRecords $organizations,
    ): ReservationChangeResource {
        $item = $changes->findForCampus($campus, $change);

        if ($item === null) {
            abort(404);
        }

        return new ReservationChangeResource($this->attachContext($item, $submissions, $organizations));
    }

    public function resolve(
        ResolveReservationChangeRequest $request,
        string $campus,
        string $change,
        ResolveReservationChange $action,
        GetSubmission $submissions,
        OrganizationRecords $organizations,
    ): ReservationChangeResource {
        $resolved = $action->handle(
            $campus,
            $change,
            CognitoIdentity::signatoryId($request),
            $request->validated(),
        );

        return new ReservationChangeResource($this->attachContext($resolved, $submissions, $organizations));
    }

    /**
     * Ride the owning submission + organization name along so the resource can
     * denormalize the event title / org name (list) and expose the full snapshot
     * (detail) without a second client round-trip.
     *
     * @param  array<string, mixed>  $change
     * @return array<string, mixed>
     */
    private function attachContext(array $change, GetSubmission $submissions, OrganizationRecords $organizations): array
    {
        $eventId = (string) (DynamoKeys::strip($change['PK'] ?? null, 'EVENT#') ?? '');
        $submissionId = (string) ($change['submission_id'] ?? '');

        if ($eventId !== '' && $submissionId !== '') {
            $submission = $submissions->handle($eventId, $submissionId);

            if ($submission !== null) {
                $change['submission'] = $submission;
            }
        }

        $organizationId = (string) ($change['organization_id'] ?? '');

        if ($organizationId !== '') {
            $name = $organizations->get($organizationId)['name'] ?? null;

            if (is_string($name) && $name !== '') {
                $change['organization_name'] = $name;
            }
        }

        return $change;
    }
}
