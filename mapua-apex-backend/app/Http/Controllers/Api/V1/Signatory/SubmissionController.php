<?php

namespace App\Http\Controllers\Api\V1\Signatory;

use App\Aws\DynamoDb\ApproveSubmission;
use App\Aws\DynamoDb\BookingRecords;
use App\Aws\DynamoDb\DenySubmission;
use App\Aws\DynamoDb\DynamoDbItems;
use App\Aws\DynamoDb\DynamoKeys;
use App\Aws\DynamoDb\GetSubmission;
use App\Aws\DynamoDb\ListSignatoryHistory;
use App\Aws\DynamoDb\ListSignatoryQueue;
use App\Aws\DynamoDb\ReturnSubmission;
use App\Aws\DynamoDb\SignatoryChainResolver;
use App\Http\CognitoIdentity;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Signatory\DenySubmissionRequest;
use App\Http\Resources\Api\V1\SubmissionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SubmissionController extends Controller
{
    public function index(Request $request, ListSignatoryQueue $queue): AnonymousResourceCollection
    {
        return SubmissionResource::collection($queue->handle(CognitoIdentity::signatoryId($request)));
    }

    public function history(Request $request, ListSignatoryHistory $history): AnonymousResourceCollection
    {
        return SubmissionResource::collection($history->handle(CognitoIdentity::signatoryId($request)));
    }

    public function show(
        Request $request,
        string $event,
        string $submission,
        GetSubmission $submissions,
        SignatoryChainResolver $chain,
        ListSignatoryHistory $historyService,
    ): SubmissionResource {
        $item = $submissions->require($event, $submission);
        $this->requireVisible($item, CognitoIdentity::signatoryId($request), $event, $submission, $historyService);

        $item['signatory_chain'] = $chain->handle($item);

        return new SubmissionResource($item);
    }

    /**
     * Slots this paper's pending holds would collide with if approved now.
     */
    public function bookingConflicts(
        Request $request,
        string $event,
        string $submission,
        GetSubmission $submissions,
        ListSignatoryHistory $historyService,
        BookingRecords $bookings,
    ): JsonResponse {
        $item = $submissions->require($event, $submission);
        $this->requireVisible($item, CognitoIdentity::signatoryId($request), $event, $submission, $historyService);

        $refs = is_array($item['booking_refs'] ?? null) ? array_values($item['booking_refs']) : [];
        $expected = data_get($item, 'activity_details.expected_participants');

        return response()->json([
            'data' => $refs === [] ? [] : $bookings->conflictsForRefs($refs, is_numeric($expected) ? (int) $expected : null),
        ]);
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function requireVisible(
        array $item,
        string $signatoryId,
        string $event,
        string $submission,
        ListSignatoryHistory $historyService,
    ): void {
        $signatoryKey = DynamoKeys::signatory($signatoryId);

        $isOnDesk = ($item['current_signatory'] ?? null) === $signatoryKey;
        $inSequence = in_array($signatoryKey, (array) ($item['signatory_sequence'] ?? []), true);

        if ($isOnDesk || $inSequence) {
            return;
        }

        $eventKey = DynamoKeys::event($event);
        $subKey = DynamoKeys::submission($submission);

        foreach ($historyService->handle($signatoryId) as $h) {
            if (($h['PK'] ?? null) === $eventKey && ($h['SK'] ?? null) === $subKey) {
                return;
            }
        }

        abort(404);
    }

    public function approve(
        Request $request,
        string $event,
        string $submission,
        ApproveSubmission $approve,
    ): SubmissionResource {
        return new SubmissionResource($approve->handle(CognitoIdentity::signatoryId($request), $event, $submission));
    }

    public function deny(
        DenySubmissionRequest $request,
        string $event,
        string $submission,
        DenySubmission $deny,
    ): SubmissionResource {
        return new SubmissionResource($deny->handle(
            CognitoIdentity::signatoryId($request),
            $event,
            $submission,
            $request->validated('comment'),
        ));
    }

    public function returnForRevision(
        DenySubmissionRequest $request,
        string $event,
        string $submission,
        ReturnSubmission $return,
    ): SubmissionResource {
        return new SubmissionResource($return->handle(
            CognitoIdentity::signatoryId($request),
            $event,
            $submission,
            $request->validated('comment'),
        ));
    }

    public function updateClassification(
        Request $request,
        string $event,
        string $submission,
        GetSubmission $submissions,
        DynamoDbItems $items,
    ): SubmissionResource {
        $validated = $request->validate([
            'nature' => ['required', 'string', 'in:major,minor,Major,Minor'],
        ]);

        $item = $submissions->require($event, $submission);
        $signatory = CognitoIdentity::signatoryId($request);

        if (($item['current_signatory'] ?? null) !== 'SIGNATORY#'.$signatory) {
            abort(404);
        }

        $classification = is_array($item['activity_classification'] ?? null)
            ? $item['activity_classification']
            : [];
        $classification['nature'] = strtolower($validated['nature']);

        $items->patch(
            DynamoKeys::event($event),
            DynamoKeys::submission($submission),
            ['activity_classification' => $classification]
        );

        $item['activity_classification'] = $classification;

        return new SubmissionResource($item);
    }
}
