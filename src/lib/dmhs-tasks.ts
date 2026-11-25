import type {
  CampusTaskItem,
  Role,
  StaffMemberRecord,
  TeacherRecord,
} from '@/components/school/types'

function normName(raw?: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\s+/g, ' ')
}

export function taskBelongsToActor(
  task: CampusTaskItem,
  role: Role,
  linkedEntityId: string,
  teachers: TeacherRecord[],
  staffMembers: StaffMemberRecord[],
): boolean {
  if (role === 'admin') return true
  if (role === 'teacher') {
    if (task.assigneeId && task.assigneeId === linkedEntityId) return true
    const tch = teachers.find((t) => t.id === linkedEntityId)
    if (tch && normName(task.assigneeName) === normName(tch.name)) return true
    return false
  }
  if (role === 'staff') {
    if (task.assigneeId && task.assigneeId === linkedEntityId) return true
    const stf = staffMembers.find((s) => s.id === linkedEntityId)
    if (stf && normName(task.assigneeName) === normName(stf.name)) return true
    return false
  }
  return false
}

export function scopeTasksForActor(
  tasks: CampusTaskItem[],
  role: Role,
  linkedEntityId: string,
  teachers: TeacherRecord[],
  staffMembers: StaffMemberRecord[],
): CampusTaskItem[] {
  if (role === 'admin') return tasks
  if (role !== 'teacher' && role !== 'staff') return []
  return tasks.filter((t) => taskBelongsToActor(t, role, linkedEntityId, teachers, staffMembers))
}

export function isTaskOverdue(task: CampusTaskItem): boolean {
  if (task.status === 'completed') return false
  if (!task.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)) return false
  const todayIso = new Date().toISOString().slice(0, 10)
  return task.dueDate < todayIso
}

export function getTaskProgressPct(task: CampusTaskItem): number {
  if (task.status === 'completed') return 100
  const subs = task.subtasks || []
  if (subs.length === 0) {
    if (task.status === 'in_review') return 85
    if (task.status === 'in_progress') return 45
    return 0
  }
  const done = subs.filter((s) => s.done).length
  return Math.round((done / subs.length) * 100)
}
