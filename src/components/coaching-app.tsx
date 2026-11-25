'use client'

import { useMemo, useState } from 'react'

type IconName =
  | 'arrow'
  | 'bell'
  | 'book'
  | 'calendar'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'exam'
  | 'forum'
  | 'home'
  | 'live'
  | 'menu'
  | 'message'
  | 'more'
  | 'payment'
  | 'play'
  | 'plus'
  | 'profile'
  | 'search'
  | 'sheet'
  | 'spark'
  | 'users'
  | 'video'

const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4v15.5" />
      <path d="M20 22V4H6.5A2.5 2.5 0 0 0 4 6.5" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  exam: (
    <>
      <path d="M9 11l2 2 4-4" />
      <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M7 17h10" />
    </>
  ),
  forum: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  live: (
    <>
      <path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M5.8 5.8a8.8 8.8 0 0 0 0 12.4M15.4 8.6a4.8 4.8 0 0 1 0 6.8M18.2 5.8a8.8 8.8 0 0 1 0 12.4" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  payment: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5Z" />,
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  sheet: (
    <>
      <path d="M6 2h9l4 4v16H6z" />
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7Z" />
      <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="m17 10 4-2v8l-4-2Z" />
    </>
  ),
}

function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: IconName
  size?: number
  className?: string
}) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

const studentSchedule = [
  {
    time: '08:00',
    end: '08:45',
    subject: 'Mathematics',
    topic: 'Differentiation',
    teacher: 'Sakib Ahmed',
    room: 'Room 8A',
    color: 'violet',
  },
  {
    time: '08:50',
    end: '09:35',
    subject: 'Physics',
    topic: 'Electromagnetic Induction',
    teacher: 'Nadia Rahman',
    room: 'Science Lab',
    color: 'cyan',
  },
  {
    time: '09:55',
    end: '10:40',
    subject: 'English',
    topic: 'Creative Writing',
    teacher: 'Farhana Karim',
    room: 'Room 8A',
    color: 'lime',
  },
]

const teacherSchedule = [
  {
    time: '08:00',
    end: '08:45',
    subject: 'Physics — Class 10A',
    topic: 'Electromagnetic Induction',
    teacher: '34 students',
    room: 'Science Lab',
    color: 'cyan',
  },
  {
    time: '09:55',
    end: '10:40',
    subject: 'Physics — Class 9B',
    topic: 'Motion & Force',
    teacher: '36 students',
    room: 'Room 9B',
    color: 'violet',
  },
  {
    time: '12:20',
    end: '13:05',
    subject: 'Physics — Class 8A',
    topic: 'Light & Reflection',
    teacher: '32 students',
    room: 'Room 8A',
    color: 'lime',
  },
]

const quickActions: { icon: IconName; label: string; accent: string; target: string }[] = [
  { icon: 'calendar', label: 'Routine', accent: 'violet', target: 'schedule' },
  { icon: 'sheet', label: 'Homework', accent: 'cyan', target: 'assignments' },
  { icon: 'exam', label: 'Results', accent: 'orange', target: 'exams' },
  { icon: 'payment', label: 'School fees', accent: 'lime', target: 'payments' },
]

