<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class StoreMemberRequest extends FormRequest
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
            'student_number' => ['required', 'string', 'max:32'],
            'lastname' => ['required', 'string', 'max:64'],
            'firstname' => ['required', 'string', 'max:64'],
        ];
    }
}
