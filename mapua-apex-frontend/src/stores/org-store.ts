import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_SAAF_DRAFT } from '@/components/submission/constants'
import type { SaafDraft } from '@/components/submission/types'
import type { ReservationDraft } from '@/components/reservation/types'

export type TaskStatus = 'Pending' | 'In Progress' | 'Completed'

export interface ChecklistItem {
  text: string;
  done: boolean;
  ownerName: string;
  ownerInitials: string;
  ownerColor: string;
  ownerBgColor: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  responsible: string;
  dueDate: string;
  checklist: ChecklistItem[];
}

export type SubmissionStatus = 'Submitted' | 'Under Review' | 'Approved' | 'Returned' | 'Denied' | 'Completed';

// NOTE: This model is for the frontend prototype stage, acting as in-memory state until a real backend/API is implemented.
export interface Submission {
  id: string;
  activity_classification: string;
  current_signatory: string;
  target_date: string;
  requires_venue?: boolean;
  submitted_date?: string;
  activity_details: {
    title: string;
    description: string;
    venue: string;
    date: string;
    time?: string;
    expected_attendees?: number;
    budget?: string;
    proponent?: string;
    requirements?: string[];
  };
  status: SubmissionStatus;
  statusColor: string;
}

export interface ActivityLog {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: Date;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'Policy' | 'System' | 'General';
  dateRange: string;
  author: string;
  authorRole: string;
  memoNumber?: string;
  isImportant: boolean;
}

/**
 * Returns the signatory routing sequence for a submission.
 * Submissions requiring a venue go through CDM; others skip it.
 */
export function getSignatorySequence(submission: Submission): string[] {
  if (submission.requires_venue) {
    return ['Adviser', 'Dean', 'CDM', 'OSAAR'];
  }
  return ['Adviser', 'Dean', 'OSAAR'];
}

interface OrgState {
  // Activity Feed
  activities: ActivityLog[];
  logActivity: (title: string, description: string, type: ActivityLog['type']) => void;

  // Calendar
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  calendarEvents: Record<string, { title: string; time?: string }[]>; // "YYYY-MM-DD" mapping
  addCalendarEvent: (date: Date, title: string, time?: string) => void;

  // Milestone Tasks
  milestoneTasks: Task[];
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  toggleTaskStatus: (id: string) => void;
  toggleChecklistItem: (taskId: string, index: number) => void;
  addMilestoneTask: (title: string, responsible: string, dueDate: string) => void;
  deleteMilestoneTask: (id: string) => void;
  addChecklistItem: (taskId: string) => void;
  updateChecklistItem: (taskId: string, index: number, field: keyof ChecklistItem, value: string | boolean) => void;
  removeChecklistItem: (taskId: string, index: number) => void;

  // Announcements
  announcements: Announcement[];

  // Submissions (SAAF)
  submissions: Submission[];
  addSubmission: (submission: Omit<Submission, 'id' | 'status' | 'statusColor'>) => void;

  // Submissions wizard start
  eventName: string
  reserveFacilities: "yes" | "no" | null
  saafValidated: boolean
  setSaafValidated: (value: boolean) => void
  setSubmissionStart: (eventName: string, reserveFacilities: "yes" | "no") => void
  clearSubmissionStart: () => void

  // SAAF Draft
  saafDraft: SaafDraft | null;
  setSaafDraft: (draft: SaafDraft) => void;
  patchSaafDraft: (patch: Partial<SaafDraft>) => void;
  clearSaafDraft: () => void;

  // Reservation Draft
  reservationDraft: ReservationDraft | null;
  setReservationDraft: (draft: ReservationDraft) => void;
  patchReservationDraft: (patch: Partial<ReservationDraft>) => void;
  clearReservationDraft: () => void;

  editingEventId: string | null;
  editingSubmissionId: string | null;
  setEditingSubmission: (eventId: string, submissionId: string) => void;
  clearEditingSubmission: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
  // Activity Feed
  activities: [],
  logActivity: (title, description, type) => set((state) => ({
    activities: [{ id: `act-${Date.now()}`, title, description, type, timestamp: new Date() }, ...state.activities]
  })),

