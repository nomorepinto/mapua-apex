<?php

namespace App\Http\Resources\Api\V1;

use App\Support\Arcus\EventWindow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Lean projection of a published submission for the arcus companion apps.
 * Carries the event facts each app renders plus both stateless visibility
 * windows, computed per request (no stored open/close flags).
 */
class ArcusEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];
        $details = is_array($item['activity_details'] ?? null) ? $item['activity_details'] : [];

        return [
            'event_id' => $this->idAfterPrefix($item['PK'] ?? null, 'EVENT#'),
            'submission_id' => $this->idAfterPrefix($item['SK'] ?? null, 'SUBMISSION#'),
            'organization_id' => $this->idAfterPrefix($item['GSI1PK'] ?? null, 'ORGANIZATION#'),
            'organization_name' => $this->stringOrNull($item['organization_name'] ?? null),
            'status' => $this->stringOrNull($item['status'] ?? null),
            'title' => $this->stringOrNull($details['title_and_nature'] ?? null),
            'venue' => $this->stringOrNull($details['venue'] ?? null),
            'date_of_event' => $this->stringOrNull($details['date_of_event'] ?? null),
            'day_of_event' => $this->stringOrNull($details['day_of_event'] ?? null),
            'time_of_event' => $this->stringOrNull($details['time_of_event'] ?? null),
            'finished_at' => $this->stringOrNull($item['finished_at'] ?? null),
            'attendance' => EventWindow::for($item, EventWindow::ATTENDANCE),
            'evaluation' => EventWindow::for($item, EventWindow::EVALUATION),
        ];
    }

    private function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }

    private function idAfterPrefix(mixed $value, string $prefix): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        return Str::chopStart($value, $prefix);
    }
}
