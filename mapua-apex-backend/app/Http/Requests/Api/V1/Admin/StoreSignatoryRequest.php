<?php

namespace App\Http\Requests\Api\V1\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreSignatoryRequest extends FormRequest
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
            'role' => ['required', 'in:adviser,cdm,dean,osaar,admin'],
            'department' => ['exclude_unless:role,dean', 'nullable', 'string', 'max:32'],
        ];
    }
}
