<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Aws\DynamoDb\ReservableSchedule;
use Illuminate\Foundation\Http\FormRequest;

class StoreBookingRequest extends FormRequest
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
            'selections' => ['required', 'array', 'min:1'],
            'selections.*.date' => ['required', 'date_format:Y-m-d'],
            'selections.*.slots' => ['required', 'array', 'min:1'],
            'selections.*.slots.*' => ['integer', 'between:0,'.(ReservableSchedule::SLOTS - 1)],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
