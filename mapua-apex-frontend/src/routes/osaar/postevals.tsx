import { PostEvalQueue } from "@/components/osaar/postevals/posteval-queue"
import { PostEvalReviewDialog } from "@/components/osaar/postevals/posteval-review-dialog"
import { PostEvalsReviewProvider } from "@/components/osaar/postevals/postevals-review-context"
import { layout } from "@/config"
import { cn } from "@/lib/utils"

function AdminPostEvalsContent() {
  return (
    <div className={cn(layout.container, layout.stack)}>
      <div className="space-y-1">
        <h1 className={layout.pageTitle}>Post-Evaluations</h1>
        <p className={layout.pageSubtitle}>
          Review post-evaluation reports filed by organizations. Approving marks
          the linked submission finished.
        </p>
      </div>
      <PostEvalQueue />
    </div>
  )
}

export function AdminPostEvals() {
  return (
    <PostEvalsReviewProvider>
      <div className={layout.page}>
        <AdminPostEvalsContent />
        <PostEvalReviewDialog />
      </div>
    </PostEvalsReviewProvider>
  )
}
