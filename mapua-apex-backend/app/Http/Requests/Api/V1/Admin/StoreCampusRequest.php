<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Aws\DynamoDb\CampusClassroomNaming;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreCampusRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:150'],
            // Classroom naming format (optional). Both halves must be supplied
            // together; CDM rooms flagged classroom are matched against them.
            'classroom_name_prefixes' => ['nullable', 'array', 'max:'.CampusClassroomNaming::MAX_PREFIXES],
            'classroom_name_prefixes.*' => ['string', 'regex:/^[A-Za-z]{1,10}$/'],
            'classroom_name_digits' => ['nullable', 'integer', 'min:1', 'max:'.CampusClassroomNaming::MAX_DIGITS],
        ];
    }

    /**
     * Cross-field rule: the prefix list and the digit count are a pair — one is
     * meaningless without the other.
     *
     * @return Closure(Validator): void
     */
    public function after(Validator $validator): Closure
    {
        return function (Validator $validator): void {
            $prefixes = $this->input('classroom_name_prefixes');
            $digits = $this->input('classroom_name_digits');

            $hasPrefixes = is_array($prefixes) && array_filter(array_map('trim', $prefixes)) !== [];
            $hasDigits = $digits !== null && $digits !== '';

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($hasPrefixes !== $hasDigits) {
                $field = $hasPrefixes ? 'classroom_name_digits' : 'classroom_name_prefixes';
                $validator->errors()->add($field, 'The classroom name format needs both the prefix list and the digit count.');
            }
        };
    }
}
