import { layout } from "@/config"

export function FormPageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="border-b border-neutral-200 pb-5">
      <h1 className={layout.pageTitle}>{title}</h1>
      <p className={layout.pageSubtitle}>{subtitle}</p>
    </div>
  )
}
