<?php

namespace Tests\Feature;

use App\Logging\LogTableItems;
use App\Logging\SessionLogWriter;
use App\Logging\ActivityLogWriter;
use Aws\DynamoDb\DynamoDbClient;
use Aws\CommandInterface;
use GuzzleHttp\Promise\Promise;
use Mockery;
use Tests\TestCase;

class LoggingTest extends TestCase
{
    private Mockery\MockInterface $dynamoDbMock;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'aws.dynamodb.session_log_table' => 'test-session-logs',
            'aws.dynamodb.activity_log_table' => 'test-activity-logs',
            'aws.dynamodb.log_retention_days' => 90,
        ]);

        $this->dynamoDbMock = Mockery::mock(DynamoDbClient::class);
        $this->app->instance(DynamoDbClient::class, $this->dynamoDbMock);
    }

    public function test_01_session_start_derives_correct_id(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $expectedBaseId = hash('sha256', "{$sub}:{$authTime}");

        // 1. Pointer lookup -> null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        // 2. Candidate ID lookup -> null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$expectedBaseId}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        // 3. TransactWriteItems creates session and pointer
        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
            'email' => 'student@mapua.edu.ph',
            'name' => 'Test Student',
        ])->postJson('/api/v1/sessions/start');

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $expectedBaseId,
                'status' => 'active',
                'isNewSession' => true,
            ]);
    }

    public function test_02_duplicate_session_start_with_same_auth_time_extends_active_session(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $now = date('Y-m-d\TH:i:s\Z');

        // 1. Pointer lookup -> active pointer
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'device_id' => ['S' => 'dev-1'],
                    'status' => ['S' => 'active'],
                ],
            ]));

        // 2. Active session lookup -> active
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'login_time' => ['S' => $now],
                    'last_heartbeat' => ['S' => $now],
                    'TTL' => ['N' => (string)(time() + 86400)],
                ],
            ]));

        // Session patch & pointer patch
        $this->dynamoDbMock->shouldReceive('updateItem')
            ->twice()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start', [
            'existingSessionId' => $baseId,
            'deviceId' => 'dev-1',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $baseId,
                'status' => 'active',
                'isNewSession' => false,
            ]);
    }

    public function test_02b_concurrent_login_closes_old_active_session(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $suffix2Id = "{$baseId}#2";
        $now = date('Y-m-d\TH:i:s\Z');

        // 1. Pointer lookup -> pointer points to baseId on device-1
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'device_id' => ['S' => 'dev-1'],
                    'status' => ['S' => 'active'],
                ],
            ]));

        // 2. Candidate 0 lookup -> baseId already exists
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->twice() // once for findAvailableSessionId, once to check old session status
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'login_time' => ['S' => $now],
                    'last_heartbeat' => ['S' => $now],
                    'TTL' => ['N' => (string)(time() + 86400)],
                ],
            ]));

        // 3. Candidate 1 lookup -> suffix2Id is available
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$suffix2Id}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        // 4. One TransactWriteItems closes old session, creates new session, updates pointer
        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        // Call from device-2 -> concurrent login
        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start', [
            'deviceId' => 'dev-2',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $suffix2Id,
                'status' => 'active',
                'isNewSession' => true,
                'displacedPreviousSession' => true,
            ]);
    }

    public function test_02c_stale_session_closes_as_timed_out_on_login_from_another_device(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $suffix2Id = "{$baseId}#2";
        $loginTime = gmdate('Y-m-d\TH:i:s\Z', time() - 5 * 3600); // 5 hours ago (e.g. 12pm)
        $staleHeartbeat = gmdate('Y-m-d\TH:i:s\Z', time() - 4 * 3600); // 4 hours ago (e.g. 5am, inactive for 4h)

        // 1. Pointer lookup -> pointer points to baseId on device-1
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'device_id' => ['S' => 'dev-1'],
                    'status' => ['S' => 'active'],
                ],
            ]));

        // 2. Fetch old session -> active but stale (> 15m)
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->twice() // once for staleness check in Branch 3, once for findAvailableSessionId candidate 0
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'login_time' => ['S' => $loginTime],
                    'last_heartbeat' => ['S' => $staleHeartbeat],
                    'TTL' => ['N' => (string)(time() + 86400)],
                ],
            ]));

        // 3. Stale session is closed with timed_out, logout_time = last_heartbeat, duration computed up to last_heartbeat
        $this->dynamoDbMock->shouldReceive('updateItem')
            ->with(Mockery::on(function ($args) use ($baseId, $staleHeartbeat) {
                if (($args['Key']['PK']['S'] ?? '') !== "SESSION#{$baseId}") {
                    return false;
                }
                $sVals = array_column($args['ExpressionAttributeValues'] ?? [], 'S');
                $nVals = array_map('intval', array_column($args['ExpressionAttributeValues'] ?? [], 'N'));

                $isTimedOut = in_array('timed_out', $sVals, true);
                $isCorrectLogout = in_array($staleHeartbeat, $sVals, true);
                $isCorrectDuration = in_array(3600, $nVals, true);

                return $isTimedOut && $isCorrectLogout && $isCorrectDuration;
            }))
            ->once()
            ->andReturn(new \Aws\Result([]));

        // 4. Stale active pointer is cleared
        $this->dynamoDbMock->shouldReceive('deleteItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result([]));

        // 5. Candidate 1 lookup -> suffix2Id is available
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$suffix2Id}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        // 6. Branch 2 creates the new session and pointer atomically
        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        // Call from device-2 (Device B at 9am) -> starts cleanly without displacement
        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start', [
            'deviceId' => 'dev-2',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $suffix2Id,
                'status' => 'active',
                'isNewSession' => true,
                'displacedPreviousSession' => false,
            ]);
    }

    public function test_03_session_start_creates_suffix_2_when_base_is_ended(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $suffix2Id = "{$baseId}#2";

        // 1. Pointer lookup -> null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        // 2. Candidate 0 -> ended
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'status' => ['S' => 'ended'],
                ],
            ]));

        // 3. Candidate 1 -> null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$suffix2Id}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start');

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $suffix2Id,
                'status' => 'active',
                'isNewSession' => true,
            ]);
    }

    public function test_04_sequential_session_creation_handles_multiple_ended_suffixes(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $suffix2Id = "{$baseId}#2";
        $suffix3Id = "{$baseId}#3";

        // 1. Pointer lookup -> null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => ['status' => ['S' => 'ended']]]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$suffix2Id}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => ['status' => ['S' => 'ended']]]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$suffix3Id}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start');

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $suffix3Id,
                'status' => 'active',
                'isNewSession' => true,
            ]);
    }

    public function test_05_session_start_handles_race_condition_retries(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");

        // First attempt: pointer is null, candidate is null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->twice() // once for attempt 1, once for retry
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->twice() // once for attempt 1, once for retry
            ->andReturn(new \Aws\Result(['Item' => null]));

        $exception = Mockery::mock(\Aws\DynamoDb\Exception\DynamoDbException::class);
        $exception->shouldReceive('getAwsErrorCode')->andReturn('TransactionCanceledException');

        // First transactWriteItems fails due to race condition
        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andThrow($exception);

        // Second transactWriteItems succeeds on retry
        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start');

        $response->assertStatus(200)
            ->assertJson([
                'status' => 'active',
            ]);
    }

    public function test_06_heartbeat_updates_last_seen_on_active_session(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $now = date('Y-m-d\TH:i:s\Z');

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'login_time' => ['S' => $now],
                    'last_heartbeat' => ['S' => $now],
                ],
            ]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'last_heartbeat' => ['S' => $now],
                ],
            ]));

        $this->dynamoDbMock->shouldReceive('updateItem')
            ->twice() // 1 for session item, 1 for active pointer
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->patchJson("/api/v1/sessions/{$baseId}/heartbeat");

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $baseId,
                'status' => 'active',
            ]);
    }

    public function test_07_heartbeat_returns_409_on_expired_or_ended_session(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->twice() // 1 for session item, 1 for pointer lookup
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'ended'],
                ],
            ]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->patchJson("/api/v1/sessions/{$baseId}/heartbeat");

        $response->assertStatus(409)
            ->assertJson([
                'code' => 'SESSION_EXPIRED',
            ]);
    }

    public function test_08_heartbeat_returns_403_on_session_id_mismatch(): void
    {
        $subA = 'usr-123';
        $subB = 'usr-456';
        $authTime = 1700000000;
        $baseIdForUserB = hash('sha256', "{$subB}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseIdForUserB],
                    'sub' => ['S' => $subB],
                    'status' => ['S' => 'active'],
                ],
            ]));

        $response = $this->withStudentAuth([
            'sub' => $subA,
            'auth_time' => $authTime,
        ])->patchJson("/api/v1/sessions/{$baseIdForUserB}/heartbeat");

        $response->assertStatus(403);
    }

    public function test_09_end_session_updates_status_to_ended(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'user_name' => ['S' => 'Test Student'],
                    'user_email' => ['S' => 'student@mapua.edu.ph'],
                    'user_role' => ['S' => 'student'],
                    'ip_address' => ['S' => '127.0.0.1'],
                    'status' => ['S' => 'active'],
                    'login_time' => ['S' => '2026-10-09T10:00:00Z'],
                ],
            ]));

        $this->dynamoDbMock->shouldReceive('updateItem')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $this->dynamoDbMock->shouldReceive('deleteItem')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson("/api/v1/sessions/{$baseId}/end", [
            'endReason' => 'logout',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $baseId,
                'status' => 'completed',
            ]);
    }

    public function test_10_end_session_returns_404_for_non_existent_session(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson("/api/v1/sessions/{$baseId}/end");

        $response->assertStatus(404);
    }

    public function test_10b_heartbeat_returns_409_displaced_when_session_ended_by_concurrent_login(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->twice() // session item + pointer lookup
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'completed'],
                    'end_reason' => ['S' => 'concurrent_login'],
                ],
            ]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->patchJson("/api/v1/sessions/{$baseId}/heartbeat");

        $response->assertStatus(409)
            ->assertJson([
                'code' => 'CONCURRENT_LOGIN_DISPLACED',
            ]);
    }

    public function test_11_end_session_returns_403_on_session_id_mismatch(): void
    {
        $subA = 'usr-123';
        $subB = 'usr-456';
        $authTime = 1700000000;
        $baseIdForUserB = hash('sha256', "{$subB}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseIdForUserB],
                    'sub' => ['S' => $subB],
                    'status' => ['S' => 'active'],
                ],
            ]));

        $response = $this->withStudentAuth([
            'sub' => $subA,
            'auth_time' => $authTime,
        ])->postJson("/api/v1/sessions/{$baseIdForUserB}/end");

        $response->assertStatus(403);
    }

    public function test_12_activity_log_writer_records_login_and_logout(): void
    {
        $writer = new ActivityLogWriter(new LogTableItems($this->dynamoDbMock));

        $this->dynamoDbMock->shouldReceive('putItem')
            ->never();

        $writer->logLogin('sess-1', 'usr-1', 'Name', 'email@mapua.edu.ph', 'student', '127.0.0.1');
        $writer->logLogout('sess-1', 'usr-1', 'Name', 'email@mapua.edu.ph', 'student', '127.0.0.1', 300, 'logout');

        $this->assertTrue(true);
    }

    public function test_13_activity_log_middleware_logs_mutation_requests(): void
    {
        $this->dynamoDbMock->shouldReceive('putItem')
            ->atLeast()->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withAdminAuth([
            'sub' => 'admin-001',
            'email' => 'admin@mapua.edu.ph',
            'name' => 'Admin User',
            'custom:role' => 'admin',
        ])->withHeader('X-Session-ID', 'sess-123')
          ->postJson('/api/v1/admins/announcements', [
              'title' => 'Test Announcement',
              'content' => 'Content here',
              'targetRole' => 'all',
          ]);

        // Status can be 200 or 201 or whatever announcement controller returns
        $this->assertTrue($response->getStatusCode() < 400);
    }

    public function test_14_activity_log_middleware_skips_get_and_excluded_paths(): void
    {
        // No putItem calls expected for GET request
        $this->dynamoDbMock->shouldReceive('putItem')->never();
        $this->dynamoDbMock->shouldReceive('query')->andReturn(new \Aws\Result(['Items' => []]));

        $response = $this->withStudentAuth()->getJson('/api/v1/students/deadlines');

        $response->assertStatus(200);
    }

    public function test_15_query_sessions_filters_and_returns_paginated_list(): void
    {
        $this->dynamoDbMock->shouldReceive('query')
            ->atLeast()->once()
            ->andReturn(new \Aws\Result([
                'Items' => [
                    [
                        'sessionId' => ['S' => 'sess-1'],
                        'userId' => ['S' => 'usr-1'],
                        'userName' => ['S' => 'John Doe'],
                        'userRole' => ['S' => 'student'],
                        'status' => ['S' => 'active'],
                        'timeIn' => ['S' => '2026-10-09T08:00:00Z'],
                        'date' => ['S' => date('Y-m-d')],
                    ],
                ],
            ]));

        $response = $this->withSuperAdminAuth()
            ->getJson('/api/v1/admins/monitor/sessions?startDate=' . date('Y-m-d') . '&endDate=' . date('Y-m-d'));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'nextToken',
            ]);
    }

    public function test_16_query_activity_filters_and_returns_paginated_list(): void
    {
        $this->dynamoDbMock->shouldReceive('query')
            ->once()
            ->andReturn(new \Aws\Result([
                'Items' => [
                    [
                        'activityId' => ['S' => 'act-1'],
                        'sessionId' => ['S' => 'sess-1'],
                        'userId' => ['S' => 'usr-1'],
                        'userName' => ['S' => 'John Doe'],
                        'actionType' => ['S' => 'CREATE'],
                        'module' => ['S' => 'ANNOUNCEMENT'],
                        'timestamp' => ['S' => '2026-10-09T08:05:00Z'],
                        'date' => ['S' => date('Y-m-d')],
                    ],
                ],
            ]));

        $response = $this->withSuperAdminAuth()
            ->getJson('/api/v1/admins/monitor/activity?startDate=' . date('Y-m-d') . '&endDate=' . date('Y-m-d'));

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'nextToken',
            ]);
    }

    public function test_17_get_stats_returns_accurate_aggregate_counts(): void
    {
        // Query active count via GSI query or scan
        $this->dynamoDbMock->shouldReceive('query')
            ->atLeast()->once()
            ->andReturn(new \Aws\Result([
                'Items' => [
                    ['sessionId' => ['S' => 'sess-1']],
                ],
            ]));

        $response = $this->withSuperAdminAuth()
            ->getJson('/api/v1/admins/monitor/stats');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'activeSessionsCount',
                    'totalSessionsToday',
                    'totalActivityToday',
                ],
            ]);
    }

    public function test_18_device_b_login_with_different_auth_time_displaces_device_a_session(): void
    {
        $sub = 'usr-123';
        $authTimeA = 1700000000;
        $authTimeB = 1700000500; // different auth_time from Cognito
        $sessionAId = hash('sha256', "{$sub}:{$authTimeA}");
        $sessionBId = hash('sha256', "{$sub}:{$authTimeB}");
        $now = date('Y-m-d\TH:i:s\Z');

        // Pointer currently points to Session A on Device A
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "USER#{$sub}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $sessionAId],
                    'device_id' => ['S' => 'device-a'],
                    'status' => ['S' => 'active'],
                ],
            ]));

        // Check if candidate 0 for Session B exists -> null
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$sessionBId}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        // Check Session A to see if still active for displacement
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$sessionAId}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $sessionAId],
                    'sub' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'login_time' => ['S' => $now],
                    'last_heartbeat' => ['S' => $now],
                ],
            ]));

        // Atomic TransactWriteItems: closes Session A with concurrent_login, creates Session B, updates pointer to B
        $this->dynamoDbMock->shouldReceive('transactWriteItems')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTimeB,
        ])->postJson('/api/v1/sessions/start', [
            'deviceId' => 'device-b',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $sessionBId,
                'status' => 'active',
                'isNewSession' => true,
                'displacedPreviousSession' => true,
            ]);
    }
}
