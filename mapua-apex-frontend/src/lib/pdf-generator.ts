import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface SAAFPdfData {
    activityType?: string
    totalOrgMembers?: string | number
    activityTitle?: string
    activityDescription?: string
    activityObjectives?: string
    activityVenue?: string
    dateOfEvent?: string
    dayOfEvent?: string
    timeOfEvent?: string
    expectedParticipants?: string | number
    individualContribution?: string | number
    proposedBudget?: string | number
    mission1?: boolean
    mission2?: boolean
    mission3?: boolean
    coreValuesExplanation?: string
    peoExplanation?: string
    sdgExplanation?: string
    proponents?: Array<{
        position?: string
        firstName?: string
        middleName?: string
        lastName?: string
        suffix?: string
        studentNumber?: string
        programAndYear?: string
        dateOfSubmission?: string
        department?: string
        positionOfApplicant?: string
        orgOrCourseSection?: string
        contactNumber?: string
        emailAddress?: string
        facebookLink?: string
    }>
    budgetItems?: Array<{
        item?: string
        unit?: string | number
        quantity?: string | number
        pricePerUnit?: string | number
    }>
}

export interface ReservationPdfData {
    equipment?: {
        monoblock?: boolean
        whiteboards?: boolean
        tables?: boolean
        rostrum?: boolean
        flags?: boolean
        panelBoards?: boolean
        others?: boolean
    }
    otherEquipmentText?: string
    purpose?: string
    facilityItems?: Array<{
        item?: string
        dateOfUse?: string
        endDateOfUse?: string
        timeOfUse?: string
        endTimeOfUse?: string
        location?: string
    }>
    functionRoomPurpose?: string
    roomItems?: Array<{
        dateNeeded?: string
        endDateNeeded?: string
        timeNeeded?: string
        endTimeNeeded?: string
        roomNeeded?: string
        remarks?: string
    }>
    avPurpose?: string
    avItems?: Array<{
        dateNeeded?: string
        endDateNeeded?: string
        timeNeeded?: string
        endTimeNeeded?: string
        equipmentNeeded?: string
        remarks?: string
    }>
}