  // Calendar
  selectedDate: undefined,
  setSelectedDate: (date) => set({ selectedDate: date }),
  calendarEvents: {},
  addCalendarEvent: (date, title, time) => {
    set((state) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const existing = state.calendarEvents[key] || [];
      return {
        calendarEvents: {
          ...state.calendarEvents,
          [key]: [...existing, { title, time }]
        }
      };
    });
    get().logActivity('Event added', `Added ${title} on ${date.toLocaleDateString()}`, 'info');
  },

  // Milestone Tasks
  activeTaskId: null,
  setActiveTaskId: (id) => set({ activeTaskId: id }),
  milestoneTasks: [],
  toggleTaskStatus: (id) => {
    set((state) => {
      let taskTitle = "";
      let statusResult = "";
      const newState = {
        milestoneTasks: state.milestoneTasks.map(task => {
          if (task.id === id) {
            taskTitle = task.title;
            const nextStatus: Record<TaskStatus, TaskStatus> = {
              'Pending': 'In Progress',
              'In Progress': 'Completed',
              'Completed': 'Pending'
            };
            statusResult = nextStatus[task.status];
            return { ...task, status: nextStatus[task.status] };
          }
          return task;
        })
      };
      if (taskTitle) {
        get().logActivity('Task status updated', `${taskTitle} marked as ${statusResult}`, statusResult === 'Completed' ? 'success' : 'info');
      }
      return newState;
    });
  },
  toggleChecklistItem: (taskId, index) => {
    set((state) => {
      let taskTitle = "";
      let itemName = "";
      let itemDone = false;
      let newStatus = "";
      let oldStatus = "";

      const newState = {
        milestoneTasks: state.milestoneTasks.map(task => {
          if (task.id === taskId) {
            taskTitle = task.title;
            oldStatus = task.status;
            const newChecklist = [...task.checklist];
            newChecklist[index].done = !newChecklist[index].done;
            itemName = newChecklist[index].text;
            itemDone = newChecklist[index].done;

            // Auto-complete task logic
            const allDone = newChecklist.length > 0 && newChecklist.every(item => item.done);
            newStatus = task.status;
            if (allDone) {
              newStatus = 'Completed';
            } else if (newChecklist.some(item => item.done) && task.status === 'Pending') {
              newStatus = 'In Progress';
            } else if (!allDone && task.status === 'Completed') {
              newStatus = 'In Progress';
            }

            return { ...task, checklist: newChecklist, status: newStatus as TaskStatus };
          }
          return task;
        })
      };

      if (taskTitle) {
        if (newStatus !== oldStatus) {
          get().logActivity(`Task ${newStatus.toLowerCase()}`, `${taskTitle} is now ${newStatus}`, newStatus === 'Completed' ? 'success' : 'info');
        } else {
          get().logActivity('Checklist updated', `${itemName} marked as ${itemDone ? 'done' : 'undone'} in ${taskTitle}`, 'info');
        }
      }

      return newState;
    });
  },
  addMilestoneTask: (title, responsible, dueDate) => {
    set((state) => {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title,
        status: 'Pending',
        responsible: responsible || 'Unassigned',
        dueDate: dueDate || 'TBD',
        checklist: []
      };
      return { milestoneTasks: [...state.milestoneTasks, newTask] };
    });
    get().logActivity('New task added', title, 'info');
  },
  deleteMilestoneTask: (id) => set((state) => {
    const taskToDelete = state.milestoneTasks.find(t => t.id === id);
    if (taskToDelete) {
      get().logActivity('Task deleted', `Deleted task "${taskToDelete.title}"`, 'warning');
    }
    return {
      milestoneTasks: state.milestoneTasks.filter(t => t.id !== id),
      activeTaskId: state.activeTaskId === id ? (state.milestoneTasks.find(t => t.id !== id)?.id || null) : state.activeTaskId
    };
  }),
  addChecklistItem: (taskId) => set((state) => {
    let taskTitle = "";
    const newState = {
      milestoneTasks: state.milestoneTasks.map(task => {
        if (task.id === taskId) {
          taskTitle = task.title;
          const newItem: ChecklistItem = {
            text: '',
            done: false,
            ownerName: '',
            ownerInitials: '?',
            ownerColor: 'text-[#475569]',
            ownerBgColor: 'bg-neutral-100',
          };
          return { ...task, checklist: [...task.checklist, newItem] };
        }
        return task;
      })
    };
    if (taskTitle) {
      get().logActivity('Checklist item added', `Added new checklist item to "${taskTitle}"`, 'info');
    }
    return newState;
  }),
  updateChecklistItem: (taskId, index, field, value) => {
    set((state) => {
      let logged = false;
      let proponentName = "";
      let taskTitle = "";

      const newState = {
        milestoneTasks: state.milestoneTasks.map(task => {
          if (task.id === taskId) {
            taskTitle = task.title;
            const newChecklist = [...task.checklist];
            const oldName = newChecklist[index].ownerName;
            const updatedItem = { ...newChecklist[index], [field]: value };

            // Auto-update initials if name changes
            if (field === 'ownerName' && typeof value === 'string') {
              updatedItem.ownerInitials = value.trim() ? value.trim().charAt(0).toUpperCase() : '?';
              if (value.trim() && value !== oldName) {
                logged = true;
                proponentName = value.trim();
              }
            }

            newChecklist[index] = updatedItem;
            return { ...task, checklist: newChecklist };
          }
          return task;
        })
      };

      if (logged) {
        get().logActivity('Proponent assigned', `${proponentName} was assigned to a task in "${taskTitle}"`, 'info');
      }

      return newState;
    });
  },
  removeChecklistItem: (taskId, index) => set((state) => {
    let taskTitle = "";
    let itemText = "";
    const newState = {
      milestoneTasks: state.milestoneTasks.map(task => {
        if (task.id === taskId) {
          taskTitle = task.title;
          const newChecklist = [...task.checklist];
          itemText = newChecklist[index]?.text || 'item';
          newChecklist.splice(index, 1);

          // Re-evaluate task status if checklist changed
          const allDone = newChecklist.length > 0 && newChecklist.every(item => item.done);
          let newStatus = task.status;
          if (allDone) {
            newStatus = 'Completed';
          } else if (!allDone && task.status === 'Completed') {
            newStatus = newChecklist.some(item => item.done) ? 'In Progress' : 'Pending';
          }

          return { ...task, checklist: newChecklist, status: newStatus };
        }
        return task;
      })
    };
    if (taskTitle) {
      get().logActivity('Checklist item removed', `Removed "${itemText}" from "${taskTitle}"`, 'info');
    }
    return newState;
  }),

  // Announcements
  announcements: [],

  // Submissions (SAAF)
  submissions: [],
  addSubmission: (submission) => {
    set((state) => {
      const newSubmission: Submission = {
        ...submission,
        id: `SAAF-${Date.now()}`,
        status: 'Submitted',
        statusColor: 'text-[#475569]'
      };
      get().logActivity('New Submission', `${submission.activity_details.title} was submitted.`, 'info');
      return { submissions: [newSubmission, ...state.submissions] };
    });
  },

  eventName: "",
  reserveFacilities: null,
  saafValidated: false,
  setSaafValidated: (value) => set({ saafValidated: value }),
  setSubmissionStart: (eventName, reserveFacilities) =>
    set({ eventName, reserveFacilities, saafValidated: false }),
  clearSubmissionStart: () => set({ eventName: "", reserveFacilities: null, saafValidated: false }),

  // SAAF Draft
  saafDraft: null,
  setSaafDraft: (draft) => set({ saafDraft: draft }),
  patchSaafDraft: (patch) =>
    set((state) => ({
      saafDraft: {
        ...DEFAULT_SAAF_DRAFT,
        ...(state.saafDraft ?? {}),
        ...patch,
      },
    })),
  clearSaafDraft: () => set({ saafDraft: null }),

  // Reservation Draft
  reservationDraft: null,
  setReservationDraft: (draft) => set({ reservationDraft: draft }),
  patchReservationDraft: (patch) =>
    set((state) => ({
      reservationDraft: { ...(state.reservationDraft ?? {}), ...patch } as ReservationDraft,
    })),
  clearReservationDraft: () => set({ reservationDraft: null }),

  editingEventId: null,
  editingSubmissionId: null,
  setEditingSubmission: (eventId, submissionId) =>
    set({ editingEventId: eventId, editingSubmissionId: submissionId }),
  clearEditingSubmission: () =>
    set({ editingEventId: null, editingSubmissionId: null }),
}),
    {
      name: "apex_org_wizard_v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        eventName: state.eventName,
        reserveFacilities: state.reserveFacilities,
        saafValidated: state.saafValidated,
        saafDraft: state.saafDraft,
        reservationDraft: state.reservationDraft,
        editingEventId: state.editingEventId,
        editingSubmissionId: state.editingSubmissionId,
      }),
    }
  )
)
