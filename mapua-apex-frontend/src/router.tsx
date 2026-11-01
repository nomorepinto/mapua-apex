import { createBrowserRouter, Navigate, Outlet } from "react-router"

import { layout } from "@/config"
import { SESSION_LOG_GROUPS, ACTIVITY_LOG_GROUPS } from "@/constants/auth"
import { AdminLayout } from "@/routes/layouts/admin-layout"
import { CdmReviewerLayout } from "@/routes/layouts/cdm-reviewer-layout"
import { DeanLayout } from "@/routes/layouts/dean-layout"
import { OrgAdviserLayout } from "@/routes/layouts/org-adviser-layout"
import { OsaarLayout } from "@/routes/layouts/osaar-layout"
import { ReservablesIndexRedirect, ReservablesLayout } from "@/routes/cdm-reviewer/reservables"
import { OsaarDashboardLayout } from "@/routes/osaar/dashboard"
import { OsaarSetupLayout } from "@/routes/osaar/setup"
import { StudentsLayout } from "@/routes/layouts/students-layout"
import { RootErrorBoundary, NotFoundPage } from "@/components/layout/error-boundary"

function RouteFallback() {
  return (
    <div className={layout.center}>
      <div
        aria-live="polite"
        className="flex flex-col items-center space-y-4"
        role="status"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B0000] border-t-transparent" />
        <p className="text-sm font-medium text-neutral-600">Loading page…</p>
      </div>
    </div>
  )
}

function PassThroughLayout() {
  return <Outlet />
}

import { AuthGuard } from "@/components/auth/AuthGuard"

