<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Aws\DynamoDb\ReservableSchedule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * CDM's resolution of a pending RESERVATION_CHANGE. Structural validation only:
 *   decision  — cancel | reschedule | deny
 *   comment   — required for a deny (and carried on the timeline row otherwise)
 *   bookings  — for a reschedule, one instruction per snapshotted hold, keyed by
 *               the hold's original {pk, sk}: keep (untouched), update (same
 *               reservable, new selections) or swap (new reservable + selections).
 *
 * The semantic requirements (selections present for update/swap, new_reservable_id
 * present for swap, slot availability, participant bounds) are enforced by
 * ResolveReservationChange so a conflict aborts with zero writes.
 */
class ResolveReservationChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', 'string', 'in:cancel,reschedule,deny'],
            'comment' => ['nullable', 'string', 'max:1000', 'required_if:decision,deny'],
            'bookings' => ['nullable', 'array'],
            'bookings.*.pk' => ['required', 'string'],
            'bookings.*.sk' => ['required', 'string'],
            'bookings.*.action' => ['required', 'string', 'in:keep,update,swap'],
            'bookings.*.selections' => ['nullable', 'array'],
            'bookings.*.selections.*.date' => ['required', 'date_format:Y-m-d'],
            'bookings.*.selections.*.slots' => ['required', 'array', 'min:1'],
            'bookings.*.selections.*.slots.*' => ['integer', 'between:0,'.(ReservableSchedule::SLOTS - 1)],
            'bookings.*.new_reservable_id' => ['nullable', 'string'],
        ];
    }
}
