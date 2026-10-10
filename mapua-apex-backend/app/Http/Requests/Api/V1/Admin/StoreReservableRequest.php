<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Aws\DynamoDb\ReservableSchedule;
use Illuminate\Foundation\Http\FormRequest;

class StoreReservableRequest extends FormRequest
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
        $rules = [
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', 'in:room,equipment'],
            'schedule' => ['required', 'array'],
        ];

        // Each present day column must be exactly 12 booleans (one per 70-min slot).
        foreach (ReservableSchedule::days() as $day) {
            $rules["schedule.{$day}"] = ['sometimes', 'array', 'size:'.ReservableSchedule::SLOTS];
            $rules["schedule.{$day}.*"] = ['boolean'];
        }

        return $rules;
    }
}
