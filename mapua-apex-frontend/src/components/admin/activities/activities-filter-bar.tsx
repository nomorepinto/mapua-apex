import { SearchIcon } from "lucide-react";

interface ActivitiesFilterBarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  notifTypeFilter: string;
  onNotifTypeFilterChange: (val: string) => void;
  activitySearch: string;
  onActivitySearchChange: (val: string) => void;
  signatorySearch: string;
  onSignatorySearchChange: (val: string) => void;
}

export function ActivitiesFilterBar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  notifTypeFilter,
  onNotifTypeFilterChange,
  activitySearch,
  onActivitySearchChange,
  signatorySearch,
  onSignatorySearchChange,
}: ActivitiesFilterBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 rounded-2xl bg-white p-4 shadow-xs border border-neutral-200">
      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Type</label>
        <select
          value={notifTypeFilter}
          onChange={(e) => onNotifTypeFilterChange(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
        >
          <option value="">All Types</option>
          <option value="submitted">submitted</option>
          <option value="approved">approved</option>
          <option value="returned">returned</option>
          <option value="denied">denied</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Activity ID</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search activity ID (e.g. ACT-31831)..."
            value={activitySearch}
            onChange={(e) => onActivitySearchChange(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
          />
          <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Signatory / User</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search user or desk..."
            value={signatorySearch}
            onChange={(e) => onSignatorySearchChange(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
          />
          <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
        </div>
      </div>
    </div>
  );
}