export const router = createBrowserRouter([
  {
    path: "/",
    HydrateFallback: RouteFallback,
    ErrorBoundary: RootErrorBoundary,
    lazy: async () => {
      const { LandingPage } = await import("@/routes/landing")
      return { Component: LandingPage }
    },
  },
  {
    path: "students",
    Component: StudentsLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/students/dashboard" replace />,
      },
      {
        path: "dashboard",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { OrgDashboard } = await import("@/routes/students/dashboard")
          return { Component: OrgDashboard }
        },
      },
      {
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
      {
        path: "submissions",
        Component: PassThroughLayout,
        children: [
          {
            index: true,
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { SubmissionsStart } = await import(
                "@/routes/students/submissions"
              )
              return { Component: SubmissionsStart }
            },
          },
          {
            path: "saaf",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const [{ Submission }, { action }] = await Promise.all([
                import("@/routes/students/saaf"),
                import("@/routes/students/saaf.action"),
              ])
              return { Component: Submission, action }
            },
          },
        ],
      },
      {
        path: "postevals",
        Component: PassThroughLayout,
        children: [
          {
            index: true,
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { PostEvalsStart } = await import(
                "@/routes/students/postevals"
              )
              return { Component: PostEvalsStart }
            },
          },
          {
            path: "wizard",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const [{ PostEvalWizard }, { action }] = await Promise.all([
                import("@/routes/students/posteval-wizard"),
                import("@/routes/students/posteval-wizard.action"),
              ])
              return { Component: PostEvalWizard, action }
            },
          },
        ],
      },
      {
        path: "tools",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { Tools } = await import("@/routes/students/tools")
          return { Component: Tools }
        },
      },
      {
        path: "members",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { StudentMembersPage } = await import(
            "@/routes/students/members"
          )
          return { Component: StudentMembersPage }
        },
      },
      {
        path: "*",
        Component: () => <Navigate to="/students/dashboard" replace />,
      },
    ],
  },
  {
    path: "cdm",
    Component: CdmReviewerLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/cdm/dashboard" replace />,
      },
      {
        path: "dashboard",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { CdmReviewerDashboard } = await import(
            "@/routes/cdm-reviewer/dashboard"
          )
          return { Component: CdmReviewerDashboard }
        },
      },
      {
        path: "reservables",
        Component: ReservablesLayout,
        children: [
          {
            index: true,
            Component: ReservablesIndexRedirect,
          },
          {
            path: "add",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AddReservableSection } = await import(
                "@/components/admin/reservables/add-reservable-section"
              )
              return { Component: AddReservableSection }
            },
          },
          {
            path: "view",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { ViewReservableSection } = await import(
                "@/components/admin/reservables/view-reservable-section"
              )
              return { Component: ViewReservableSection }
            },
          },
          {
            path: "reserve",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { ReserveSection } = await import(
                "@/components/admin/reservables/reserve-section"
              )
              return { Component: ReserveSection }
            },
          },
        ],
      },
      {
        path: "reservations",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { CdmReservationsPage } = await import(
            "@/routes/cdm-reviewer/reservations"
          )
          return { Component: CdmReservationsPage }
        },
      },
      {
        path: "activities",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminMonitorActivitiesPage } = await import(
            "@/routes/admin/monitor-activities"
          )
          return {
            Component: () => (
              <AuthGuard allowedGroups={ACTIVITY_LOG_GROUPS}>
                <AdminMonitorActivitiesPage />
              </AuthGuard>
            ),
          }
        },
      },
      {
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
      {
        path: "*",
        Component: () => <Navigate to="/cdm/dashboard" replace />,
      },
    ],
  },
  {
    path: "dean",
    Component: DeanLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/dean/dashboard" replace />,
      },
      {
        path: "dashboard",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { DeanDashboard } = await import("@/routes/dean/dashboard")
          return { Component: DeanDashboard }
        },
      },
      {
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
      {
        path: "*",
        Component: () => <Navigate to="/dean/dashboard" replace />,
      },
    ],
  },
  {
    path: "adviser",
    Component: OrgAdviserLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/adviser/dashboard" replace />,
      },
      {
        path: "dashboard",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { OrgAdviserDashboard } = await import(
            "@/routes/org-adviser/dashboard"
          )
          return { Component: OrgAdviserDashboard }
        },
      },
      {
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
      {
        path: "*",
        Component: () => <Navigate to="/adviser/dashboard" replace />,
      },
    ],
  },
  {
    path: "osaar",
    Component: OsaarLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/osaar/dashboard" replace />,
      },
      {
        path: "dashboard",
        Component: OsaarDashboardLayout,
        children: [
          {
            index: true,
            Component: () => <Navigate to="/osaar/dashboard/review" replace />,
          },
          {
            path: "review",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminDashboardReviewPage } = await import(
                "@/routes/osaar/dashboard-review"
              )
              return { Component: AdminDashboardReviewPage }
            },
          },
          {
            path: "calendar",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminDashboardCalendarPage } = await import(
                "@/routes/osaar/dashboard-calendar"
              )
              return { Component: AdminDashboardCalendarPage }
            },
          },
          {
            path: "submissions",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminDashboardSubmissionsPage } = await import(
                "@/routes/osaar/dashboard-submissions"
              )
              return { Component: AdminDashboardSubmissionsPage }
            },
          },
          {
            path: "announcements",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminDashboardAnnouncementsPage } = await import(
                "@/routes/osaar/dashboard-announcements"
              )
              return { Component: AdminDashboardAnnouncementsPage }
            },
          },
        ],
      },
      {
        path: "setup",
        Component: OsaarSetupLayout,
        children: [
          {
            index: true,
            Component: () => <Navigate to="/osaar/setup/organizations" replace />,
          },
          {
            path: "organizations",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminOrganizationsPage } = await import(
                "@/routes/osaar/organizations"
              )
              return { Component: AdminOrganizationsPage }
            },
          },
          {
            path: "signatories",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminSignatoriesPage } = await import(
                "@/routes/osaar/signatories"
              )
              return { Component: AdminSignatoriesPage }
            },
          },
          {
            path: "approval-stages",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminApprovalStagesPage } = await import(
                "@/routes/osaar/approval-stages"
              )
              return { Component: AdminApprovalStagesPage }
            },
          },
          {
            path: "campuses",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminCampusPage } = await import("@/routes/osaar/campus")
              return { Component: AdminCampusPage }
            },
          },
        ],
      },
      {
        path: "review",
        Component: PassThroughLayout,
        children: [
          {
            index: true,
            Component: () => <Navigate to="/osaar/dashboard/review" replace />,
          },
          {
            path: "*",
            Component: () => <Navigate to="/osaar/dashboard/review" replace />,
          },
        ],
      },
      {
        path: "postevals",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminPostEvals } = await import("@/routes/osaar/postevals")
          return { Component: AdminPostEvals }
        },
      },
      {
        path: "activities",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminMonitorActivitiesPage } = await import(
            "@/routes/admin/monitor-activities"
          )
          return {
            Component: () => (
              <AuthGuard allowedGroups={ACTIVITY_LOG_GROUPS}>
                <AdminMonitorActivitiesPage />
              </AuthGuard>
            ),
          }
        },
      },
      {
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
      {
        path: "*",
        Component: () => <Navigate to="/osaar/dashboard" replace />,
      },
    ],
  },
  {
    path: "admin",
    Component: AdminLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/admin/sessions" replace />,
      },
      {
        path: "sessions",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminMonitorSessionsPage } = await import(
            "@/routes/admin/monitor-sessions"
          )
          return {
            Component: () => (
              <AuthGuard allowedGroups={SESSION_LOG_GROUPS}>
                <AdminMonitorSessionsPage />
              </AuthGuard>
            ),
          }
        },
      },
      {
        path: "activities",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminMonitorActivitiesPage } = await import(
            "@/routes/admin/monitor-activities"
          )
          return {
            Component: () => (
              <AuthGuard allowedGroups={ACTIVITY_LOG_GROUPS}>
                <AdminMonitorActivitiesPage />
              </AuthGuard>
            ),
          }
        },
      },
      {
        path: "monitor",
        Component: PassThroughLayout,
        children: [
          {
            index: true,
            Component: () => <Navigate to="/admin/sessions" replace />,
          },
          {
            path: "overview",
            Component: () => <Navigate to="/admin/sessions" replace />,
          },
          {
            path: "sessions",
            Component: () => <Navigate to="/admin/sessions" replace />,
          },
          {
            path: "activities",
            Component: () => <Navigate to="/admin/activities" replace />,
          },
        ],
      },
      {
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
      {
        path: "*",
        Component: () => <Navigate to="/admin/sessions" replace />,
      },
    ],
  },
  {
    path: "*",
    ErrorBoundary: RootErrorBoundary,
    Component: NotFoundPage,
  },
])