export function SchoolApp() {
  const [role, setRole] = useState<'student' | 'teacher'>('student')
  const [tab, setTab] = useState('home')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedDay, setSelectedDay] = useState(2)
  const [search, setSearch] = useState('')

  const isTeacher = role === 'teacher'
  const schedule = isTeacher ? teacherSchedule : studentSchedule
  const filteredCourses = useMemo(() => {
    const courses = ['Mathematics', 'Physics', 'English']
    return courses.filter((course) => course.toLowerCase().includes(search.toLowerCase()))
  }, [search])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2300)
  }

  return (
    <main className="app-canvas min-h-screen bg-[#f4f5f8] text-[#15151a] selection:bg-[#b8ff5c]">
      <div className="mx-auto min-h-screen max-w-[1500px] lg:grid lg:grid-cols-[252px_1fr]">
        <aside className="hidden border-r border-black/6 bg-[#101114] px-5 py-7 text-white lg:flex lg:flex-col">
          <Brand />
          <nav className="mt-14 space-y-1.5">
            {[
              ['home', 'Overview', 'home'],
              ['classes', 'Subjects & classes', 'book'],
              ['schedule', 'Class routine', 'calendar'],
              ['exams', 'Assessments & results', 'exam'],
              ['attendance', 'Attendance', 'check'],
              ['payments', 'School fees', 'payment'],
              ['forum', 'School community', 'forum'],
              ['more', 'Campus services', 'menu'],
              ['profile', 'Profile', 'profile'],
            ].map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${tab === id ? 'bg-white text-black' : 'text-white/55 hover:bg-white/7 hover:text-white'}`}
              >
                <Icon name={icon as IconName} size={19} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl bg-[#b8ff5c] p-4 text-black">
            <div className="mb-7 flex size-9 items-center justify-center rounded-full bg-black text-[#b8ff5c]">
              <Icon name="spark" size={18} />
            </div>
            <p className="text-xs font-bold uppercase tracking-[.16em] opacity-55">This term</p>
            <p className="mt-1 text-2xl font-extrabold">94% present</p>
            <p className="mt-1 text-xs opacity-60">A strong school record.</p>
          </div>
        </aside>

        <section className="mobile-app-surface min-w-0 pb-24 lg:pb-8">
          <header className="mobile-app-header sticky top-0 z-30 flex items-center justify-between border-b border-black/5 bg-[#f4f5f8]/90 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="lg:hidden">
              <Brand dark />
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-black/35">
                Wednesday, 18 June
              </p>
              <h1 className="mt-1 text-xl font-extrabold">
                {isTeacher ? 'Faculty workspace' : 'Student portal'}
              </h1>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="hidden rounded-full bg-black/5 p-1 sm:flex">
                {(['student', 'teacher'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setRole(item)}
                    className={`rounded-full px-4 py-2 text-xs font-bold capitalize transition ${role === item ? 'bg-white shadow-sm' : 'text-black/40'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                aria-label="Open notifications"
                onClick={() => setNotificationsOpen(true)}
                className="relative flex size-10 items-center justify-center rounded-full border border-black/8 bg-white shadow-[0_5px_15px_rgba(20,20,30,.05)] transition hover:-translate-y-0.5"
              >
                <Icon name="bell" size={19} />
                <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#ff6846]" />
              </button>
              <button
                onClick={() => setTab('profile')}
                className="flex items-center gap-2 rounded-full bg-transparent p-0 text-white sm:bg-[#15151a] sm:p-1 sm:pr-3"
              >
                <span className="flex size-10 items-center justify-center rounded-full border-[3px] border-[#15151a] bg-[#b8ff5c] text-[11px] font-black text-black shadow-[0_5px_15px_rgba(20,20,30,.08)] sm:size-8 sm:border-0">
                  {isTeacher ? 'NR' : 'AR'}
                </span>
                <span className="hidden text-xs font-bold sm:block">
                  {isTeacher ? 'Nadia' : 'Araf'}
                </span>
              </button>
            </div>
          </header>

          <div className="px-5 pt-6 sm:px-8 lg:px-10 lg:pt-8">
            <div className="mobile-greeting relative mb-7 flex items-center justify-between sm:hidden">
              <div>
                <p className="text-[11px] font-bold text-black/35">Good morning,</p>
                <h1 className="mt-0.5 text-[25px] font-black tracking-[-.045em]">
                  {isTeacher ? 'Nadia Rahman' : 'Araf Rahman'}
                </h1>
              </div>
              <button
                onClick={() => setRole(isTeacher ? 'student' : 'teacher')}
                className="flex items-center gap-2 rounded-full border border-black/8 bg-white py-2 pl-2 pr-3 text-[10px] font-extrabold shadow-[0_8px_22px_rgba(20,20,30,.06)]"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-[#15151a] text-[#b8ff5c]">
                  <Icon name={isTeacher ? 'users' : 'book'} size={12} />
                </span>
                {isTeacher ? 'Faculty mode' : 'Student mode'}
              </button>
            </div>

            {tab === 'home' && (
              <HomeContent
                isTeacher={isTeacher}
                schedule={schedule}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onNotify={notify}
                onNavigate={setTab}
              />
            )}
            {tab === 'classes' && (
              <ClassesContent
                isTeacher={isTeacher}
                search={search}
                onSearch={setSearch}
                courses={filteredCourses}
                onNotify={notify}
              />
            )}
            {tab === 'schedule' && (
              <ScheduleContent
                schedule={schedule}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
            )}
            {tab === 'exams' && <ExamsContent isTeacher={isTeacher} onNotify={notify} />}
            {tab === 'forum' && <ForumContent onNotify={notify} />}
            {tab === 'attendance' && <AttendanceContent isTeacher={isTeacher} onNotify={notify} />}
            {tab === 'assignments' && (
              <AssignmentsContent isTeacher={isTeacher} onNotify={notify} />
            )}
            {tab === 'payments' && <PaymentsContent isTeacher={isTeacher} onNotify={notify} />}
            {tab === 'messages' && <MessagesContent isTeacher={isTeacher} onNotify={notify} />}
            {tab === 'more' && (
              <MoreContent isTeacher={isTeacher} onNavigate={setTab} onNotify={notify} />
            )}
            {tab === 'profile' && (
              <ProfileContent isTeacher={isTeacher} onRoleChange={setRole} onNotify={notify} />
            )}
          </div>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-black/5 bg-white/94 px-3 pb-[max(.8rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        {[
          ['home', 'Home', 'home'],
          ['classes', 'Subjects', 'book'],
          ['schedule', 'Routine', 'calendar'],
          ['forum', 'Campus', 'forum'],
          ['more', 'More', 'menu'],
        ].map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-bold transition ${tab === id ? 'text-black' : 'text-black/35'}`}
          >
            <span
              className={`flex h-7 w-10 items-center justify-center rounded-full ${tab === id ? 'bg-[#b8ff5c]' : ''}`}
            >
              <Icon name={icon as IconName} size={18} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {notificationsOpen && <Notifications onClose={() => setNotificationsOpen(false)} />}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#15151a] px-4 py-3 text-xs font-bold text-white shadow-2xl lg:bottom-8">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#b8ff5c] text-black">
            <Icon name="check" size={13} />
          </span>
          {toast}
        </div>
      )}
    </main>
  )
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`relative flex size-9 items-center justify-center rounded-[11px] ${dark ? 'bg-[#15151a]' : 'bg-[#b8ff5c]'}`}
      >
        <span className={`h-4 w-2.5 -skew-x-12 rounded-sm ${dark ? 'bg-[#b8ff5c]' : 'bg-black'}`} />
      </span>
      <span>
        <span className="block text-lg font-black leading-none tracking-[-.04em]">
          Shikho<span className="text-[#75b600]">Lab</span>
        </span>
        <span className="mt-1 block text-[7px] font-black uppercase tracking-[.22em] opacity-40">
          School OS
        </span>
      </span>
    </div>
  )
}

function HomeContent({
  isTeacher,
  schedule,
  selectedDay,
  onSelectDay,
  onNotify,
  onNavigate,
}: {
  isTeacher: boolean
  schedule: typeof studentSchedule
  selectedDay: number
  onSelectDay: (day: number) => void
  onNotify: (message: string) => void
  onNavigate: (tab: string) => void
}) {
  return (
    <>
      <section className="relative overflow-hidden rounded-[28px] bg-[#17181c] p-6 text-white sm:p-8">
        <div className="absolute -right-12 -top-20 size-64 rounded-full border-[38px] border-[#b8ff5c]/10" />
        <div className="absolute bottom-0 right-20 h-28 w-px rotate-45 bg-white/10" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#b8ff5c]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#b8ff5c]" />
            {isTeacher ? '3 periods today' : 'Wednesday · 4 June'}
          </span>
          <h2 className="mt-6 text-3xl font-black leading-[1.08] tracking-[-.04em] sm:text-5xl">
            {isTeacher ? (
              <>
                Teach. Guide.
                <br />
                <span className="text-[#b8ff5c]">Shape tomorrow.</span>
              </>
            ) : (
              <>
                Your school day,
                <br />
                <span className="text-[#b8ff5c]">all in one place.</span>
              </>
            )}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/50">
            {isTeacher
              ? 'Your timetable, class records, homework, and students—ready for the school day.'
              : 'Your next period starts in 24 minutes. Homework, notices, and results are up to date.'}
          </p>
          <button
            onClick={() =>
              onNotify(isTeacher ? 'Attendance register opened' : 'Class routine opened')
            }
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#b8ff5c] px-5 py-3 text-xs font-extrabold text-black transition hover:scale-[1.02]"
          >
            <Icon name={isTeacher ? 'check' : 'calendar'} size={16} />
            {isTeacher ? 'Take attendance' : 'View today’s routine'}
          </button>
        </div>
        <div className="absolute bottom-6 right-6 hidden rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur sm:block">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#b8ff5c] text-black">
              <Icon name="clock" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                Next up
              </p>
              <p className="text-sm font-bold">Physics · 8:50 AM</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-black/30">
              Your school essentials
            </p>
            <h3 className="mt-1 text-xl font-black">Quick access</h3>
          </div>
          <button onClick={() => onNavigate('classes')} className="text-xs font-bold text-black/45">
            View all
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() =>
                action.target === 'live' ? onNotify('Opening class') : onNavigate(action.target)
              }
              className="group rounded-2xl border border-black/5 bg-white p-3 text-left shadow-[0_8px_28px_rgba(20,20,30,.035)] transition hover:-translate-y-1 sm:p-4"
            >
              <span
                className={`action-${action.accent} mb-4 flex size-10 items-center justify-center rounded-xl`}
              >
                <Icon name={action.icon} size={19} />
              </span>
              <span className="block text-[10px] font-extrabold leading-tight sm:text-xs">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section>
          <SectionTitle
            eyebrow="Plan your day"
            title="Today's schedule"
            action="Full schedule"
            onAction={() => onNavigate('schedule')}
          />
          <CalendarStrip selected={selectedDay} onSelect={onSelectDay} />
          <div className="mt-3 space-y-2.5">
            {schedule.slice(0, 2).map((item) => (
              <ClassCard
                key={item.time}
                item={item}
                onClick={() => onNotify(`${item.subject} opened`)}
              />
            ))}
          </div>
        </section>
        <section>
          <SectionTitle eyebrow="Stay informed" title="Latest updates" />
          <div className="rounded-2xl bg-white p-2 shadow-[0_10px_30px_rgba(20,20,30,.04)]">
            {[
              ['Term result published', 'Physics assessment · You scored 87%', '12m', 'exam'],
              ['Homework posted', 'English · Creative writing', '1h', 'sheet'],
              ['School notice', 'Science fair registration is open', '3h', 'bell'],
            ].map(([title, sub, time, icon], i) => (
              <button
                key={title}
                onClick={() => onNotify(title)}
                className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-black/[.025] ${i < 2 ? 'border-b border-black/5' : ''}`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f2f5]">
                  <Icon name={icon as IconName} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-extrabold">{title}</span>
                  <span className="mt-1 block truncate text-[10px] text-black/40">{sub}</span>
                </span>
                <span className="text-[10px] font-bold text-black/25">{time}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function ClassesContent({
  isTeacher,
  search,
  onSearch,
  courses,
  onNotify,
}: {
  isTeacher: boolean
  search: string
  onSearch: (value: string) => void
  courses: string[]
  onNotify: (message: string) => void
}) {
  const studentDetails = [
    {
      name: 'Mathematics',
      teacher: 'Sakib Ahmed',
      progress: 68,
      lessons: 'Class 8 · Section A',
      color: 'violet',
    },
    {
      name: 'Physics',
      teacher: 'Nadia Rahman',
      progress: 82,
      lessons: 'Class 8 · Section A',
      color: 'cyan',
    },
    {
      name: 'English',
      teacher: 'Farhana Karim',
      progress: 51,
      lessons: 'Class 8 · Section A',
      color: 'lime',
    },
  ]
  const teacherDetails = [
    {
      name: 'Class 10 · Section A',
      teacher: '34 students',
      progress: 72,
      lessons: 'Physics · 8:00 AM',
      color: 'cyan',
    },
    {
      name: 'Class 9 · Section B',
      teacher: '36 students',
      progress: 88,
      lessons: 'Physics · 9:55 AM',
      color: 'violet',
    },
    {
      name: 'Class 8 · Section A',
      teacher: '32 students',
      progress: 46,
      lessons: 'Physics · 12:20 PM',
      color: 'lime',
    },
  ]
  const details = isTeacher
    ? teacherDetails.filter((course) => course.name.toLowerCase().includes(search.toLowerCase()))
    : studentDetails.filter((course) => courses.includes(course.name))
  return (
    <PageShell
      eyebrow={isTeacher ? 'Faculty desk' : 'Academic year 2026'}
      title={isTeacher ? 'My class sections' : 'My subjects'}
      subtitle={
        isTeacher
          ? 'Plan lessons, share materials, and support every student.'
          : 'Find lessons, homework, class notes, and teacher feedback.'
      }
    >
      <section className="classes-visual relative mb-5 overflow-hidden rounded-[26px] bg-[#17181c] p-5 text-white sm:p-7">
        <div className="classes-orbit absolute -right-9 -top-12 size-44 rounded-full border border-[#b8ff5c]/25" />
        <div className="classes-orbit classes-orbit-small absolute -right-2 top-4 size-24 rounded-full border border-white/10" />
        <div className="relative z-10 flex items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b8ff5c] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.13em] text-black">
              <Icon name="spark" size={10} />
              {isTeacher ? 'Weekly impact' : 'Weekly focus'}
            </span>
            <p className="mt-5 max-w-[210px] text-[19px] font-black leading-[1.18] tracking-[-.035em]">
              {isTeacher
                ? '102 students across 3 sections.'
                : 'You completed 8 of 10 weekly lessons.'}
            </p>
            <p className="mt-2 text-[10px] text-white/40">
              {isTeacher ? '94% average attendance' : 'Class 8 · Section A'}
            </p>
          </div>
          <div className="relative flex size-[76px] shrink-0 items-center justify-center rounded-full border-[7px] border-white/10">
            <div className="absolute inset-[-7px] rounded-full border-[7px] border-transparent border-r-[#b8ff5c] border-t-[#b8ff5c]" />
            <div className="text-center">
              <p className="text-lg font-black">{isTeacher ? '92' : '78'}%</p>
              <p className="text-[7px] font-bold uppercase tracking-wider text-white/35">
                {isTeacher ? 'Present' : 'Goal'}
              </p>
            </div>
          </div>
        </div>
      </section>
      <label className="mb-5 flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3.5 shadow-[0_10px_30px_rgba(20,20,30,.05)]">
        <Icon name="search" size={18} className="text-black/30" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={isTeacher ? 'Search sections or students' : 'Search subjects or teachers'}
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-black/25"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {details.map((course, i) => (
          <article
            key={course.name}
            className="grid grid-cols-[104px_1fr] overflow-hidden rounded-[24px] bg-white shadow-[0_12px_35px_rgba(20,20,30,.05)] sm:block"
          >
            <div className={`course-cover course-${course.color} relative overflow-hidden`}>
              <span className="relative z-10 text-[8px] font-black uppercase tracking-[.13em] opacity-60 sm:text-[10px] sm:tracking-[.16em]">
                {isTeacher ? 'Class section' : 'Class 8 · A'}
              </span>
              <Icon
                name={i === 0 ? 'spark' : i === 1 ? 'live' : 'book'}
                size={38}
                className="relative z-10 mt-8 opacity-80 sm:mt-7 sm:size-[42px]"
              />
              <span className="absolute -bottom-8 -right-9 size-24 rounded-full border-[18px] border-white/20" />
            </div>
            <div className="min-w-0 p-4 sm:p-5">
              <h3 className="truncate text-sm font-black sm:text-lg">{course.name}</h3>
              <p className="mt-1 truncate text-[10px] text-black/40 sm:text-xs">
                {course.teacher} · {course.lessons}
              </p>
              <div className="mt-3 flex items-center justify-between text-[8px] font-extrabold sm:mt-5 sm:text-[10px]">
                <span>{isTeacher ? 'Syllabus covered' : 'Term progress'}</span>
                <span>{course.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/7">
                <div
                  className="h-full rounded-full bg-[#15151a]"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
              <button
                onClick={() => onNotify(`Continuing ${course.name}`)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#15151a] py-2.5 text-[10px] font-extrabold text-white sm:mt-5 sm:py-3 sm:text-xs"
              >
                <Icon name={isTeacher ? 'arrow' : 'play'} size={14} />
                {isTeacher ? 'Open class' : 'Open subject'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  )
}

function ScheduleContent({
  schedule,
  selectedDay,
  onSelectDay,
}: {
  schedule: typeof studentSchedule
  selectedDay: number
  onSelectDay: (day: number) => void
}) {
  return (
    <PageShell
      eyebrow="Stay organized"
      title="Class routine"
      subtitle="Periods, labs, assemblies, and assessments in one school-day timeline."
    >
      <CalendarStrip selected={selectedDay} onSelect={onSelectDay} />
      <div className="mt-6 space-y-3">
        {schedule.map((item) => (
          <ClassCard key={item.time} item={item} />
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-dashed border-black/15 p-6 text-center">
        <Icon name="calendar" size={24} className="mx-auto text-black/30" />
        <p className="mt-2 text-xs font-bold text-black/40">No more events planned for today</p>
      </div>
    </PageShell>
  )
}

function ExamsContent({
  isTeacher,
  onNotify,
}: {
  isTeacher: boolean
  onNotify: (message: string) => void
}) {
  return (
    <PageShell
      eyebrow="Academic progress"
      title={isTeacher ? 'Assessments & grading' : 'Assessments & results'}
      subtitle={
        isTeacher
          ? 'Manage class tests, term exams, report cards, and feedback.'
          : 'See class tests, term exams, marks, grades, and teacher feedback.'
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Completed', '18', 'check'],
          ['Average score', '84%', 'spark'],
          [isTeacher ? 'To review' : 'Upcoming', isTeacher ? '46' : '3', 'clock'],
        ].map(([label, value, icon]) => (
          <div key={label} className="rounded-2xl bg-white p-5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#efffcf] text-[#4a7100]">
              <Icon name={icon as IconName} size={17} />
            </span>
            <p className="mt-5 text-2xl font-black">{value}</p>
            <p className="text-xs font-semibold text-black/35">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[24px] bg-[#17181c] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-[#ff6846] px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">
              Starts tomorrow
            </span>
            <h3 className="mt-4 text-xl font-black">Physics Half-Yearly Exam</h3>
            <p className="mt-1 text-xs text-white/45">Creative + MCQ · 90 minutes · 100 marks</p>
          </div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/8 text-[#b8ff5c]">
            <Icon name="exam" size={23} />
          </span>
        </div>
        <button
          onClick={() => onNotify(isTeacher ? 'Exam editor opened' : 'Reminder added')}
          className="mt-6 rounded-xl bg-[#b8ff5c] px-5 py-3 text-xs font-black text-black"
        >
          {isTeacher ? 'Manage exam' : 'Set reminder'}
        </button>
      </div>
      <h3 className="mb-3 mt-7 text-lg font-black">Recent results</h3>
      <div className="rounded-2xl bg-white p-2">
        {[
          ['Chemistry Quiz 08', '92%', 'A+'],
          ['Higher Math Weekly', '81%', 'A+'],
          ['Physics Chapter Test', '76%', 'A'],
        ].map(([name, score, grade]) => (
          <div
            key={name}
            className="flex items-center gap-3 border-b border-black/5 p-3 last:border-none"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#f1f2f5]">
              <Icon name="exam" size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-extrabold">{name}</span>
              <span className="text-[10px] text-black/35">Reviewed · Feedback available</span>
            </span>
            <span className="text-right">
              <span className="block text-sm font-black">{score}</span>
              <span className="text-[9px] font-black text-[#67a000]">{grade}</span>
            </span>
          </div>
        ))}
      </div>
    </PageShell>
  )
}

function ForumContent({ onNotify }: { onNotify: (message: string) => void }) {
  return (
    <PageShell
      eyebrow="Learn together"
      title="School community"
      subtitle="Ask questions, follow school notices, and take part in campus life."
    >
      <button
        onClick={() => onNotify('Question composer opened')}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl bg-[#15151a] p-4 text-left text-white"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-[#b8ff5c] text-black">
          <Icon name="plus" size={18} />
        </span>
        <span>
          <span className="block text-sm font-black">Ask your school community</span>
          <span className="text-[10px] text-white/40">Teachers and classmates can help</span>
        </span>
      </button>
      <div className="space-y-3">
        {[
          [
            'How do I find the direction of induced current?',
            'Class 8A · Physics',
            'Araf Rahman',
            '12 replies',
            '8m',
          ],
          [
            'Shortcut for partial fraction integration?',
            'Class 8A · Mathematics',
            'Nusrat Jahan',
            '7 replies',
            '34m',
          ],
          [
            'Who wants to join the science fair team?',
            'Science Club · Campus',
            'Tahmid Anwar',
            '15 replies',
            '1h',
          ],
        ].map(([question, category, author, replies, time], i) => (
          <article
            key={question}
            className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(20,20,30,.035)]"
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-black ${i === 0 ? 'bg-[#dff9ff] text-[#08798d]' : i === 1 ? 'bg-[#eee5ff] text-[#6935c3]' : 'bg-[#efffcf] text-[#4f7600]'}`}
              >
                {category}
              </span>
              <span className="text-[10px] font-bold text-black/25">{time}</span>
            </div>
            <h3 className="mt-4 text-sm font-black leading-5">{question}</h3>
            <div className="mt-5 flex items-center">
              <span className="mr-2 flex size-7 items-center justify-center rounded-full bg-[#17181c] text-[8px] font-black text-white">
                {author
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
              <span className="text-[10px] font-bold text-black/40">{author}</span>
              <button
                onClick={() => onNotify(`${replies} opened`)}
                className="ml-auto flex items-center gap-1.5 text-[10px] font-extrabold"
              >
                <Icon name="message" size={14} />
                {replies}
              </button>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  )
}

function AttendanceContent({
  isTeacher,
  onNotify,
}: {
  isTeacher: boolean
  onNotify: (message: string) => void
}) {
  const [students, setStudents] = useState([
    ['Araf Rahman', 'Present', 'AR'],
    ['Nusrat Jahan', 'Present', 'NJ'],
    ['Tahmid Anwar', 'Late', 'TA'],
    ['Farhan Kabir', 'Absent', 'FK'],
  ])
  const cycleAttendance = (studentIndex: number) => {
    const statuses = ['Present', 'Late', 'Absent']
    setStudents((current) =>
      current.map((student, index) => {
        if (index !== studentIndex) return student
        const nextStatus = statuses[(statuses.indexOf(student[1]) + 1) % statuses.length]
        onNotify(`${student[0]} marked ${nextStatus.toLowerCase()}`)
        return [student[0], nextStatus, student[2]]
      }),
    )
  }
  return (
    <PageShell
      eyebrow="Track consistency"
      title="Attendance"
      subtitle={
        isTeacher
          ? 'Take period attendance and monitor every class section.'
          : 'Review daily attendance, late arrivals, and your monthly record.'
      }
    >
      <div className="attendance-hero relative overflow-hidden rounded-[26px] bg-[#17181c] p-6 text-white">
        <div className="absolute -right-10 -top-12 size-40 rounded-full border-[26px] border-[#b8ff5c]/10" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#b8ff5c]">
              June overview
            </p>
            <p className="mt-3 text-4xl font-black">{isTeacher ? '92%' : '94%'}</p>
            <p className="mt-1 text-[10px] text-white/40">
              {isTeacher ? 'Average across all sections' : '16 of 17 school days attended'}
            </p>
          </div>
          <div className="grid grid-cols-4 items-end gap-1.5">
            {[52, 76, 64, 90].map((height, index) => (
              <span
                key={height}
                className={`w-3 rounded-full ${index === 3 ? 'bg-[#b8ff5c]' : 'bg-white/15'}`}
                style={{ height }}
              />
            ))}
          </div>
        </div>
      </div>
      {isTeacher ? (
        <>
          <div className="mt-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">Physics · Class 10A</h3>
              <p className="text-[10px] text-black/35">34 students · Today, 8:00 AM</p>
            </div>
            <button
              onClick={() => onNotify('Attendance saved')}
              className="rounded-full bg-[#b8ff5c] px-4 py-2.5 text-[10px] font-black"
            >
              Save attendance
            </button>
          </div>
          <div className="mt-3 rounded-2xl bg-white p-2">
            {students.map(([name, status, initials], index) => (
              <div
                key={name}
                className="flex items-center gap-3 border-b border-black/5 p-3 last:border-none"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-[#efffcf] text-[9px] font-black">
                  {initials}
                </span>
                <span className="flex-1 text-xs font-extrabold">{name}</span>
                <button
                  onClick={() => cycleAttendance(index)}
                  className={`rounded-full px-3 py-1.5 text-[9px] font-black ${
                    status === 'Present'
                      ? 'bg-[#efffcf] text-[#4f7600]'
                      : status === 'Late'
                        ? 'bg-[#fff1d7] text-[#9c6100]'
                        : 'bg-[#ffe7e0] text-[#b63e20]'
                  }`}
                >
                  {status}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }, (_, index) => (
            <div
              key={index}
              className={`flex aspect-square items-center justify-center rounded-lg text-[9px] font-black ${
                [5, 12, 19, 26].includes(index)
                  ? 'bg-black/5 text-black/20'
                  : index === 16
                    ? 'bg-[#ffe7e0] text-[#b63e20]'
                    : 'bg-[#efffcf] text-[#4f7600]'
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}

function AssignmentsContent({
  isTeacher,
  onNotify,
}: {
  isTeacher: boolean
  onNotify: (message: string) => void
}) {
  const assignments = [
    ['Electromagnetic Induction', 'Physics', isTeacher ? '31 / 34 submitted' : 'Due tomorrow', 78],
    [
      'Differentiation Practice',
      'Mathematics',
      isTeacher ? '30 / 32 submitted' : 'Due 21 June',
      56,
    ],
    ['Creative Writing Journal', 'English', isTeacher ? '28 / 32 submitted' : 'Submitted', 100],
  ]
  return (
    <PageShell
      eyebrow="Practice & review"
      title={isTeacher ? 'Assignments' : 'My assignments'}
      subtitle={
        isTeacher
          ? 'Create work, review submissions, and give focused feedback.'
          : 'Stay ahead of deadlines and track teacher feedback.'
      }
    >
      <button
        onClick={() => onNotify(isTeacher ? 'Assignment creator opened' : 'Study plan updated')}
        className="mb-5 flex w-full items-center gap-4 rounded-[24px] bg-[#b8ff5c] p-5 text-left"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[#15151a] text-[#b8ff5c]">
          <Icon name={isTeacher ? 'plus' : 'spark'} size={21} />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-black">
            {isTeacher ? 'Create new assignment' : 'Smart study plan'}
          </span>
          <span className="text-[10px] text-black/45">
            {isTeacher ? 'Add instructions, files, and deadline' : 'Prioritize tasks by deadline'}
          </span>
        </span>
        <Icon name="chevron" size={17} />
      </button>
      <div className="space-y-3">
        {assignments.map(([title, subject, meta, progress]) => (
          <button
            key={title}
            onClick={() => onNotify(`${title} opened`)}
            className="w-full rounded-2xl bg-white p-4 text-left shadow-[0_8px_24px_rgba(20,20,30,.04)]"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#eee5ff] text-[#6935c3]">
                <Icon name="sheet" size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black">{title}</span>
                <span className="mt-1 block text-[9px] font-bold text-black/35">
                  {subject} · {meta}
                </span>
              </span>
              <Icon name="chevron" size={15} className="text-black/25" />
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-[#15151a]" style={{ width: `${progress}%` }} />
            </div>
          </button>
        ))}
      </div>
    </PageShell>
  )
}

function PaymentsContent({
  isTeacher,
  onNotify,
}: {
  isTeacher: boolean
  onNotify: (message: string) => void
}) {
  return (
    <PageShell
      eyebrow="Clear & secure"
      title={isTeacher ? 'Fee collection' : 'School fees'}
      subtitle={
        isTeacher
          ? 'Monitor school fee collections, dues, and receipts.'
          : 'View term fees, pay securely, and download every receipt.'
      }
    >
      <div className="relative overflow-hidden rounded-[28px] bg-[#17181c] p-6 text-white">
        <div className="absolute -right-14 -top-16 size-52 rounded-full bg-[#b8ff5c]/10 blur-2xl" />
        <div className="relative">
          <p className="text-[9px] font-black uppercase tracking-[.16em] text-white/35">
            {isTeacher ? 'Collected this term' : 'Next school fee'}
          </p>
          <p className="mt-3 text-4xl font-black">৳{isTeacher ? '4,82,500' : '3,500'}</p>
          <p className="mt-1 text-[10px] text-white/40">
            {isTeacher ? '88% of expected fees' : 'Term fee · Due on 25 June 2026'}
          </p>
          <button
            onClick={() =>
              onNotify(isTeacher ? 'Fee collection report prepared' : 'Secure payment opened')
            }
            className="mt-6 rounded-xl bg-[#b8ff5c] px-5 py-3 text-[10px] font-black text-black"
          >
            {isTeacher ? 'Download report' : 'Pay securely'}
          </button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          [isTeacher ? '৳64,000' : '৳10,500', isTeacher ? 'Pending dues' : 'Paid this year'],
          [isTeacher ? '214' : '3', isTeacher ? 'Paid students' : 'Receipts'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-2xl bg-white p-5">
            <p className="text-xl font-black">{value}</p>
            <p className="mt-1 text-[10px] font-bold text-black/35">{label}</p>
          </div>
        ))}
      </div>
      <h3 className="mb-3 mt-7 text-sm font-black">
        {isTeacher ? 'Recent transactions' : 'Payment history'}
      </h3>
      <div className="rounded-2xl bg-white p-2">
        {[
          ['Term tuition fee', '18 June 2026', '৳3,500', 'Paid'],
          ['Science lab fee', '02 June 2026', '৳500', 'Paid'],
          ['Annual activity fee', '20 May 2026', '৳3,500', 'Paid'],
        ].map(([name, date, amount, status]) => (
          <button
            key={name}
            onClick={() => onNotify(`${name} receipt opened`)}
            className="flex w-full items-center gap-3 border-b border-black/5 p-3 text-left last:border-none"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#efffcf] text-[#527900]">
              <Icon name="payment" size={17} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-black">{name}</span>
              <span className="text-[9px] text-black/30">{date}</span>
            </span>
            <span className="text-right">
              <span className="block text-xs font-black">{amount}</span>
              <span className="text-[8px] font-black text-[#67a000]">{status}</span>
            </span>
          </button>
        ))}
      </div>
    </PageShell>
  )
}

function MessagesContent({
  isTeacher,
  onNotify,
}: {
  isTeacher: boolean
  onNotify: (message: string) => void
}) {
  const [messageSearch, setMessageSearch] = useState('')
  const chats = isTeacher
    ? [
        ['Araf Rahman', 'Ma’am, can you check question 8?', '2m', 'AR'],
        ['Class 10 · Section A', 'Nusrat shared a PDF', '18m', '10A'],
        ['Tahmid Anwar', 'Thank you for the feedback.', '1h', 'TA'],
      ]
    : [
        ['Nadia Rahman', 'I have reviewed your assignment.', '4m', 'NR'],
        ['Class 8 · Section A', 'Physics starts at 8:50 AM', '23m', '8A'],
        ['Sakib Ahmed', 'Try exercise 4.3 before class.', '2h', 'SA'],
      ]
  const filteredChats = chats.filter(([name, message]) =>
    `${name} ${message}`.toLowerCase().includes(messageSearch.toLowerCase()),
  )
  return (
    <PageShell
      eyebrow="Stay connected"
      title="Messages"
      subtitle="Private conversations, class groups, and guardian communication."
    >
      <label className="mb-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5">
        <Icon name="search" size={17} className="text-black/25" />
        <input
          value={messageSearch}
          onChange={(event) => setMessageSearch(event.target.value)}
          placeholder="Search conversations"
          className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-black/25"
        />
      </label>
      <div className="space-y-2">
        {filteredChats.map(([name, message, time, initials], index) => (
          <button
            key={name}
            onClick={() => onNotify(`Conversation with ${name} opened`)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left"
          >
            <span
              className={`flex size-12 items-center justify-center rounded-2xl text-[10px] font-black ${
                index === 0 ? 'bg-[#b8ff5c]' : 'bg-[#eee5ff] text-[#6935c3]'
              }`}
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-black">{name}</span>
              <span className="mt-1 block truncate text-[10px] text-black/35">{message}</span>
            </span>
            <span className="self-start text-[9px] font-bold text-black/25">{time}</span>
          </button>
        ))}
      </div>
    </PageShell>
  )
}

function MoreContent({
  isTeacher,
  onNavigate,
  onNotify,
}: {
  isTeacher: boolean
  onNavigate: (tab: string) => void
  onNotify: (message: string) => void
}) {
  const features: [string, string, IconName, string][] = [
    ['Attendance', isTeacher ? 'Take & review' : '94% this month', 'check', 'attendance'],
    ['Assignments', isTeacher ? '3 need review' : '2 due soon', 'sheet', 'assignments'],
    ['School fees', isTeacher ? 'Collection overview' : 'Next due 25 Jun', 'payment', 'payments'],
    ['Messages', '3 unread chats', 'message', 'messages'],
    ['Results & reports', isTeacher ? '46 to review' : 'Average 84%', 'exam', 'exams'],
    ['My profile', 'Account & settings', 'profile', 'profile'],
  ]
  return (
    <PageShell
      eyebrow="Digital campus"
      title="Campus services"
      subtitle={`Everything ${isTeacher ? 'for your classes and faculty day' : 'for your school day'} in one place.`}
    >
      <div className="mb-6 overflow-hidden rounded-[26px] bg-[#b8ff5c] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-black/40">
              Smart insight
            </p>
            <h3 className="mt-2 max-w-[220px] text-xl font-black leading-tight">
              {isTeacher
                ? 'Class 10A needs help with chapter 7.'
                : 'Physics is your strongest subject.'}
            </h3>
          </div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#15151a] text-[#b8ff5c]">
            <Icon name="spark" size={22} />
          </span>
        </div>
        <button
          onClick={() => onNotify('Detailed insight opened')}
          className="mt-5 flex items-center gap-1.5 text-[10px] font-black"
        >
          View full insight <Icon name="arrow" size={13} />
        </button>
      </div>
      <div className="mb-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-black/30">
              Around school
            </p>
            <h3 className="mt-1 text-lg font-black">Campus at a glance</h3>
          </div>
          <span className="rounded-full bg-[#15151a] px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-[#b8ff5c]">
            2 new notices
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            ['Notices', 'bell', 'Notice board opened'],
            ['Library', 'book', 'Library catalog opened'],
            ['Clubs', 'users', 'School clubs opened'],
            ['Transport', 'calendar', 'Transport schedule opened'],
          ].map(([label, icon, message]) => (
            <button
              key={label}
              onClick={() => onNotify(message)}
              className="rounded-2xl border border-black/5 bg-white px-2 py-3 text-center shadow-[0_8px_24px_rgba(20,20,30,.035)]"
            >
              <span className="mx-auto flex size-9 items-center justify-center rounded-xl bg-[#f1f2f5]">
                <Icon name={icon as IconName} size={16} />
              </span>
              <span className="mt-2 block text-[9px] font-black">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {features.map(([title, subtitle, icon, target], index) => (
          <button
            key={title}
            onClick={() => onNavigate(target)}
            className="rounded-[22px] bg-white p-4 text-left shadow-[0_8px_28px_rgba(20,20,30,.04)]"
          >
            <span
              className={`flex size-10 items-center justify-center rounded-xl ${
                index % 3 === 0
                  ? 'bg-[#efffcf] text-[#527900]'
                  : index % 3 === 1
                    ? 'bg-[#eee5ff] text-[#6935c3]'
                    : 'bg-[#dff9ff] text-[#08798d]'
              }`}
            >
              <Icon name={icon} size={18} />
            </span>
            <span className="mt-5 block text-xs font-black">{title}</span>
            <span className="mt-1 block text-[9px] font-bold text-black/30">{subtitle}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => onNotify('Support center opened')}
        className="mt-5 flex w-full items-center rounded-2xl border border-black/7 p-4 text-xs font-black"
      >
        <span className="mr-3 flex size-9 items-center justify-center rounded-xl bg-[#15151a] text-white">
          <Icon name="message" size={16} />
        </span>
        School office & support
        <Icon name="chevron" size={16} className="ml-auto text-black/25" />
      </button>
    </PageShell>
  )
}

function ProfileContent({
  isTeacher,
  onRoleChange,
  onNotify,
}: {
  isTeacher: boolean
  onRoleChange: (role: 'student' | 'teacher') => void
  onNotify: (message: string) => void
}) {
  return (
    <PageShell
      eyebrow="Your account"
      title="Profile & settings"
      subtitle="Manage your school identity, account, and preferences."
    >
      <div className="rounded-[26px] bg-[#17181c] p-6 text-white">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-[#b8ff5c] text-xl font-black text-black">
            {isTeacher ? 'NR' : 'AR'}
          </span>
          <div>
            <h3 className="text-xl font-black">{isTeacher ? 'Nadia Rahman' : 'Araf Rahman'}</h3>
            <p className="text-xs text-white/40">
              {isTeacher ? 'Senior Physics Teacher' : 'Class 8 · Section A · Science'}
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5 text-center">
          {[
            ['3', isTeacher ? 'Sections' : 'Subjects'],
            ['84%', isTeacher ? 'Attendance' : 'Average'],
            ['#08', isTeacher ? 'Rating' : 'Rank'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-lg font-black text-[#b8ff5c]">{value}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/35">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
      <h3 className="mb-3 mt-7 text-sm font-black">Switch workspace</h3>
      <div className="grid grid-cols-2 gap-3">
        {(['student', 'teacher'] as const).map((role) => (
          <button
            key={role}
            onClick={() => onRoleChange(role)}
            className={`rounded-2xl border p-4 text-left transition ${isTeacher === (role === 'teacher') ? 'border-[#15151a] bg-white' : 'border-black/5 bg-white/40'}`}
          >
            <Icon name={role === 'teacher' ? 'users' : 'book'} />
            <span className="mt-4 block text-sm font-black capitalize">{role}</span>
            <span className="text-[10px] text-black/35">
              {role === 'teacher' ? 'Faculty workspace' : 'Student portal'}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-white p-2">
        {[
          'Personal information',
          'Notification preferences',
          'Guardian information',
          'School office & support',
        ].map((item) => (
          <button
            key={item}
            onClick={() => onNotify(`${item} opened`)}
            className="flex w-full items-center border-b border-black/5 p-3 text-left text-xs font-bold last:border-none"
          >
            {item}
            <Icon name="chevron" size={16} className="ml-auto text-black/25" />
          </button>
        ))}
      </div>
    </PageShell>
  )
}

function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7">
        <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-black/30">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-3xl font-black tracking-[-.04em]">{title}</h2>
        <p className="mt-2 text-sm text-black/40">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function SectionTitle({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-black/30">
          {eyebrow}
        </p>
        <h3 className="mt-1 text-lg font-black">{title}</h3>
      </div>
      {action && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-[10px] font-extrabold text-black/40"
        >
          {action}
          <Icon name="arrow" size={14} />
        </button>
      )}
    </div>
  )
}

function CalendarStrip({
  selected,
  onSelect,
}: {
  selected: number
  onSelect: (day: number) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5 rounded-2xl bg-white p-2">
      {[
        ['Sat', 31],
        ['Sun', 1],
        ['Mon', 2],
        ['Tue', 3],
        ['Wed', 4],
        ['Thu', 5],
        ['Fri', 6],
      ].map(([name, date], i) => (
        <button
          key={name}
          onClick={() => onSelect(i)}
          className={`rounded-xl py-2.5 text-center transition ${selected === i ? 'bg-[#17181c] text-white shadow-lg' : 'hover:bg-black/[.03]'}`}
        >
          <span
            className={`block text-[8px] font-extrabold uppercase ${selected === i ? 'text-white/40' : 'text-black/25'}`}
          >
            {name}
          </span>
          <span className="mt-1 block text-xs font-black">{date}</span>
          {i === 2 && (
            <span
              className={`mx-auto mt-1 block size-1 rounded-full ${selected === i ? 'bg-[#b8ff5c]' : 'bg-[#75b600]'}`}
            />
          )}
        </button>
      ))}
    </div>
  )
}

function ClassCard({
  item,
  onClick,
}: {
  item: (typeof studentSchedule)[number]
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_7px_24px_rgba(20,20,30,.035)] transition hover:-translate-y-0.5"
    >
      <div className="w-12 shrink-0 text-center">
        <span className="block text-xs font-black">{item.time}</span>
        <span className="text-[9px] font-semibold text-black/25">{item.end}</span>
      </div>
      <span className={`h-11 w-1 rounded-full bar-${item.color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-black">{item.subject}</span>
          {item.room.includes('online') && (
            <span className="rounded-full bg-[#ffe7e0] px-2 py-0.5 text-[8px] font-black text-[#d24624]">
              LIVE
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[10px] text-black/40">
          {item.topic} · {item.teacher}
        </p>
      </div>
      <div className="hidden items-center gap-1 text-[9px] font-bold text-black/35 sm:flex">
        <Icon name={item.room.includes('online') ? 'video' : 'profile'} size={13} />
        {item.room}
      </div>
      <span className="flex size-8 items-center justify-center rounded-full bg-black/[.035] transition group-hover:bg-[#b8ff5c]">
        <Icon name="chevron" size={14} />
      </span>
    </button>
  )
}

function Notifications({ onClose }: { onClose: () => void }) {
  const [allRead, setAllRead] = useState(false)

  return (
    <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="notification-drawer absolute right-0 top-0 h-full w-[min(92vw,390px)] bg-[#f7f7f8] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-black/30">
              Inbox
            </p>
            <h2 className="text-xl font-black">Notifications</h2>
          </div>
          <button
            aria-label="Close notifications"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full bg-white"
          >
            <Icon name="close" />
          </button>
        </div>
        <button
          onClick={() => setAllRead(true)}
          className="mt-7 w-full rounded-xl bg-[#b8ff5c] py-3 text-xs font-black"
        >
          {allRead ? 'All notifications read' : 'Mark all as read'}
        </button>
        <div className="mt-4 space-y-2">
          {[
            ['First period begins soon', 'Mathematics starts at 8:00 AM', 'clock'],
            ['Fee payment successful', 'Term tuition · ৳3,500', 'payment'],
            ['New result available', 'You scored 87/100 in Physics', 'exam'],
            ['School notice', 'Science fair registration is open', 'bell'],
          ].map(([title, text, icon], i) => (
            <div
              key={title}
              className={`flex gap-3 rounded-2xl bg-white p-4 transition-opacity ${allRead ? 'opacity-55' : ''}`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${i === 0 ? 'bg-[#eee5ff]' : 'bg-[#efffcf]'}`}
              >
                <Icon name={icon as IconName} size={18} />
              </span>
              <div>
                <p className="text-xs font-black">{title}</p>
                <p className="mt-1 text-[10px] text-black/40">{text}</p>
                <p className="mt-2 text-[9px] font-bold text-black/20">{i + 2} minutes ago</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
