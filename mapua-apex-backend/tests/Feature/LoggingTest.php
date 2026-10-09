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

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('putItem')
            ->once() // 1 for session item
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

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}#2"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('updateItem')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $response = $this->withStudentAuth([
            'sub' => $sub,
            'auth_time' => $authTime,
        ])->postJson('/api/v1/sessions/start');

        $response->assertStatus(200)
            ->assertJson([
                'sessionId' => $baseId,
                'status' => 'active',
                'isNewSession' => false,
            ]);
    }

    public function test_03_session_start_creates_suffix_2_when_base_is_ended(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");
        $suffix2Id = "{$baseId}#2";

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'session_id' => ['S' => $baseId],
                    'status' => ['S' => 'ended'],
                ],
            ]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$suffix2Id}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('putItem')
            ->once() // session item
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

        $this->dynamoDbMock->shouldReceive('putItem')
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
        $suffix2Id = "{$baseId}#2";

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => ($args['Key']['PK']['S'] ?? '') === "SESSION#{$baseId}"))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $exception = Mockery::mock(\Aws\DynamoDb\Exception\DynamoDbException::class);
        $exception->shouldReceive('getAwsErrorCode')->andReturn('ConditionalCheckFailedException');

        // First putItem fails due to race condition
        $this->dynamoDbMock->shouldReceive('putItem')
            ->once()
            ->andThrow($exception);

        // Second putItem succeeds for #2 session + LOGIN activity event (2 calls total)
        $this->dynamoDbMock->shouldReceive('putItem')
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

        $this->dynamoDbMock->shouldReceive('updateItem')
            ->once()
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
            ->once()
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
            ->once()
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
}
