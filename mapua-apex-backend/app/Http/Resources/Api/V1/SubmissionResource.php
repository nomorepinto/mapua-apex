<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class SubmissionResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];
        $organizationKey = $this->stringAttribute($item['GSI1PK'] ?? null);

        return [
            'event_id' => $this->idAfterPrefix($item['PK'] ?? null, 'EVENT#'),
            'submission_id' => $this->idAfterPrefix($item['SK'] ?? null, 'SUBMISSION#'),
            'GSI1PK' => $organizationKey,
            'organization_id' => $this->idAfterPrefix($organizationKey, 'ORGANIZATION#'),
            'organization_name' => $this->stringAttribute($item['organization_name'] ?? null),
            'submission_type' => $item['submission_type'] ?? null,
            'sent_at' => $item['sent_at'] ?? null,
            'status' => $item['status'] ?? null,
            'current_signatory' => $this->idAfterPrefix($item['current_signatory'] ?? null, 'SIGNATORY#'),
            'signatory_sequence' => array_values(array_filter(array_map(
                fn ($id): ?string => $this->idAfterPrefix($id, 'SIGNATORY#'),
                (array) ($item['signatory_sequence'] ?? []),
            ))),
            'activity_classification' => $item['activity_classification'] ?? null,
            'proponents' => $item['proponents'] ?? [],
            'activity_details' => $item['activity_details'] ?? null,
            'institutional_alignment' => $item['institutional_alignment'] ?? null,
            'detailed_budget_proposal' => $item['detailed_budget_proposal'] ?? null,
            'venue_reservation' => $item['venue_reservation'] ?? null,
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
