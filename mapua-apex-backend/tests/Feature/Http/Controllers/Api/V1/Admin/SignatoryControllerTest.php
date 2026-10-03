<?php

namespace Tests\Feature\Http\Controllers\Api\V1\Admin;

use Tests\Fakes\InMemoryDynamoDb;
use Tests\Support\DynamoFixtures;
use Tests\TestCase;

class SignatoryControllerTest extends TestCase
{
    public function test_lists_signatories(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');

        $response = $this->withAdminAuth()->getJson('/api/v1/admins/signatories');

        $response->assertOk()
            ->assertJsonPath('data.0.signatory_id', 'adv001')
            ->assertJsonPath('data.0.role', 'adviser');
    }

    public function test_creates_a_signatory_without_assigning_an_organization(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::organization($db);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/signatories', [
            'name' => 'Prof. Juan Dela Cruz',
            'role' => 'adviser',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.role', 'adviser')
            ->assertJsonPath('data.department', null)
            ->assertJsonPath('data.organization_id', null);

        $id = $response->json('data.signatory_id');
        $this->assertIsString($id);

        $stored = $db->find('SIGNATORY#'.$id, 'SIGNATORY#'.$id);
        $this->assertSame('Prof. Juan Dela Cruz', $stored['name'] ?? null);
        $this->assertSame('adviser', $stored['role'] ?? null);
        $this->assertSame('ROLE#ADVISER', $stored['GSI4PK'] ?? null);
        $this->assertSame('SIGNATORY#'.$id, $stored['GSI4SK'] ?? null);
        $this->assertArrayNotHasKey('organization_id', $stored);
        $this->assertArrayNotHasKey('department', $stored);

        $organization = $db->find('ORGANIZATION#a1b2', 'ORGANIZATION#a1b2');
        $this->assertSame([], $organization['signatories'] ?? null);
    }

    public function test_creates_a_dean_with_a_department_role_index(): void
    {
        $db = InMemoryDynamoDb::bind($this);

        $response = $this->withAdminAuth()->postJson('/api/v1/admins/signatories', [
            'name' => 'Dean Maria Santos',
            'role' => 'dean',
            'department' => 'soit',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.role', 'dean')
            ->assertJsonPath('data.department', 'SOIT');

        $id = $response->json('data.signatory_id');
        $this->assertIsString($id);

        $stored = $db->find('SIGNATORY#'.$id, 'SIGNATORY#'.$id);
        $this->assertSame('ROLE#DEAN#SOIT', $stored['GSI4PK'] ?? null);
        $this->assertSame('SOIT', $stored['department'] ?? null);
    }

    public function test_creates_osaar_and_admin_signatories(): void
    {
        $db = InMemoryDynamoDb::bind($this);

        $osaar = $this->withAdminAuth()->postJson('/api/v1/admins/signatories', [
            'name' => 'OSAAR Officer',
            'role' => 'osaar',
        ]);

        $osaar->assertCreated()
            ->assertJsonPath('data.role', 'osaar')
            ->assertJsonPath('data.department', null);

        $osaarId = $osaar->json('data.signatory_id');
        $this->assertIsString($osaarId);
        $storedOsaar = $db->find('SIGNATORY#'.$osaarId, 'SIGNATORY#'.$osaarId);
        $this->assertSame('ROLE#OSAAR', $storedOsaar['GSI4PK'] ?? null);

        $admin = $this->withAdminAuth()->postJson('/api/v1/admins/signatories', [
            'name' => 'Admin Signatory',
            'role' => 'admin',
        ]);

        $admin->assertCreated()
            ->assertJsonPath('data.role', 'admin');

        $adminId = $admin->json('data.signatory_id');
        $this->assertIsString($adminId);
        $storedAdmin = $db->find('SIGNATORY#'.$adminId, 'SIGNATORY#'.$adminId);
        $this->assertSame('ROLE#ADMIN', $storedAdmin['GSI4PK'] ?? null);
    }

    public function test_returns_422_when_the_role_is_invalid(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->postJson('/api/v1/admins/signatories', [
                'name' => 'Prof. Juan Dela Cruz',
                'role' => 'president',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_updates_a_signatory_by_id_without_rewriting_notifications_or_org_desks(): void
    {
        $db = InMemoryDynamoDb::bind($this);
        DynamoFixtures::signatory($db, 'adv001', 'adviser');
        $db->seed([
            'PK' => 'SUBMISSION#s001',
            'SK' => 'NOTIFICATION#2026-09-11T08:30:00Z',
            'signatory' => 'SIGNATORY#adv001',
            'notif_type' => 'denied',
            'comment' => 'historical snapshot',
        ]);

        $response = $this->withAdminAuth()->putJson('/api/v1/admins/signatories/adv001', [
            'name' => 'Prof. Juan Dela Cruz',
            'role' => 'dean',
            'department' => 'SOIT',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.signatory_id', 'adv001')
            ->assertJsonPath('data.role', 'dean')
            ->assertJsonPath('data.department', 'SOIT')
            ->assertJsonPath('data.organization_id', null);

        $stored = $db->find('SIGNATORY#adv001', 'SIGNATORY#adv001');
        $this->assertSame('ROLE#DEAN#SOIT', $stored['GSI4PK'] ?? null);
        $this->assertSame('SOIT', $stored['department'] ?? null);
        $this->assertArrayNotHasKey('organization_id', $stored);

        $notification = $db->find('SUBMISSION#s001', 'NOTIFICATION#2026-09-11T08:30:00Z');
        $this->assertSame('SIGNATORY#adv001', $notification['signatory'] ?? null);

        $organization = $db->find('ORGANIZATION#a1b2', 'ORGANIZATION#a1b2');
        $this->assertSame([
            ['role' => 'adviser', 'signatory_id' => 'adv001'],
        ], $organization['signatories'] ?? null);
    }

    public function test_returns_404_when_the_signatory_id_does_not_exist(): void
    {
        InMemoryDynamoDb::bind($this);

        $this->withAdminAuth()
            ->putJson('/api/v1/admins/signatories/missing', [
                'name' => 'Prof. Juan Dela Cruz',
                'role' => 'dean',
            ])
            ->assertNotFound();
    }
}
