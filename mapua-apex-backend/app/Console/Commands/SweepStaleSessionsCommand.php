<?php

namespace App\Console\Commands;

use App\Logging\SessionLogWriter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Artisan command: sessions:sweep-stale
 *
 * Sweeps active sessions whose last_heartbeat is older than STALE_MINUTES
 * and transitions them to `timed_out`. Scheduled every 10 minutes in console.php.
 */
class SweepStaleSessionsCommand extends Command
{
    protected $signature = 'sessions:sweep-stale';

    protected $description = 'Sweep active sessions with stale heartbeats and mark them as timed_out';

    public function __construct(private readonly SessionLogWriter $sessionLogWriter)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        try {
            $activeSessions = $this->sessionLogWriter->sweepAndCount();

            $this->info("Sweep complete. Active sessions remaining: {$activeSessions}");

            Log::info('sessions:sweep-stale completed', ['active_sessions' => $activeSessions]);
        } catch (\Throwable $e) {
            $this->error('Sweep failed: '.$e->getMessage());

            Log::error('sessions:sweep-stale failed', ['error' => $e->getMessage()]);

            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
