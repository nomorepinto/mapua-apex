<?php

use App\Http\Controllers\Api\V1\Admin\AnnouncementController;
use App\Http\Controllers\Api\V1\Admin\OrganizationController;
use App\Http\Controllers\Api\V1\Admin\SignatoryController;
use App\Http\Controllers\Api\V1\Admin\SubmissionController as AdminSubmissionController;
use App\Http\Controllers\Api\V1\Signatory\NotificationController as SignatoryNotificationController;
use App\Http\Controllers\Api\V1\Signatory\ProfileController as SignatoryProfileController;
use App\Http\Controllers\Api\V1\Signatory\SubmissionController as SignatorySubmissionController;
use App\Http\Controllers\Api\V1\Student\AnnouncementController as StudentAnnouncementController;
use App\Http\Controllers\Api\V1\Student\DeadlineController;
use App\Http\Controllers\Api\V1\Student\NotificationController;
use App\Http\Controllers\Api\V1\Student\OrganizationController as StudentOrganizationController;
use App\Http\Controllers\Api\V1\Student\SubmissionController as StudentSubmissionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['throttle:student'])->group(function (): void {
    Route::get('/ping', function () {
        return ['ok' => true];
    });
});

    // Session lifecycle endpoints (open to any authenticated user role)
    Route::middleware(['cognito.jwt:any'])->prefix('sessions')->name('sessions.')->group(function (): void {
        Route::post('start', [\App\Http\Controllers\Api\V1\SessionController::class, 'start'])->name('start');
        Route::patch('{sessionId}/heartbeat', [\App\Http\Controllers\Api\V1\SessionController::class, 'heartbeat'])->name('heartbeat');
        Route::post('{sessionId}/end', [\App\Http\Controllers\Api\V1\SessionController::class, 'end'])->name('end');
    });

    Route::middleware(['cognito.jwt:student', 'throttle:student', 'activity.log'])
        ->prefix('students')
        ->name('students.')
        ->group(function (): void {
            Route::get('submissions', [StudentSubmissionController::class, 'index'])->name('submissions.index');
            Route::post('submissions', [StudentSubmissionController::class, 'store'])
                ->middleware('throttle:student-write')
                ->name('submissions.store');
            Route::get('events/{event}/submissions/{submission}', [StudentSubmissionController::class, 'show'])
                ->name('submissions.show');
            Route::put('events/{event}/submissions/{submission}', [StudentSubmissionController::class, 'update'])
                ->middleware('throttle:student-write')
                ->name('submissions.update');
            Route::get('events/{event}/submissions/{submission}/notifications', [NotificationController::class, 'index'])
                ->name('submissions.notifications.index');
            Route::post('events/{event}/submissions/{submission}/notifications', [NotificationController::class, 'store'])
                ->middleware('throttle:student-write')
                ->name('submissions.notifications.store');
            Route::put('events/{event}/submissions/{submission}/notifications/{notification}', [NotificationController::class, 'update'])
                ->middleware('throttle:student-write')
                ->where('notification', '[^/]+')
                ->name('submissions.notifications.update');
            Route::get('deadlines', [DeadlineController::class, 'index'])->name('deadlines.index');
            Route::get('announcements', [StudentAnnouncementController::class, 'index'])->name('announcements.index');
            Route::get('organization', [StudentOrganizationController::class, 'show'])->name('organization.show');
            Route::get('organizations', [StudentOrganizationController::class, 'index'])->name('organizations.index');
        });

    Route::middleware(['cognito.jwt:signatory', 'throttle:signatory', 'activity.log'])
        ->prefix('signatories')
        ->name('signatories.')
        ->group(function (): void {
            Route::get('me', [SignatoryProfileController::class, 'show'])->name('me.show');
            Route::get('submissions', [SignatorySubmissionController::class, 'index'])->name('submissions.index');
            Route::get('submissions/history', [SignatorySubmissionController::class, 'history'])->name('submissions.history');
            Route::get('events/{event}/submissions/{submission}', [SignatorySubmissionController::class, 'show'])
                ->name('submissions.show');
            Route::post('events/{event}/submissions/{submission}/approve', [SignatorySubmissionController::class, 'approve'])
                ->middleware('throttle:signatory-write')
                ->name('submissions.approve');
            Route::post('events/{event}/submissions/{submission}/return', [SignatorySubmissionController::class, 'returnForRevision'])
                ->middleware('throttle:signatory-write')
                ->name('submissions.return');
            Route::post('events/{event}/submissions/{submission}/deny', [SignatorySubmissionController::class, 'deny'])
                ->middleware('throttle:signatory-write')
                ->name('submissions.deny');
            Route::patch('events/{event}/submissions/{submission}/classification', [SignatorySubmissionController::class, 'updateClassification'])
                ->middleware('throttle:signatory-write')
                ->name('submissions.classification.update');
            Route::post('events/{event}/submissions/{submission}/notifications', [SignatoryNotificationController::class, 'store'])
                ->middleware('throttle:signatory-write')
                ->name('submissions.notifications.store');
            Route::put('events/{event}/submissions/{submission}/notifications/{notification}', [SignatoryNotificationController::class, 'update'])
                ->middleware('throttle:signatory-write')
                ->where('notification', '[^/]+')
                ->name('submissions.notifications.update');
        });

    Route::middleware(['cognito.jwt:admin', 'throttle:admin', 'activity.log'])
        ->prefix('admins')
        ->name('admins.')
        ->group(function (): void {
            // Super Admin Log Monitoring endpoints
            Route::middleware(['cognito.jwt:super_admin'])->prefix('monitor')->name('monitor.')->group(function (): void {
                Route::get('sessions', [\App\Http\Controllers\Api\V1\Admin\LogMonitorController::class, 'querySessions'])->name('sessions');
                Route::get('activity', [\App\Http\Controllers\Api\V1\Admin\LogMonitorController::class, 'queryActivity'])->name('activity');
                Route::get('activity/{activityId}', [\App\Http\Controllers\Api\V1\Admin\LogMonitorController::class, 'getActivityDetail'])->name('activity.show');
                Route::get('stats', [\App\Http\Controllers\Api\V1\Admin\LogMonitorController::class, 'getStats'])->name('stats');
            });

            Route::get('submissions', [AdminSubmissionController::class, 'index'])->name('submissions.index');
            Route::get('events/{event}/submissions/{submission}', [AdminSubmissionController::class, 'show'])
                ->name('submissions.show');
            Route::get('announcements', [AnnouncementController::class, 'index'])->name('announcements.index');
            Route::post('announcements', [AnnouncementController::class, 'store'])
                ->middleware('throttle:admin-write')
                ->name('announcements.store');
            Route::get('announcements/{announcement}', [AnnouncementController::class, 'show'])
                ->where('announcement', '[^/]+')
                ->name('announcements.show');
            Route::put('announcements/{announcement}', [AnnouncementController::class, 'update'])
                ->middleware('throttle:admin-write')
                ->where('announcement', '[^/]+')
                ->name('announcements.update');
            Route::delete('announcements/{announcement}', [AnnouncementController::class, 'destroy'])
                ->middleware('throttle:admin-write')
                ->where('announcement', '[^/]+')
                ->name('announcements.destroy');
            Route::get('organizations', [OrganizationController::class, 'index'])->name('organizations.index');
            Route::post('organizations', [OrganizationController::class, 'store'])
                ->middleware('throttle:admin-write')
                ->name('organizations.store');
            Route::put('organizations/{organization}', [OrganizationController::class, 'update'])
                ->middleware('throttle:admin-write')
                ->name('organizations.update');
            Route::delete('organizations/{organization}', [OrganizationController::class, 'destroy'])
                ->middleware('throttle:admin-write')
                ->name('organizations.destroy');
            Route::get('signatories', [SignatoryController::class, 'index'])->name('signatories.index');
            Route::post('signatories', [SignatoryController::class, 'store'])
                ->middleware('throttle:admin-write')
                ->name('signatories.store');
            Route::put('signatories/{signatory}', [SignatoryController::class, 'update'])
                ->middleware('throttle:admin-write')
                ->name('signatories.update');
            Route::delete('signatories/{signatory}', [SignatoryController::class, 'destroy'])
                ->middleware('throttle:admin-write')
                ->name('signatories.destroy');
        });
});
