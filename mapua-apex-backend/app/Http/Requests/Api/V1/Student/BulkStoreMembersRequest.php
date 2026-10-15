<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

class BulkStoreMembersRequest extends FormRequest
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
            'members' => ['required', 'array', 'max:500'],
            'members.*.student_number' => ['required', 'string', 'max:32'],
            'members.*.lastname' => ['required', 'string', 'max:64'],
            'members.*.firstname' => ['required', 'string', 'max:64'],
        ];
    }
}
