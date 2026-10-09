import { createBrowserRouter, Navigate, Outlet } from "react-router"

import { layout } from "@/config"
import { SESSION_LOG_GROUPS, ACTIVITY_LOG_GROUPS } from "@/constants/auth"
import { AdminLayout } from "@/routes/layouts/admin-layout"
import { CdmReviewerLayout } from "@/routes/layouts/cdm-reviewer-layout"
import { DeanLayout } from "@/routes/layouts/dean-layout"
import { OrgAdviserLayout } from "@/routes/layouts/org-adviser-layout"
import { OsaarLayout } from "@/routes/layouts/osaar-layout"
import { StudentsLayout } from "@/routes/layouts/students-layout"

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
import { RoleRedirect } from "@/components/auth/RoleRedirect"

export const router = createBrowserRouter([
  {
    path: "/",
    Component: () => (
      <AuthGuard>
        <RoleRedirect />
      </AuthGuard>
    ),
  },
  {
    path: "monitor",
    children: [
      { index: true, Component: () => <Navigate to="/admin/sessions" replace /> },
      { path: "overview", Component: () => <Navigate to="/admin/sessions" replace /> },
      { path: "sessions", Component: () => <Navigate to="/admin/sessions" replace /> },
      { path: "activities", Component: () => <Navigate to="/admin/activities" replace /> },
    ],
  },
  {
    path: "students",
    Component: StudentsLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
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
    ],
  },
  {
    path: "cdm-reviewer",
    Component: CdmReviewerLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
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
    ],
  },
  {
    path: "dean",
    Component: DeanLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
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
    ],
  },
  {
    path: "org-adviser",
    Component: OrgAdviserLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
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
    ],
  },
  {
    path: "signatories",
    Component: DeanLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
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
    ],
  },
  {
    path: "osaar",
    Component: OsaarLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
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
        path: "review",
        Component: PassThroughLayout,
        children: [
          {
            index: true,
            Component: () => <Navigate to="dashboard" replace />,
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
        path: "about",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { About } = await import("@/routes/about")
          return { Component: About }
        },
      },
    ],
  },
  {
    path: "admin",
    Component: AdminLayout,
    children: [
      {
        index: true,
        Component: () => <Navigate to="dashboard" replace />,
      },
      {
        path: "dashboard",
        HydrateFallback: RouteFallback,
        lazy: async () => {
          const { AdminDashboard } = await import("@/routes/admin/dashboard")
          return { Component: AdminDashboard }
        },
      },
      {
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
    ],
  },
])
