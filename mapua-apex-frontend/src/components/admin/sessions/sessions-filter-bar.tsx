import { SearchIcon } from "lucide-react";

interface SessionsFilterBarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  userSearch: string;
  onUserSearchChange: (search: string) => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export function SessionsFilterBar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  userSearch,
  onUserSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
}: SessionsFilterBarProps) {
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
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">User Search</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Name or email..."
            value={userSearch}
            onChange={(e) => onUserSearchChange(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 pl-8 pr-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
          />
          <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-neutral-400" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Role</label>
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
        >
          <option value="">All Roles</option>
          <option value="student">Student</option>
          <option value="org_adviser">Adviser</option>
          <option value="dean">Dean</option>
          <option value="osaar">OSAAR</option>
          <option value="cdm">CDM</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="w-full rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 focus:border-[#8B0000] focus:ring-[#8B0000]"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="logged_out">Logged out</option>
          <option value="timed_out">Timed out</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>
    </div>
  );
}
