import { memo } from "react"
import { AlertTriangle } from "lucide-react"

import type {
  AvEquipmentItem,
  EquipmentItem,
  RoomRequestedItem,
} from "@/components/ui/activity.types"
import type { BookingConflict } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface ActivityReservationDetailsProps {
  equipmentRequested?: EquipmentItem[]
  roomsRequested?: RoomRequestedItem[]
  avEquipmentRequested?: AvEquipmentItem[]
  /** CDM desk: slots already taken by approved bookings. */
  bookingConflicts?: BookingConflict[]
  className?: string
}

export const ActivityReservationDetails = memo(function ActivityReservationDetails({
  equipmentRequested = [],
  roomsRequested = [],
  avEquipmentRequested = [],
  bookingConflicts = [],
  className,
}: ActivityReservationDetailsProps) {
  const hasEquipment = equipmentRequested.length > 0
  const hasRooms = roomsRequested.length > 0
  const hasAv = avEquipmentRequested.length > 0
  const hasConflicts = bookingConflicts.length > 0

  if (!hasEquipment && !hasRooms && !hasAv && !hasConflicts) return null

  const hasClassroom = roomsRequested.some((r) => Boolean(r.classroomName))

  return (
    <>
      <hr className="border-neutral-200" />

      <div className={cn("space-y-6 pt-2", className)}>
        {hasConflicts && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <div className="space-y-2">
              <p className="font-bold">
                This reservation can't be approved as filed.
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {bookingConflicts.map((conflict, idx) => (
                  <li key={`${conflict.reservable_id}-${conflict.date}-${conflict.slot}-${idx}`}>
                    {conflict.message.replace(/ Pick another time\.$/, "")}
                  </li>
                ))}
              </ul>
              <p className="text-amber-800">
                Return the proposal so the organization can pick another time, or reject it.
              </p>
            </div>
          </div>
        )}

        {hasEquipment && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-neutral-900">
              Equipment Requested
            </h4>
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Equipment
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Purpose
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {equipmentRequested.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-neutral-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-900">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {item.purpose || <span className="text-neutral-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {item.remark || <span className="text-neutral-400 italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasRooms && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-neutral-900">
              Room Needed
            </h4>
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Room Needed
                    </th>
                    {hasClassroom && (
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                        Classroom Name
                      </th>
                    )}
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {roomsRequested.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-neutral-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-900">
                        {item.roomNeeded}
                      </td>
                      {hasClassroom && (
                        <td className="px-4 py-3 text-neutral-600 font-medium">
                          {item.classroomName || <span className="text-neutral-400 italic">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-neutral-600">
                        {item.remarks || <span className="text-neutral-400 italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasAv && (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-neutral-900">
              Equipment Needed (Audio-Visual)
            </h4>
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Equipment Needed
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {avEquipmentRequested.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-neutral-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-neutral-900">
                        {item.equipmentNeeded}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {item.remarks || <span className="text-neutral-400 italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
})
