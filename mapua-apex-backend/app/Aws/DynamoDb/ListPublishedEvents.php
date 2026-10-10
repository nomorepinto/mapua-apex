<?php

namespace App\Aws\DynamoDb;

use App\Support\Arcus\EventWindow;

/**
 * Published events for the arcus companion apps.
 *
 * "Published" = a submission that reached a terminal approved state (status
 * approved or finished). Reuses the admin GSI1-by-org scan and keeps only the
 * rows whose stateless visibility window is open right now for the requested
 * app window, so no scheduler or stored flag is involved.
 */
final class ListPublishedEvents
{
    public function __construct(private ScanSubmissions $scan) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(?string $organizationId, string $window = EventWindow::ATTENDANCE): array
    {
        $scope = is_string($organizationId) && $organizationId !== ''
            ? ['organization_id' => $organizationId]
            : [];

        $items = array_merge(
            $this->scan->handle($scope + ['status' => 'approved']),
            $this->scan->handle($scope + ['status' => 'finished']),
        );

        $seen = [];
        $published = [];

        foreach ($items as $item) {
            $key = ($item['PK'] ?? '')."\0".($item['SK'] ?? '');

            if (isset($seen[$key]) || ! EventWindow::isOpenNow($item, $window)) {
                continue;
            }

            $seen[$key] = true;
            $published[] = $item;
        }

        return $published;
    }
}
