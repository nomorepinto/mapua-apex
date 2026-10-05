<?php

namespace App\Http\Requests\Api\V1;

final class SaafSubmissionRules
{
    /**
     * @return array<string, list<string>>
     */
    public static function fields(bool $requireEventId = false): array
    {
        $rules = [
            'submission_type' => ['required', 'string', 'max:50'],
            'activity_classification' => ['required', 'array'],
            'activity_classification.activity_type' => ['required', 'in:co-curricular,extra-curricular'],
            'activity_classification.total_org_members' => ['required', 'integer', 'min:0'],
            'activity_classification.nature' => ['nullable', 'string', 'in:major,minor,Major,Minor'],
            'proponents' => ['required', 'array', 'min:1'],
            'proponents.*.id' => ['required', 'string', 'max:64'],
            'proponents.*.position_title' => ['nullable', 'string', 'max:100'],
            'proponents.*.first_name' => ['required', 'string', 'max:100'],
            'proponents.*.middle_name' => ['nullable', 'string', 'max:100'],
            'proponents.*.last_name' => ['required', 'string', 'max:100'],
            'proponents.*.suffix' => ['nullable', 'string', 'max:20'],
            'proponents.*.student_number' => ['required', 'string', 'max:50'],
            'proponents.*.program_and_year' => ['required', 'string', 'max:100'],
            'proponents.*.date_of_submission' => ['required', 'string', 'max:32'],
            'proponents.*.department' => ['required', 'string', 'max:100'],
            'proponents.*.position_of_applicant' => ['required', 'string', 'max:100'],
            'proponents.*.org_or_course_section' => ['required', 'string', 'max:150'],
            'proponents.*.contact_number' => ['required', 'string', 'max:30'],
            'proponents.*.email_address' => ['required', 'email', 'max:150'],
            'proponents.*.facebook_link' => ['nullable', 'string', 'max:255'],
            'collaboration' => ['nullable', 'array'],
            'collaboration.dependent_organization_ids' => ['nullable', 'array'],
            'collaboration.dependent_organization_ids.*' => ['string', 'max:64'],
            'activity_details' => ['required', 'array'],
            'activity_details.title_and_nature' => ['required', 'string', 'max:255'],
            'activity_details.description' => ['required', 'string'],
            'activity_details.objectives' => ['required', 'string'],
            'activity_details.venue' => ['required', 'string', 'max:255'],
            'activity_details.date_of_event' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.now()->addDays(10)->toDateString()],
            'activity_details.end_date_of_event' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:activity_details.date_of_event'],
            'activity_details.day_of_event' => ['nullable', 'string', 'max:32'],
            'activity_details.time_of_event' => ['required', 'string', 'max:32'],
            'activity_details.expected_participants' => ['required', 'integer', 'min:0'],
            'activity_details.individual_contribution' => ['required', 'numeric', 'min:0'],
            'activity_details.proposed_budget' => ['required', 'numeric', 'min:0'],
            'institutional_alignment' => ['required', 'array'],
            'institutional_alignment.mission_statements' => ['required', 'array'],
            'institutional_alignment.mission_statements.competitive' => ['required', 'boolean'],
            'institutional_alignment.mission_statements.research' => ['required', 'boolean'],
            'institutional_alignment.mission_statements.solutions' => ['required', 'boolean'],
            'institutional_alignment.core_values_explanation' => ['required', 'string'],
            'institutional_alignment.peo_explanation' => ['required', 'string'],
            'institutional_alignment.sdg_explanation' => ['required', 'string'],
            'detailed_budget_proposal' => ['required', 'array'],
            'detailed_budget_proposal.items' => ['required', 'array', 'min:1'],
            'detailed_budget_proposal.items.*.item_no' => ['required', 'string', 'max:32'],
            'detailed_budget_proposal.items.*.unit' => ['required'],
            'detailed_budget_proposal.items.*.quantity' => ['required', 'numeric', 'min:0'],
            'detailed_budget_proposal.items.*.price_per_unit' => ['required', 'numeric', 'min:0'],
            'detailed_budget_proposal.items.*.total' => ['required', 'numeric', 'min:0'],
            'detailed_budget_proposal.grand_total' => ['required', 'numeric', 'min:0'],
            'venue_reservation' => ['required', 'array'],
            'venue_reservation.has_reservation' => ['required', 'boolean'],
            'venue_reservation.equipment_requested' => ['required', 'array'],
            'venue_reservation.equipment_requested.items' => ['sometimes', 'array'],
            'venue_reservation.equipment_requested.items.*.name' => ['required', 'string', 'max:100'],
            'venue_reservation.general_facilities' => ['required', 'array'],
            'venue_reservation.function_rooms' => ['required', 'array'],
            'venue_reservation.audiovisual_equipment' => ['required', 'array'],
        ];

        if ($requireEventId) {
            $rules['event_id'] = ['required', 'string', 'max:64'];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'activity_details.date_of_event.after_or_equal' => 'The date of event must be at least 10 days from today.',
            'activity_details.date_of_event.date_format' => 'The date of event must be a valid date (YYYY-MM-DD).',
            'activity_details.end_date_of_event.after_or_equal' => 'The end date of event must be on or after the start date.',
            'activity_details.end_date_of_event.date_format' => 'The end date of event must be a valid date (YYYY-MM-DD).',
        ];
    }
}
