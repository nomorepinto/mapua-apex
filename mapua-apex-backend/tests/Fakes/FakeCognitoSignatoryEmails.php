<?php

namespace Tests\Fakes;

use App\Support\Email\CognitoSignatoryEmails;
use Aws\CognitoIdentityProvider\CognitoIdentityProviderClient;

/**
 * Map-backed stand-in for the Cognito AdminListUsers lookup. The parent
 * constructor requires a client that is never called here; tests bind this
 * fake so the suite never touches the real user pool.
 */
final class FakeCognitoSignatoryEmails extends CognitoSignatoryEmails
{
    /**
     * @param  array<string, string>  $emails  signatory uuid => email
     */
    public function __construct(private array $emails = [])
    {
        parent::__construct(new CognitoIdentityProviderClient([
            'region' => 'us-east-1',
            'version' => 'latest',
            'credentials' => ['key' => 'test', 'secret' => 'test'],
        ]));
    }

    public function forSignatory(string $signatoryId): ?string
    {
        return $this->emails[$signatoryId] ?? null;
    }
}
