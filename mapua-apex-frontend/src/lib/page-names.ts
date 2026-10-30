/**
 * Maps frontend route paths to human-readable page names for session page-visit tracking.
 */
export function getPageName(path: string): string {
  const cleanPath = path.split("?")[0].replace(/\/$/, "") || "/";

  if (cleanPath === "/") return "Login Page";

  if (cleanPath === "/students/submissions/saaf") return "Event proposal";
  if (cleanPath === "/students/submissions") return "New proposal";
  if (cleanPath === "/students/postevals/wizard") return "Post-eval wizard";
  if (cleanPath === "/students/postevals") return "Post-evals";
  if (cleanPath === "/students/dashboard") return "Student Dashboard";
  if (cleanPath === "/students/members") return "Members";
  if (cleanPath === "/students/tools") return "Tools";

  if (cleanPath === "/cdm/reservables/add") return "Reservables · Add";
  if (cleanPath === "/cdm/reservables/view") return "Reservables · View";
  if (cleanPath === "/cdm/reservables/reserve") return "Reservables · Reserve";
  if (cleanPath === "/cdm/dashboard") return "CDM Dashboard";
  if (cleanPath === "/cdm/reservations") return "Reservations";
  if (cleanPath === "/cdm/activities") return "Activity Log";

  if (cleanPath === "/dean/dashboard") return "Dean Dashboard";
  if (cleanPath === "/adviser/dashboard") return "Adviser Dashboard";

  if (cleanPath === "/osaar/dashboard/review") return "Review";
  if (cleanPath === "/osaar/dashboard/calendar") return "All submissions calendar";
  if (cleanPath === "/osaar/dashboard/submissions") return "All submissions";
  if (cleanPath === "/osaar/dashboard/announcements") return "Announcements";
  if (cleanPath === "/osaar/dashboard") return "OSAAR Dashboard";
  if (cleanPath === "/osaar/setup/organizations") return "Organizations";
  if (cleanPath === "/osaar/setup/signatories") return "Signatories";
  if (cleanPath === "/osaar/setup/approval-stages") return "Approval stages";
  if (cleanPath === "/osaar/setup/campuses") return "Campuses";
  if (cleanPath === "/osaar/postevals") return "Post-Evaluations";
  if (cleanPath === "/osaar/activities") return "Activity Log";

  if (cleanPath === "/admin/sessions") return "Session Log";
  if (cleanPath === "/admin/activities") return "Activity Log";

  if (/^\/(students|cdm|dean|adviser|osaar|admin)\/about$/.test(cleanPath)) {
    return "About APEX";
  }

  return cleanPath.replace(/^\//, "").replace(/\//g, " > ") || "Home";
}
