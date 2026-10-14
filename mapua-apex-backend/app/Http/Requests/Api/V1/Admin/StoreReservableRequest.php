<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Aws\DynamoDb\CampusClassroomNaming;
use App\Aws\DynamoDb\CampusRecords;
use App\Aws\DynamoDb\ReservableSchedule;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

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
            // Participant bounds apply to rooms only; equipment ignores them.
            // Absent/null means the room carries no limit.
            'min_participants' => ['nullable', 'integer', 'min:1', 'max:3000'],
            'max_participants' => ['nullable', 'integer', 'min:1', 'max:3000'],
            // Room-only classroom flag; when set the name must match the campus
            // classroom naming format. Dropped for equipment at write time.
            'is_classroom' => ['nullable', 'boolean'],
        ];

        // Each present day column must be exactly 12 booleans (one per 70-min slot).
        foreach (ReservableSchedule::days() as $day) {
            $rules["schedule.{$day}"] = ['sometimes', 'array', 'size:'.ReservableSchedule::SLOTS];
            $rules["schedule.{$day}.*"] = ['boolean'];
        }

        return $rules;
    }

    /**
     * Cross-field rules:
     *  - a room's lower bound can never exceed its upper bound;
     *  - a room flagged classroom must satisfy its campus's naming format.
     *
     * @return Closure(Validator): void
     */
    public function after(Validator $validator): Closure
    {
        return function (Validator $validator): void {
            $min = $this->input('min_participants');
            $max = $this->input('max_participants');

            if (is_numeric($min) && is_numeric($max) && (int) $min > (int) $max) {
                $validator->errors()->add('min_participants', 'The minimum participants cannot exceed the maximum.');
            }

            if ($this->input('type') !== 'room' || ! filter_var($this->input('is_classroom'), FILTER_VALIDATE_BOOLEAN)) {
                return;
            }

            $campusId = $this->route('campus');
            $campus = $campusId ? app(CampusRecords::class)->get((string) $campusId) : null;
            $prefixes = $campus !== null ? CampusClassroomNaming::prefixes($campus) : [];
            $digits = $campus !== null ? CampusClassroomNaming::digits($campus) : null;

            if ($prefixes === [] || $digits === null) {
                $validator->errors()->add('is_classroom', 'This campus has no classroom name format configured yet.');

                return;
            }

            $name = (string) $this->input('name');

            if (! CampusClassroomNaming::matches($prefixes, $digits, $name)) {
                $validator->errors()->add(
                    'name',
                    'A classroom room must be named with one of '.implode(', ', $prefixes).' followed by exactly '.$digits.' digits.'
                );
            }
        };
    }
}
