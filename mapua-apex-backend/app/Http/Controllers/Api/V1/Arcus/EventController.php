<?php

namespace App\Http\Controllers\Api\V1\Arcus;

use App\Aws\DynamoDb\FinishSubmission;
use App\Aws\DynamoDb\ListPublishedEvents;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ArcusEventResource;
use App\Support\Arcus\EventWindow;
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

    public function finish(Request $request, string $event, string $submission, FinishSubmission $finish): ArcusEventResource
    {
        return new ArcusEventResource($finish->handle($event, $submission, $this->organizationId($request)));
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
