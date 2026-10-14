import type { Activity } from "@/components/ui/activity.types"
import type { ReservationPdfData, SAAFPdfData } from "@/lib/pdf-generator"
import { apiSubmissionToDrafts, type ApiSubmission } from "@/lib/dynamodb-adapters"
import { withReservationDefaults } from "@/components/reservation/constants"
import type { ReservationDraft } from "@/components/reservation/types"
import { slotEnd, slotStart } from "@/lib/schedule-slots"

export async function saveProposalPdf(
  saafData: SAAFPdfData,
  reservationData?: ReservationPdfData | null
) {
  const { generateProposalPdf } = await import("@/lib/pdf-generator")
  generateProposalPdf(saafData, reservationData)
}

/**
 * Project the reservable-based reservation draft onto the PDF's room / equipment
 * tables. Room picks expand to one Function Room row per reserved date (its slot
 * range becomes the start/end time); equipment picks become Equipment Requested
 * rows. Returns null when nothing is reserved so the facilities page is skipped.
 */
export function reservationDraftToPdfData(
  draft: ReservationDraft
): ReservationPdfData | null {
  const picks = withReservationDefaults(draft).picks
  if (picks.length === 0) return null

  const roomItems = picks
    .filter((pick) => pick.type === "room")
    .flatMap((pick) =>
      pick.selections.map((selection) => {
        const slots = [...selection.slots].sort((a, b) => a - b)
        return {
          roomNeeded: pick.name,
          classroomName: "",
          dateNeeded: selection.date,
          endDateNeeded: selection.date,
          timeNeeded: slots.length ? slotStart(slots[0]) : "",
          endTimeNeeded: slots.length ? slotEnd(slots[slots.length - 1]) : "",
          remarks: pick.remarks || "",
        }
      })
    )

  const equipmentItems = picks
    .filter((pick) => pick.type === "equipment")
    .map((pick) => ({
      name: pick.name,
      purpose: pick.remarks || "",
      remark: pick.remarks || "",
    }))

  return { roomItems, equipmentItems, avItems: [] }
}

export async function saveSubmissionAsPdf(submission: ApiSubmission) {
  const { saaf, reservation, hasReservation } = apiSubmissionToDrafts(submission)
  const currentDraft = withReservationDefaults(reservation)

  await saveProposalPdf(
    {
      activityType: saaf.activityType,
      totalOrgMembers: saaf.totalOrgMembers,
      activityTitle: saaf.activityTitle,
      activityDescription: saaf.activityDescription,
      activityObjectives: saaf.activityObjectives,
      activityVenue: saaf.activityVenue,
      dateOfEvent: saaf.dateOfEvent,
      dayOfEvent: saaf.dayOfEvent,
      timeOfEvent: saaf.timeOfEvent,
      expectedParticipants: saaf.expectedParticipants,
      individualContribution: saaf.individualContribution,
      proposedBudget: saaf.proposedBudget,
      mission1: saaf.mission1,
      mission2: saaf.mission2,
      mission3: saaf.mission3,
      coreValuesExplanation: saaf.coreValuesExplanation,
      peoExplanation: saaf.peoExplanation,
      sdgExplanation: saaf.sdgExplanation,
      proponents: saaf.proponents || [],
      budgetItems: saaf.budgetItems || [],
    },
    hasReservation ? reservationDraftToPdfData(currentDraft) : null
  )
}

export async function saveActivityAsPdf(activity: Activity) {
  const objectivesStr = Array.isArray(activity.objectives)
    ? activity.objectives
        .map((o) => (o.title ? `${o.title}: ${o.description}` : o.description))
        .join("\n\n")
    : ""

  const saafData: SAAFPdfData = {
    activityType: activity.type,
    activityTitle: activity.title,
    activityDescription: activity.description,
    activityObjectives: objectivesStr,
    activityVenue: activity.venue,
    dateOfEvent: activity.date,
    timeOfEvent: activity.time || "",
    expectedParticipants: activity.expectedParticipants,
    proposedBudget:
      String(activity.proposedBudget || "").replace(/[^0-9.]/g, "") || "0",
    proponents: (activity.proponents || []).map((p) => {
      const parts = (p.name || "").trim().split(/\s+/)
      const lastName = parts.length > 1 ? parts.pop() : ""
      const firstName = parts.join(" ")
      return {
        position: p.role,
        firstName: firstName || p.name,
        lastName: lastName || "",
        department: activity.department,
      }
    }),
    budgetItems: (activity.budgetItems || []).map((b) => ({
      item: b.item,
      unit: b.unit,
      quantity: b.quantity,
      pricePerUnit: b.pricePerUnit,
    })),
  }

  const hasEquipment = (activity.equipmentRequested?.length || 0) > 0
  const hasRooms = (activity.roomsRequested?.length || 0) > 0
  const hasAv = (activity.avEquipmentRequested?.length || 0) > 0

  const reservationData: ReservationPdfData | null =
    hasEquipment || hasRooms || hasAv
      ? {
          equipmentItems: (activity.equipmentRequested || []).map((e) => ({
            name: e.name,
            purpose: e.purpose || "",
            remark: e.remark || "",
          })),
          roomItems: (activity.roomsRequested || []).map((r) => ({
            roomNeeded: r.roomNeeded,
            classroomName: r.classroomName || "",
            dateNeeded: r.dateNeeded || activity.date,
            timeNeeded: r.timeNeeded || activity.time,
            remarks: r.remarks || "",
          })),
          avItems: (activity.avEquipmentRequested || []).map((a) => ({
            equipmentNeeded: a.equipmentNeeded,
            dateNeeded: a.dateNeeded || activity.date,
            timeNeeded: a.timeNeeded || activity.time,
            remarks: a.remarks || "",
          })),
        }
      : null

  await saveProposalPdf(saafData, reservationData)
}

