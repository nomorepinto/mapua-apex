<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A student's request to cancel or reschedule the holds on an approved paper.
 * The reason is always required; a suggested date only makes sense (and is only
 * accepted) for a reschedule.
 */
class StoreReservationChangeRequest extends FormRequest
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
            'request_type' => ['required', 'string', 'in:cancel,reschedule'],
            'reason' => ['required', 'string', 'max:500'],
            'suggested_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // A suggested date is advisory and only meaningful for a reschedule; drop
        // it for a cancel so it never leaks into the stored snapshot.
        if ($this->input('request_type') !== 'reschedule') {
            $this->request->remove('suggested_date');
        }
    }
}
