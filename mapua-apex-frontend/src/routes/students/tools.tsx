import { ClipboardListIcon, ExternalLinkIcon, QrCodeIcon } from "lucide-react"

import { FormPageHeader } from "@/components/forms/form-page-header"
import { Button } from "@/components/ui/button"
import { layout } from "@/config"
import { useCurrentOrganizationQuery } from "@/hooks/use-submissions"
import { arcusAttendanceUrl, arcusEvaluationUrl } from "@/lib/arcus-links"
import { cn } from "@/lib/utils"

type ToolCard = {
  href: string
  icon: typeof QrCodeIcon
  title: string
  description: string
}

/**
 * Student-facing launchpad for the two arcus companion apps. A card is rendered
 * only when its base URL is configured, so an unset `VITE_ARCUS_*_URL` hides the
 * entry instead of linking nowhere.
 */
export function Tools() {
  const organizationQuery = useCurrentOrganizationQuery()
  const filesPostEval = organizationQuery.data?.is_higher_council !== true
  const attendanceUrl = arcusAttendanceUrl()
  const evaluationUrl = arcusEvaluationUrl()

  const tools: ToolCard[] = []
  if (attendanceUrl) {
    tools.push({
      href: attendanceUrl,
      icon: QrCodeIcon,
      title: "Attendance Scanner",
      description:
        "Scan participant QR codes on the event day to record attendance for your organization's approved events.",
    })
  }
  if (evaluationUrl) {
    tools.push({
      href: evaluationUrl,
      icon: ClipboardListIcon,
      title: "Evaluation System",
      description: filesPostEval
        ? "Capture participant evaluations for events happening today. Responses feed your post-evaluation report."
        : "Capture participant evaluations for events happening today.",
    })
  }

  return (
    <div className={cn(layout.page, layout.stack)}>
      <div className={cn(layout.container, layout.stack)}>
        <FormPageHeader
          title="Tools"
          subtitle="Companion apps for running your event on the day."
        />

        {tools.length === 0 ? (
          <div className={cn(layout.section, layout.empty)}>
            <p className="text-sm font-medium text-neutral-600">
              No companion tools are configured yet.
            </p>
          </div>
        ) : (
          <div className={cn(layout.grid2, layout.gap)}>
            {tools.map((tool) => (
              <div
                key={tool.href}
                className={cn(layout.section, "flex flex-col gap-3")}
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#8B0000]/10 text-[#8B0000]">
                  <tool.icon className="size-5" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-neutral-900">
                    {tool.title}
                  </h2>
                  <p className="text-sm text-neutral-600">{tool.description}</p>
                </div>
                <div className="pt-1">
                  <Button
                    render={
                      <a href={tool.href} target="_blank" rel="noreferrer" />
                    }
                    className="min-w-32"
                  >
                    Open
                    <ExternalLinkIcon className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
