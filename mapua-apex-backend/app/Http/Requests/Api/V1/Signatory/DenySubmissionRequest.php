<?php

namespace App\Http\Requests\Api\V1\Signatory;

use Illuminate\Foundation\Http\FormRequest;

class DenySubmissionRequest extends FormRequest
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
            'comment' => ['required', 'string', 'min:1', 'max:5000'],
        ];
    }
}
