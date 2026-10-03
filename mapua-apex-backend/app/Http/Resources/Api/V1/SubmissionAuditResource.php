<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;

class SubmissionAuditResource extends SubmissionResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = is_array($this->resource) ? $this->resource : [];

        return array_merge(parent::toArray($request), [
            'notifications' => NotificationResource::collection($item['notifications'] ?? [])->resolve(),
        ]);
    }
}
