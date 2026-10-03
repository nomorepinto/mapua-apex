<?php

namespace App\Http\Requests\Api\V1\Student;

use App\Http\Requests\Api\V1\SaafSubmissionRules;
use Illuminate\Foundation\Http\FormRequest;

class StoreSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return SaafSubmissionRules::fields(requireEventId: true);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return SaafSubmissionRules::messages();
    }
}
