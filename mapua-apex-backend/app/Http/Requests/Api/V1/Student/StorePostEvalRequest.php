<?php

namespace App\Http\Requests\Api\V1\Student;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Structural validation for filing a post-evaluation. Mirrors the SAAF request
 * convention: the FormRequest owns shape/limit rules (summary 100-500 chars,
 * per-item amounts capped at 5 digits) while WritePostEval owns the domain gates
 * (ownership, approved state, open window, one active post-eval per event).
 */
class StorePostEvalRequest extends FormRequest
{
    /**
     * Largest whole-peso amount accepted for a single line item (5 digits).
     */
    private const AMOUNT_MAX = 99999;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $amount = ['required', 'numeric', 'min:0', 'max:'.self::AMOUNT_MAX];
        $optionalAmount = ['nullable', 'numeric', 'min:0', 'max:'.self::AMOUNT_MAX];

        return [
            'event_id' => ['required', 'string', 'max:64'],
            'submission_id' => ['required', 'string', 'max:64'],
            'section_summary' => ['required', 'string', 'min:100', 'max:500'],
            'financial_report' => ['required', 'array'],
            'financial_report.budget_items' => ['present', 'array'],
            'financial_report.budget_items.*.item' => ['required', 'string', 'max:255'],
            'financial_report.budget_items.*.unit' => ['nullable'],
            'financial_report.budget_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'financial_report.budget_items.*.budgeted_total' => $optionalAmount,
            'financial_report.budget_items.*.actual_amount' => $amount,
            'financial_report.added_items' => ['present', 'array'],
            'financial_report.added_items.*.item' => ['required', 'string', 'max:255'],
            'financial_report.added_items.*.unit' => ['nullable'],
            'financial_report.added_items.*.quantity' => ['nullable', 'numeric', 'min:0'],
            'financial_report.added_items.*.price_per_unit' => $optionalAmount,
            'financial_report.added_items.*.actual_amount' => $amount,
            'financial_report.initial_grand_total' => ['nullable', 'numeric', 'min:0'],
            'financial_report.actual_grand_total' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'section_summary.min' => 'The event summary must be at least 100 characters.',
            'section_summary.max' => 'The event summary may not exceed 500 characters.',
            'financial_report.budget_items.*.actual_amount.max' => 'Each actual amount may not exceed 5 digits.',
            'financial_report.added_items.*.actual_amount.max' => 'Each actual amount may not exceed 5 digits.',
        ];
    }
}
