<?php

namespace App\Http\Controllers\Api\V1\Arcus;

use App\Aws\DynamoDb\AggregateEventParticipants;
use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetEventPostEval;
use App\Aws\DynamoDb\ListPublishedEvents;
use App\Aws\DynamoDb\ListStudentAttendedEvents;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ArcusEventResource;
use App\Support\Arcus\EventWindow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Service-to-service endpoints for the arcus companion apps. Guarded by the
 * arcus.service shared-secret middleware (see AuthenticateArcusService); not
 * reachable with a normal Cognito user JWT.
 */
class EventController extends Controller
{
    public function index(Request $request, ListPublishedEvents $events): AnonymousResourceCollection
    {
        return ArcusEventResource::collection(
            $events->handle($this->organizationId($request), $this->window($request))
        );
    }

    /**
     * Events the given student attended that are still inside the requested
     * window. The studentId is forwarded by arcus-evaluation from its verified
     * `custom:student_id` claim, matching the X-Arcus-Organization-Id trust
     * model (the arcus server, not the browser, asserts identity).
     */
    public function studentEvents(
        Request $request,
        string $studentId,
        ListStudentAttendedEvents $attended,
    ): AnonymousResourceCollection {
        $studentId = trim($studentId);

        if ($studentId === '') {
            abort(400, 'A student id is required.');
        }

        return ArcusEventResource::collection(
            $attended->handle($studentId, $this->window($request))
        );
    }

    /**
     * Officer per-event view: the participant attendance + evaluations captured
     * by the arcus apps, plus this event's apex POSTEVAL review status. Scoped
     * to the caller's organization when the X-Arcus-Organization-Id header is
     * present (admin callers omit it to act across all organizations).
     */
    public function eventPostEval(
        Request $request,
        string $eventId,
        GetEventPostEval $postEval,
        AggregateEventParticipants $participants,
    ): JsonResponse {
        $eventId = trim($eventId);

        if ($eventId === '') {
            abort(400, 'An event id is required.');
        }

        $context = $postEval->handle($eventId);
        $submission = $context['submission'];

        if (! is_array($submission)) {
            abort(404, 'Event not found.');
        }

        $organizationId = $this->organizationId($request);

        if ($organizationId !== null
            && ($submission['GSI1PK'] ?? null) !== DynamoKeys::organization($organizationId)) {
            abort(403, 'This event belongs to another organization.');
        }

        $aggregate = $participants->handle($eventId);

        return response()->json([
            'event_id' => $eventId,
            'submission_id' => DynamoKeys::strip($submission['SK'] ?? null, 'SUBMISSION#'),
            'organization_id' => DynamoKeys::strip($submission['GSI1PK'] ?? null, 'ORGANIZATION#'),
            'attendance_count' => $aggregate['attendance_count'],
            'attendance' => $aggregate['attendance'],
            'evaluation_count' => $aggregate['evaluation_count'],
            'evaluations' => $aggregate['evaluations'],
            'post_eval' => $this->postEvalPayload($context['post_eval']),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $item
     * @return array<string, mixed>
     */
    private function postEvalPayload(?array $item): array
    {
        if (! is_array($item)) {
            return [
                'posteval_id' => null,
                'status' => 'none',
                'submitted_at' => null,
                'approved_at' => null,
                'denied_at' => null,
            ];
        }

        return [
            'posteval_id' => DynamoKeys::strip($item['SK'] ?? null, 'POSTEVAL#'),
            'status' => $this->stringOrNull($item['status'] ?? null) ?? 'none',
            'submitted_at' => $this->stringOrNull($item['submitted_at'] ?? null),
            'approved_at' => $this->stringOrNull($item['approved_at'] ?? null),
            'denied_at' => $this->stringOrNull($item['denied_at'] ?? null),
        ];
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function window(Request $request): string
    {
        return $request->query('window') === EventWindow::EVALUATION
            ? EventWindow::EVALUATION
            : EventWindow::ATTENDANCE;
    }

    private function organizationId(Request $request): ?string
    {
        $organizationId = $request->attributes->get('arcus.organization_id');

        return is_string($organizationId) && $organizationId !== '' ? $organizationId : null;
    }
}
