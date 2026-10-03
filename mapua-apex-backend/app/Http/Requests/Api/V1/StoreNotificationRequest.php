<?php

namespace App\Http\Requests\Api\V1;

use App\Aws\DynamoDb\SignatoryRecords;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreNotificationRequest extends FormRequest
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
            'notif_type' => ['required', 'in:approved,fully approved,denied,returned'],
            'comment' => ['required_if:notif_type,denied,returned', 'nullable', 'string', 'max:5000'],
        ];

        if ($this->requiresSignatoryField()) {
            $rules['signatory'] = ['required', 'string', 'max:64'];
        }

        return $rules;
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty() || ! $this->requiresSignatoryField()) {
                    return;
                }

                $id = $this->input('signatory');

                if (! is_string($id) || $id === '') {
                    return;
                }

                $records = $this->container->make(SignatoryRecords::class);

                if ($records->get($id) === null) {
                    $validator->errors()->add('signatory', 'The selected signatory does not exist.');
                }
            },
        ];
    }

    public function comment(): string
    {
        $comment = $this->validated('comment');

        return is_string($comment) ? $comment : '';
    }

    protected function requiresSignatoryField(): bool
    {
        return $this->routeIs('v1.students.*');
    }
}
