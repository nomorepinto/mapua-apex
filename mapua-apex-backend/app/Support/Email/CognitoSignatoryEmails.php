<?php

namespace App\Support\Email;

use Aws\CognitoIdentityProvider\CognitoIdentityProviderClient;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Log;
use Throwable;

class CognitoSignatoryEmails
{
    public function __construct(private CognitoIdentityProviderClient $cognito) {}

    /**
     * Resolve a signatory uuid to the email of the Cognito user carrying that
     * custom:signatory_id attribute. Null when unresolvable; never throws.
     */
    public function forSignatory(string $signatoryId): ?string
    {
        $poolId = (string) config('aws.cognito.user_pool_id', '');

        if ($poolId === '') {
            Log::warning('Signatory email lookup skipped: AWS_COGNITO_USER_POOL_ID is not configured.', [
                'signatory_id' => $signatoryId,
            ]);

            return null;
        }

        try {
            $result = $this->cognito->adminListUsers([
                'UserPoolId' => $poolId,
                'Filter' => 'custom:signatory_id = "'.$signatoryId.'"',
                'Limit' => 1,
            ]);

            return $this->emailOf($result['Users'][0] ?? null);
        } catch (AwsException $e) {
            Log::warning('Signatory email lookup failed.', [
                'signatory_id' => $signatoryId,
                'error' => $e->getMessage(),
            ]);

            return null;
        } catch (Throwable $e) {
            Log::warning('Signatory email lookup failed unexpectedly.', [
                'signatory_id' => $signatoryId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * @param  array<string, mixed>|null  $user
     */
    private function emailOf(?array $user): ?string
    {
        foreach ($user['Attributes'] ?? [] as $attribute) {
            if (is_array($attribute) && ($attribute['Name'] ?? null) === 'email') {
                $value = $attribute['Value'] ?? null;

                return is_string($value) && $value !== '' ? $value : null;
            }
        }

        return null;
    }
}
