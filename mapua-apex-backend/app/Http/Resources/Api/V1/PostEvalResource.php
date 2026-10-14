<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Projection of a POSTEVAL item for both the student dashboard/detail views and
 * the OSAAR review queue. Index payloads stay lean: the heavy participation
 * snapshot and financial report are always present on the stored item, so they
 * are echoed as-is (the client renders whichever sections it needs).
 */
class PostEvalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];
        $organizationKey = $this->stringAttribute($item['GSI1PK'] ?? null);

        return [
            'event_id' => $this->idAfterPrefix($item['PK'] ?? null, 'EVENT#'),
            'posteval_id' => $this->idAfterPrefix($item['SK'] ?? null, 'POSTEVAL#'),
            'submission_id' => $this->stringAttribute($item['submission_id'] ?? null),
            'organization_id' => $this->idAfterPrefix($organizationKey, 'ORGANIZATION#'),
            'organization_name' => $this->stringAttribute($item['organization_name'] ?? null),
            'status' => $this->stringAttribute($item['status'] ?? null),
            'event_title' => $this->stringAttribute($item['event_title'] ?? null),
            'submitted_at' => $this->stringAttribute($item['submitted_at'] ?? null),
            'approved_at' => $this->stringAttribute($item['approved_at'] ?? null),
            'denied_at' => $this->stringAttribute($item['denied_at'] ?? null),
            'section_summary' => $this->stringAttribute($item['section_summary'] ?? null),
            'financial_report' => $item['financial_report'] ?? null,
            'participation_snapshot' => $item['participation_snapshot'] ?? null,
            // Detail-only: a live re-aggregation of the event's attendance and
            // evaluations, attached by the student show route so the submitter
            // sees current numbers alongside the frozen snapshot they filed with.
            'participation' => $this->when(
                array_key_exists('participation', $item),
                fn () => $item['participation'] ?? null,
            ),
        ];
    }

    private function stringAttribute(mixed $value): ?string
    {
        if (is_string($value) && $value !== '') {
            return $value;
        }

        if (is_array($value) && is_string($value['S'] ?? null) && $value['S'] !== '') {
            return $value['S'];
        }

        return null;
    }

    private function idAfterPrefix(mixed $value, string $prefix): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        return Str::chopStart($value, $prefix);
    }
}
