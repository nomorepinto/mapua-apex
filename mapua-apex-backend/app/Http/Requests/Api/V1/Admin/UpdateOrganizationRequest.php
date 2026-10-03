<?php

namespace App\Http\Requests\Api\V1\Admin;

class UpdateOrganizationRequest extends StoreOrganizationRequest
{
    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['signatories'] = ['present', 'array'];

        return $rules;
    }
}
