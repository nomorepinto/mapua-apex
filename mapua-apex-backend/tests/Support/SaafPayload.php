<?php

namespace Tests\Support;

final class SaafPayload
{
    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public static function valid(array $overrides = []): array
    {
        $eventDate = now()->addDays(14)->toDateString();

        return array_replace_recursive([
            'event_id' => 'e001',
            'submission_type' => 'saaf',
            'activity_classification' => [
                'activity_type' => 'extra-curricular',
                'total_org_members' => 42,
            ],
            'proponents' => [[
                'id' => 'p001',
                'position_title' => 'President',
                'first_name' => 'Nicole',
                'middle_name' => 'R',
                'last_name' => 'Santos',
                'suffix' => '',
                'student_number' => '2021-00123',
                'program_and_year' => 'BSCS-3',
                'date_of_submission' => now()->toDateString(),
                'department' => 'CCIS',
                'position_of_applicant' => 'President',
                'org_or_course_section' => 'Mapua Computing Society',
                'contact_number' => '09171234567',
                'email_address' => 'nsantos@mymail.mapua.edu.ph',
                'facebook_link' => 'fb.com/nicole.santos',
            ]],
            'activity_details' => [
                'title_and_nature' => 'Hack Night: Intro to Web Dev',
                'description' => 'A beginner-friendly hackathon night.',
                'objectives' => 'Introduce first-year students to web development.',
                'venue' => 'MPH 2nd Floor',
                'date_of_event' => $eventDate,
                'day_of_event' => 'Monday',
                'time_of_event' => '17:00',
                'expected_participants' => 60,
                'individual_contribution' => 0,
                'proposed_budget' => 5000,
            ],
            'institutional_alignment' => [
                'mission_statements' => [
                    'competitive' => true,
                    'research' => false,
                    'solutions' => true,
                ],
                'core_values_explanation' => 'Promotes collaboration and innovation.',
                'peo_explanation' => 'Builds technical competency outside curriculum.',
                'sdg_explanation' => 'Supports SDG 4: Quality Education.',
            ],
            'detailed_budget_proposal' => [
                'items' => [[
                    'item_no' => '1',
                    'unit' => 1,
                    'quantity' => 60,
                    'price_per_unit' => 50,
                    'total' => 3000,
                ]],
                'grand_total' => 3000,
            ],
            'venue_reservation' => [
                'has_reservation' => true,
                'equipment_requested' => [
                    'monoblock_chairs' => true,
                    'whiteboards' => false,
                    'tables' => true,
                    'rostrum' => false,
                    'flags_with_stand' => false,
                    'panel_boards' => false,
                    'others_specified' => '',
                ],
                'general_facilities' => [
                    'purpose' => 'Hackathon venue',
                    'items' => [[
                        'item' => 'MPH',
                        'date_of_use' => $eventDate,
                        'time_of_use' => '17:00',
                        'location' => 'MPH 2F',
                    ]],
                ],
                'function_rooms' => [
                    'purpose' => '',
                    'items' => [],
                ],
                'audiovisual_equipment' => [
                    'purpose' => 'Projector for demo',
                    'items' => [[
                        'date_needed' => $eventDate,
                        'time_needed' => '17:00',
                        'equipment_needed' => 'Projector',
                        'remarks' => '1 unit',
                    ]],
                ],
            ],
        ], $overrides);
    }
}
