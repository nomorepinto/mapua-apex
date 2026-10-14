<?php

use App\Console\Commands\SweepStaleSessionsCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sweep stale sessions every 10 minutes (plan §3.2)
Schedule::command(SweepStaleSessionsCommand::class)->everyTenMinutes();
