<?php

namespace Tests\Feature\Http\Middleware;

use App\Auth\CognitoJwtVerifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\Fakes\FakeCognitoJwtVerifier;
use Tests\TestCase;

class AuthenticateCognitoJwtTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['cognito.jwt:student'])
            ->get('/api/_test/cognito', function (Request $request) {
                return [
                    'organization_id' => $request->attributes->get('cognito.organization_id'),
                    'signatory_id' => $request->attributes->get('cognito.signatory_id'),
                ];
            });
    }

    public function test_returns_401_when_jwt_is_missing(): void
    {
        $this->fakeCognitoJwt();

        $response = $this->getJson('/api/_test/cognito');

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated: Bearer token is missing.');
    }

    public function test_returns_401_when_jwt_is_invalid(): void
    {
        $this->fakeCognitoJwt(shouldFail: true);

        $response = $this->withToken('invalid-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated: Invalid Cognito token (Invalid token.).');
    }

    public function test_returns_401_when_organization_claim_is_missing(): void
    {
        $this->app->instance(CognitoJwtVerifier::class, new FakeCognitoJwtVerifier([
            'custom:organization_id' => '',
            'cognito:groups' => ['student'],
        ]));

        $response = $this->withToken('fake-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated: Missing custom:organization_id in Cognito token.');
    }

    public function test_returns_401_when_cognito_group_does_not_match_route_role(): void
    {
        $this->fakeCognitoJwt([
            'cognito:groups' => ['signatory'],
        ]);

        $response = $this->withToken('fake-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertUnauthorized()
            ->assertJsonPath('message', "Unauthenticated: User is not in the required 'student' or 'admin' Cognito group.");
    }

    public function test_allows_admin_group_on_a_student_route(): void
    {
        $this->fakeCognitoJwt([
            'cognito:groups' => ['admin'],
            'custom:organization_id' => '',
        ]);

        $response = $this->withToken('fake-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertOk();
    }

    public function test_rejects_osaar_group_on_a_student_route(): void
    {
        $this->fakeCognitoJwt([
            'cognito:groups' => ['osaar'],
            'custom:organization_id' => '',
        ]);

        $response = $this->withToken('fake-jwt')
            ->withHeaders(['X-Organization-Id' => 'a1b2'])
            ->getJson('/api/_test/cognito');

        $response->assertUnauthorized()
            ->assertJsonPath('message', "Unauthenticated: User is not in the required 'student' or 'admin' Cognito group.");
    }

    public function test_returns_503_when_jwks_is_unavailable(): void
    {
        $this->fakeCognitoJwt(jwksUnavailable: true);

        $response = $this->withToken('fake-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertStatus(503);
    }

    public function test_attaches_organization_id_from_claims(): void
    {
        $this->fakeCognitoJwt([
            'custom:organization_id' => 'ORGANIZATION#a1b2',
            'custom:signatory_id' => 'SIGNATORY#adv001',
        ]);

        $response = $this->withToken('fake-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertOk()
            ->assertExactJson([
                'organization_id' => 'a1b2',
                'signatory_id' => 'adv001',
            ]);
    }

    public function test_attaches_signatory_id_from_unprefixed_claim(): void
    {
        $this->fakeCognitoJwt([
            'custom:signatory_id' => '',
            'signatory_id' => 'SIGNATORY#adv001',
        ]);

        $response = $this->withToken('fake-jwt')
            ->getJson('/api/_test/cognito');

        $response->assertOk()
            ->assertJsonPath('signatory_id', 'adv001');
    }
}