export function generateProposalPdf(
    saafData: SAAFPdfData,
    reservationData?: ReservationPdfData | null
) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    })

    const primaryRed: [number, number, number] = [153, 0, 0]
    const darkGray: [number, number, number] = [40, 40, 40]

    // ================= PAGE 1: SAAF =================
    doc.setFillColor(...primaryRed)
    doc.rect(0, 0, 210, 18, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("STUDENT ACTIVITY APPLICATION FORM (SAAF)", 105, 12, { align: "center" })

    doc.setTextColor(...darkGray)
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.text("Academic Term: 2026 - 2027 • Unified Activity Proposal Application", 14, 25)

    let y = 32

    // Classification Table
    autoTable(doc, {
        startY: y,
        theme: "plain",
        styles: { fontSize: 8.5, cellPadding: 1.5 },
        body: [
            [
                { content: "Activity Classification:", styles: { fontStyle: "bold" } },
                saafData.activityType === "extra-curricular" ? "Extra-curricular Activity" : "Co-curricular Activity",
                { content: "Total Members:", styles: { fontStyle: "bold" } },
                String(saafData.totalOrgMembers || "0"),
            ],
        ],
    })

    y = (doc as any).lastAutoTable.finalY + 4

    // Activity Details
    autoTable(doc, {
        startY: y,
        head: [["Activity Details", ""]],
        headStyles: { fillColor: primaryRed, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, fontStyle: "bold" }, 1: { cellWidth: 132 } },
        body: [
            ["Title and Nature", saafData.activityTitle || "N/A"],
            ["Description", saafData.activityDescription || "N/A"],
            ["Objectives", saafData.activityObjectives || "N/A"],
            ["Venue", saafData.activityVenue || "N/A"],
            ["Date / Day / Time", `${saafData.dateOfEvent || ""} (${saafData.dayOfEvent || ""}) at ${saafData.timeOfEvent || ""}`],
            ["Expected Participants", String(saafData.expectedParticipants || "0")],
            ["Individual Contribution", `PHP ${Number(saafData.individualContribution || 0).toFixed(2)}`],
            ["Proposed Budget", `PHP ${Number(saafData.proposedBudget || 0).toFixed(2)}`],
        ],
    })

    y = (doc as any).lastAutoTable.finalY + 4

    // Proponents Table
    const proponentRows = (saafData.proponents || []).map((p, idx) => [
        String(idx + 1),
        `${p.firstName || ""} ${p.middleName || ""} ${p.lastName || ""} ${p.suffix || ""}`.trim(),
        p.position || p.positionOfApplicant || "Applicant",
        p.studentNumber || "N/A",
        p.programAndYear || "N/A",
        p.department || "N/A",
        p.contactNumber || "N/A",
    ])

    autoTable(doc, {
        startY: y,
        head: [["#", "Proponent Name", "Position", "Student No.", "Program & Yr", "Department", "Contact"]],
        headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        body: proponentRows,
    })

    y = (doc as any).lastAutoTable.finalY + 4

    // Budget Table
    let grandTotal = 0
    const budgetRows = (saafData.budgetItems || []).map((b) => {
        const qty = Number(b.quantity) || 0
        const price = Number(b.pricePerUnit) || 0
        const total = qty * price
        grandTotal += total
        return [
            String(b.item || ""),
            String(b.unit || "1"),
            String(qty),
            `PHP ${price.toFixed(2)}`,
            `PHP ${total.toFixed(2)}`,
        ]
    })

    budgetRows.push(["Grand Total", "", "", "", `PHP ${grandTotal.toFixed(2)}`])

    autoTable(doc, {
        startY: y,
        head: [["Item", "Unit", "Qty", "Price per Unit", "Total"]],
        headStyles: { fillColor: [60, 60, 60], textColor: [255, 255, 255], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        body: budgetRows,
    })

    // ================= PAGE 2: RESERVATION (IF APPLICABLE) =================
    if (reservationData) {
        doc.addPage()

        doc.setFillColor(...primaryRed)
        doc.rect(0, 0, 210, 18, "F")

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(13)
        doc.setFont("helvetica", "bold")
        doc.text("APPLICATION FORM ON USE OF FACILITIES", 105, 12, { align: "center" })

        let ry = 26

        // Equipment Requested
        const requestedEquip: string[] = []
        if (reservationData.equipment?.monoblock) requestedEquip.push("Monoblock Chairs")
        if (reservationData.equipment?.whiteboards) requestedEquip.push("White Boards")
        if (reservationData.equipment?.tables) requestedEquip.push("Tables")
        if (reservationData.equipment?.rostrum) requestedEquip.push("Rostrum")
        if (reservationData.equipment?.flags) requestedEquip.push("Flags (w/ Poles & Stand)")
        if (reservationData.equipment?.panelBoards) requestedEquip.push("Panel Boards")
        if (reservationData.equipment?.others && reservationData.otherEquipmentText) {
            requestedEquip.push(`Others: ${reservationData.otherEquipmentText}`)
        }

        autoTable(doc, {
            startY: ry,
            theme: "plain",
            styles: { fontSize: 8.5, cellPadding: 1 },
            body: [
                [{ content: "Equipment Requested:", styles: { fontStyle: "bold" } }],
                [requestedEquip.length > 0 ? requestedEquip.join("  •  ") : "None requested"],
            ],
        })

        ry = (doc as any).lastAutoTable.finalY + 4

        // General Facilities Table
        const facilityRows = (reservationData.facilityItems || []).map((f) => [
            f.item || "",
            f.dateOfUse || "",
            f.endDateOfUse || f.dateOfUse || "",
            f.timeOfUse || "",
            f.endTimeOfUse || f.timeOfUse || "",
            f.location || "",
        ])

        autoTable(doc, {
            startY: ry,
            head: [
                [
                    {
                        content: `General Facilities (Purpose: ${reservationData.purpose || "N/A"})`,
                        colSpan: 6,
                        styles: { halign: "left" },
                    },
                ],
                ["Item", "Start Date", "End Date", "Start Time", "End Time", "Location"],
            ],
            headStyles: { fillColor: primaryRed, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
            body: facilityRows,
            styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
            columnStyles: {
                0: { halign: "left" },
                5: { halign: "left" },
            },
        })

        ry = (doc as any).lastAutoTable.finalY + 4

        // Function Room Table
        const roomRows = (reservationData.roomItems || []).map((r) => [
            r.roomNeeded || "",
            r.dateNeeded || "",
            r.endDateNeeded || r.dateNeeded || "",
            r.timeNeeded || "",
            r.endTimeNeeded || r.timeNeeded || "",
            r.remarks || "",
        ])

        autoTable(doc, {
            startY: ry,
            head: [
                [
                    {
                        content: `Function Rooms (Purpose: ${reservationData.functionRoomPurpose || "N/A"})`,
                        colSpan: 6,
                        styles: { halign: "left" },
                    },
                ],
                ["Room Needed", "Start Date", "End Date", "Start Time", "End Time", "Remarks"],
            ],
            headStyles: { fillColor: primaryRed, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
            body: roomRows,
            styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
            columnStyles: {
                0: { halign: "left" },
                5: { halign: "left" },
            },
        })

        ry = (doc as any).lastAutoTable.finalY + 4

        // Audiovisual Equipment Table
        const avRows = (reservationData.avItems || []).map((a) => [
            a.equipmentNeeded || "",
            a.dateNeeded || "",
            a.endDateNeeded || a.dateNeeded || "",
            a.timeNeeded || "",
            a.endTimeNeeded || a.timeNeeded || "",
            a.remarks || "",
        ])

        autoTable(doc, {
            startY: ry,
            head: [
                [
                    {
                        content: `Audiovisual Equipment (Purpose: ${reservationData.avPurpose || "N/A"})`,
                        colSpan: 6,
                        styles: { halign: "left" },
                    },
                ],
                ["Equipment Needed", "Start Date", "End Date", "Start Time", "End Time", "Remarks"],
            ],
            headStyles: { fillColor: primaryRed, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
            body: avRows,
            styles: { fontSize: 7, cellPadding: 1.5, halign: "center" },
            columnStyles: {
                0: { halign: "left" },
                5: { halign: "left" },
            },
        })
    }

    // Download Trigger
    const fileName = saafData.activityTitle
        ? `${saafData.activityTitle.replace(/\s+/g, "_")}_Proposal.pdf`
        : "Activity_Proposal.pdf"
    doc.save(fileName)
}