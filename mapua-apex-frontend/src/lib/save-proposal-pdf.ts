import type { SAAFPdfData, ReservationPdfData } from "@/lib/pdf-generator"

export async function saveProposalPdf(
  saafData: SAAFPdfData,
  reservationData?: ReservationPdfData | null
) {
  const { generateProposalPdf } = await import("@/lib/pdf-generator")
  generateProposalPdf(saafData, reservationData)
}
