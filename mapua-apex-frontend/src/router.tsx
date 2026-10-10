import { createBrowserRouter, Navigate, Outlet } from "react-router"

import { layout } from "@/config"
import { SESSION_LOG_GROUPS, ACTIVITY_LOG_GROUPS } from "@/constants/auth"
import { AdminLayout } from "@/routes/layouts/admin-layout"
import { CdmReviewerLayout } from "@/routes/layouts/cdm-reviewer-layout"
import { DeanLayout } from "@/routes/layouts/dean-layout"
import { OrgAdviserLayout } from "@/routes/layouts/org-adviser-layout"
import { OsaarLayout } from "@/routes/layouts/osaar-layout"
import { OsaarSetupLayout } from "@/routes/osaar/setup"
import { StudentsLayout } from "@/routes/layouts/students-layout"
import { RootErrorBoundary, NotFoundPage } from "@/components/layout/error-boundary"

function RouteFallback() {
  return (
    <div className={layout.fallback} role="status" aria-live="polite">
      Loading page…
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
        path: "*",
        Component: () => <Navigate to="/students/dashboard" replace />,
      },
    ],
  },
  {
    path: "cdm-reviewer",
    Component: CdmReviewerLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/cdm-reviewer/dashboard" replace />,
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
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminReservablesPage } = await import(
            "@/routes/cdm-reviewer/reservables"
          )
          return { Component: AdminReservablesPage }
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
        Component: () => <Navigate to="/cdm-reviewer/dashboard" replace />,
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
    path: "org-adviser",
    Component: OrgAdviserLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/org-adviser/dashboard" replace />,
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
        Component: () => <Navigate to="/org-adviser/dashboard" replace />,
      },
    ],
  },
  {
    path: "signatories",
    Component: DeanLayout,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: () => <Navigate to="/signatories/dashboard" replace />,
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
        Component: () => <Navigate to="/signatories/dashboard" replace />,
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
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminOsaPanel } = await import("@/routes/osaar/dashboard")
          return { Component: AdminOsaPanel }
        },
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
            Component: () => <Navigate to="/osaar/review/dashboard" replace />,
          },
          {
            path: "dashboard",
            HydrateFallback: RouteFallback,
            lazy: async () => {
              const { AdminReviewDashboard } = await import(
                "@/routes/osaar/review-dashboard"
              )
              return { Component: AdminReviewDashboard }
            },
          },
        ],
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
