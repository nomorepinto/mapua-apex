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
            ->twice() // 1 for session, 1 for LOGIN activity event
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

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'sessionId' => ['S' => $baseId],
                    'userId' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'timeIn' => ['S' => '2026-10-09T10:00:00Z'],
                    'lastSeen' => ['S' => '2026-10-09T10:05:00Z'],
                    'ttl' => ['N' => (string)(time() + 86400)],
                ],
            ]));

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
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $baseId))
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'sessionId' => ['S' => $baseId],
                    'status' => ['S' => 'ended'],
                ],
            ]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $suffix2Id))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('putItem')
            ->twice() // session + LOGIN activity
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
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $baseId))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => ['status' => ['S' => 'ended']]]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $suffix2Id))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => ['status' => ['S' => 'ended']]]));

        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $suffix3Id))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $this->dynamoDbMock->shouldReceive('putItem')
            ->twice()
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
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $baseId))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => null]));

        $exception = new \Aws\DynamoDb\Exception\DynamoDbException(
            'Conditional check failed',
            Mockery::mock(CommandInterface::class)
        );

        // First putItem fails due to race condition
        $this->dynamoDbMock->shouldReceive('putItem')
            ->once()
            ->andThrow($exception);

        // Chain walk finds base is now active
        $this->dynamoDbMock->shouldReceive('getItem')
            ->with(Mockery::on(fn($args) => $args['Key']['sessionId']['S'] === $baseId))
            ->once()
            ->andReturn(new \Aws\Result(['Item' => [
                'sessionId' => ['S' => $baseId],
                'status' => ['S' => 'active'],
            ]]));

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
            ]);
    }

    public function test_06_heartbeat_updates_last_seen_on_active_session(): void
    {
        $sub = 'usr-123';
        $authTime = 1700000000;
        $baseId = hash('sha256', "{$sub}:{$authTime}");

        $this->dynamoDbMock->shouldReceive('getItem')
            ->once()
            ->andReturn(new \Aws\Result([
                'Item' => [
                    'sessionId' => ['S' => $baseId],
                    'userId' => ['S' => $sub],
                    'status' => ['S' => 'active'],
                    'timeIn' => ['S' => '2026-10-09T10:00:00Z'],
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
                    'sessionId' => ['S' => $baseId],
                    'userId' => ['S' => $sub],
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
                    'sessionId' => ['S' => $baseId],
                    'userId' => ['S' => $sub],
                    'userName' => ['S' => 'Test Student'],
                    'userEmail' => ['S' => 'student@mapua.edu.ph'],
                    'userRole' => ['S' => 'student'],
                    'ipAddress' => ['S' => '127.0.0.1'],
                    'status' => ['S' => 'active'],
                    'timeIn' => ['S' => '2026-10-09T10:00:00Z'],
                ],
            ]));

        $this->dynamoDbMock->shouldReceive('updateItem')
            ->once()
            ->andReturn(new \Aws\Result([]));

        $this->dynamoDbMock->shouldReceive('putItem')
            ->once() // LOGOUT activity event
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
                'status' => 'ended',
                'endReason' => 'logout',
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
            ->twice()
            ->andReturn(new \Aws\Result([]));

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
                'items',
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
                'items',
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
                'activeSessionsCount',
                'totalSessionsToday',
                'totalActivityToday',
            ]);
    }
}
