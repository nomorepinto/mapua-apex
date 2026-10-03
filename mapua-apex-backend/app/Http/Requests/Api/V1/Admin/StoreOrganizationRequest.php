<?php

namespace App\Http\Requests\Api\V1\Admin;

use App\Aws\DynamoDb\SignatoryRecords;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreOrganizationRequest extends FormRequest
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
            'is_higher_council' => ['sometimes', 'boolean'],
            'signatories' => ['sometimes', 'array'],
            'signatories.*.role' => ['required', 'in:adviser,cdm,dean,osaar,admin', 'distinct'],
            'signatories.*.signatory_id' => ['required', 'string', 'max:64', 'distinct'],
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $entries = $this->input('signatories', []);

                if (! is_array($entries)) {
                    return;
                }

                $records = $this->container->make(SignatoryRecords::class);

                foreach ($entries as $index => $entry) {
                    if (! is_array($entry)) {
                        continue;
                    }

                    $id = $entry['signatory_id'] ?? null;

                    if (! is_string($id) || $id === '' || $validator->errors()->has("signatories.{$index}.signatory_id")) {
                        continue;
                    }

                    if ($records->get($id) === null) {
                        $validator->errors()->add(
                            "signatories.{$index}.signatory_id",
                            'The selected signatory does not exist.',
                        );
                    }
                }
            },
        ];
    }
}
