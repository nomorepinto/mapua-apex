<?php

use App\Http\Controllers\Api\V1\Admin\AnnouncementController;
use App\Http\Controllers\Api\V1\Admin\BookingController;
use App\Http\Controllers\Api\V1\Admin\CampusController;
use App\Http\Controllers\Api\V1\Admin\LogMonitorController;
use App\Http\Controllers\Api\V1\Admin\OrganizationController;
use App\Http\Controllers\Api\V1\Admin\ReservableController;
use App\Http\Controllers\Api\V1\Admin\SignatoryController;
use App\Http\Controllers\Api\V1\Admin\SubmissionController as AdminSubmissionController;
use App\Http\Controllers\Api\V1\Arcus\EventController;
use App\Http\Controllers\Api\V1\Public\AnnouncementController as PublicAnnouncementController;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\Signatory\NotificationController as SignatoryNotificationController;
use App\Http\Controllers\Api\V1\Signatory\ProfileController as SignatoryProfileController;
use App\Http\Controllers\Api\V1\Signatory\SubmissionController as SignatorySubmissionController;
use App\Http\Controllers\Api\V1\Student\AnnouncementController as StudentAnnouncementController;
use App\Http\Controllers\Api\V1\Student\DeadlineController;
use App\Http\Controllers\Api\V1\Student\NotificationController;
use App\Http\Controllers\Api\V1\Student\OrganizationController as StudentOrganizationController;
use App\Http\Controllers\Api\V1\Student\ReservableController as StudentReservableController;
use App\Http\Controllers\Api\V1\Student\SubmissionController as StudentSubmissionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['throttle:student'])->group(function (): void {
    Route::get('/ping', function () {
        return ['ok' => true];
    });
});

// Public endpoints — readable without a Cognito JWT (e.g. the landing page).
Route::middleware(['throttle:student'])->prefix('public')->name('public.')->group(function (): void {
    Route::get('announcements', [PublicAnnouncementController::class, 'index'])->name('announcements.index');
});

// Session lifecycle endpoints (open to any authenticated user role)
Route::middleware(['cognito.jwt:any'])->prefix('sessions')->name('sessions.')->group(function (): void {
    Route::post('start', [SessionController::class, 'start'])->name('start');
    Route::patch('{sessionId}/heartbeat', [SessionController::class, 'heartbeat'])->name('heartbeat');
    Route::post('{sessionId}/end', [SessionController::class, 'end'])->name('end');
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
        // Read-only reservable catalog for the SAAF reservation step.
        Route::get('campuses', [StudentReservableController::class, 'campuses'])->name('campuses.index');
        Route::get('campuses/{campus}/reservables', [StudentReservableController::class, 'index'])->name('reservables.index');
        Route::get('campuses/{campus}/reservables/{reservable}/availability', [StudentReservableController::class, 'availability'])->name('reservables.availability');
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
        // Log Monitoring endpoints — accessible to admin and osaar roles
        Route::prefix('monitor')->name('monitor.')->group(function (): void {
            // Session log routes
            Route::get('sessions', [LogMonitorController::class, 'querySessions'])->name('sessions.index');
            Route::get('sessions/{id}', [LogMonitorController::class, 'getSessionDetail'])->name('sessions.show');
            Route::post('sessions/{id}/revoke', [LogMonitorController::class, 'revokeSession'])->name('sessions.revoke');
            // Activity log routes
            Route::get('activity', [LogMonitorController::class, 'queryActivity'])->name('activity.index');
            Route::get('activity/{activityId}', [LogMonitorController::class, 'getActivityDetail'])->name('activity.show');
            // Analytics routes
            Route::get('stats', [LogMonitorController::class, 'getStats'])->name('stats');
            Route::get('bottlenecks', [LogMonitorController::class, 'getBottlenecks'])->name('bottlenecks');
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

        // Campuses (osaar) — top-level reservable parents.
        Route::get('campuses', [CampusController::class, 'index'])->name('campuses.index');
        Route::post('campuses', [CampusController::class, 'store'])
            ->middleware('throttle:admin-write')
            ->name('campuses.store');
        Route::put('campuses/{campus}', [CampusController::class, 'update'])
            ->middleware('throttle:admin-write')
            ->name('campuses.update');
        Route::delete('campuses/{campus}', [CampusController::class, 'destroy'])
            ->middleware('throttle:admin-write')
            ->name('campuses.destroy');

        // Reservables (cdm) — rooms/equipment under a campus + manual bookings.
        Route::get('campuses/{campus}/reservables', [ReservableController::class, 'index'])->name('reservables.index');
        Route::post('campuses/{campus}/reservables', [ReservableController::class, 'store'])
            ->middleware('throttle:admin-write')
            ->name('reservables.store');
        Route::put('campuses/{campus}/reservables/{reservable}', [ReservableController::class, 'update'])
            ->middleware('throttle:admin-write')
            ->name('reservables.update');
        Route::delete('campuses/{campus}/reservables/{reservable}', [ReservableController::class, 'destroy'])
            ->middleware('throttle:admin-write')
            ->name('reservables.destroy');
        Route::get('campuses/{campus}/reservables/{reservable}/availability', [BookingController::class, 'availability'])->name('reservables.availability');
        Route::get('campuses/{campus}/reservables/{reservable}/bookings', [BookingController::class, 'index'])->name('reservables.bookings.index');
        Route::post('campuses/{campus}/reservables/{reservable}/bookings', [BookingController::class, 'store'])
            ->middleware('throttle:admin-write')
            ->name('reservables.bookings.store');
        Route::delete('campuses/{campus}/reservables/{reservable}/bookings/{booking}', [BookingController::class, 'destroy'])
            ->middleware('throttle:admin-write')
            ->name('reservables.bookings.destroy');
    });

// Arcus companion apps — server-to-server, shared secret (not a Cognito JWT).
Route::middleware(['arcus.service', 'throttle:admin'])
    ->prefix('arcus')
    ->name('arcus.')
    ->group(function (): void {
        Route::get('events', [EventController::class, 'index'])
            ->name('events.index');
        Route::post('events/{event}/submissions/{submission}/finish', [EventController::class, 'finish'])
            ->middleware('throttle:admin-write')
            ->name('submissions.finish');
    });
