/**
 * Maps frontend route paths to human-readable page names for session page-visit tracking.
 */
export function getPageName(path: string): string {
  const cleanPath = path.split("?")[0].replace(/\/$/, "") || "/";

  if (cleanPath === "/" || cleanPath === "/login") return "Login Page";
  if (cleanPath === "/dashboard") return "Dashboard";

  // Student routes
  if (cleanPath === "/student/dashboard") return "Student Dashboard";
  if (cleanPath === "/student/submissions") return "My Submissions";
  if (cleanPath.startsWith("/student/submissions/new")) return "New Event Proposal";
  if (cleanPath.startsWith("/student/submissions/")) return "Submission Details";
  if (cleanPath === "/student/deadlines") return "Submissions & Deadlines";
  if (cleanPath === "/student/announcements") return "Student Announcements";
  if (cleanPath === "/student/organization") return "My Organization Profile";
  if (cleanPath === "/student/organizations") return "Campus Organizations Directory";

  // Signatory routes
  if (cleanPath === "/signatory/dashboard") return "Signatory Dashboard";
  if (cleanPath === "/signatory/submissions") return "Review Submissions Queue";
  if (cleanPath.startsWith("/signatory/submissions/")) return "Review Event Proposal";
  if (cleanPath === "/signatory/profile") return "Signatory Profile";

  // Admin routes
  if (cleanPath === "/admin/dashboard") return "Admin Dashboard";
  if (cleanPath === "/admin/submissions") return "All Submissions";
  if (cleanPath.startsWith("/admin/submissions/")) return "Admin Submission View";
  if (cleanPath === "/admin/announcements") return "Manage Announcements";
  if (cleanPath === "/admin/organizations") return "Manage Organizations";
  if (cleanPath === "/admin/signatories") return "Manage Signatories";

  // Super Admin Monitor
  if (cleanPath === "/admin/monitor") return "System Monitor";

  return cleanPath.replace(/^\//, "").replace(/\//g, " > ") || "Home";
}
