import { useCallback, useState } from "react"

import { exportAuditLogCsv } from "@/components/admin-osa/audit"
import type { Announcement } from "@/lib/types"
import { toastManager } from "@/components/ui/toast"
import { useAdminOsaStore } from "@/stores/admin-osa-store"

export function useAdminOsaPanel() {
  const orgViews = useAdminOsaStore((state) => state.orgViews)
  const announcements = useAdminOsaStore((state) => state.announcements)
  const createAnnouncement = useAdminOsaStore((state) => state.createAnnouncement)
  const updateAnnouncement = useAdminOsaStore((state) => state.updateAnnouncement)
  const deleteAnnouncement = useAdminOsaStore((state) => state.deleteAnnouncement)
  const getAllAuditLogs = useAdminOsaStore((state) => state.getAllAuditLogs)

  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [announcementModalMode, setAnnouncementModalMode] = useState<
    "create" | "edit"
  >("create")
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<
    string | null
  >(null)
  const [editInitialTitle, setEditInitialTitle] = useState("")
  const [editInitialMessage, setEditInitialMessage] = useState("")

  const handleOpenCreateModal = useCallback(() => {
    setAnnouncementModalMode("create")
    setEditingAnnouncementId(null)
    setEditInitialTitle("")
    setEditInitialMessage("")
    setShowAnnouncementModal(true)
  }, [])

  const handleOpenEditModal = useCallback((announcement: Announcement) => {
    setAnnouncementModalMode("edit")
    setEditingAnnouncementId(announcement.id)
    setEditInitialTitle(announcement.title)
    setEditInitialMessage(announcement.title)
    setShowAnnouncementModal(true)
  }, [])

  const handleAnnouncementSubmit = useCallback(
    (title: string) => {
      if (announcementModalMode === "edit" && editingAnnouncementId) {
        updateAnnouncement(editingAnnouncementId, title)
      } else {
        createAnnouncement(title)
      }
      setShowAnnouncementModal(false)
    },
    [
      announcementModalMode,
      createAnnouncement,
      editingAnnouncementId,
      updateAnnouncement,
    ]
  )

  const handleExportAuditLog = useCallback(() => {
    const logs = getAllAuditLogs()
    if (logs.length === 0) {
      toastManager.add({
        title: "No audit logs",
        description: "There is nothing to export yet.",
        type: "error",
      })
      return
    }
    const orgNameMap = new Map(orgViews.map((org) => [org.id, org.name]))
    exportAuditLogCsv(logs, orgNameMap)
  }, [getAllAuditLogs, orgViews])

  return {
    announcements,
    deleteAnnouncement,
    showAnnouncementModal,
    setShowAnnouncementModal,
    announcementModalMode,
    editingAnnouncementId,
    editInitialTitle,
    editInitialMessage,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleAnnouncementSubmit,
    handleExportAuditLog,
  }
}
