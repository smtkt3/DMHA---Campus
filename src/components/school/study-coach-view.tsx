'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChildSwitcherBar } from './guardian-views'
import { Icon } from './icons'
import { useSchool } from './store'
import type { SubjectProgress } from './types'
import { PageShell } from './ui'

interface StudyMission {
  id: string
  questType: 'BOSS RECOVERY' | 'HOMEWORK QUEST' | 'QUIZ CHALLENGE' | 'MISTAKE REPAIR' | 'SCRIPT REVIEW' | 'MOMENTUM COMBO'
  subject: string
  title: string
  coachReason: string
  steps: string[]
  xpReward: number
  estMinutes: number
  difficulty: 1 | 2 | 3
  impactLabel: string
  targetTab: string
  cta: string
}

interface BossQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface SubjectBossConfig {
  bossId: string
  bossName: string
  bossTitle: string
  subject: string
  tagline: string
  accent: string
  xpReward: number
  questions: BossQuestion[]
}

const SCHOLAR_LEVELS = [
  { level: 1, title: 'Curious Explorer', minXp: 0 },
  { level: 2, title: 'Quest Apprentice', minXp: 250 },
  { level: 3, title: 'Knowledge Knight', minXp: 550 },
  { level: 4, title: 'Star Strategist', minXp: 950 },
  { level: 5, title: 'DMHA Grand Scholar', minXp: 1450 },
  { level: 6, title: 'Legend of the House', minXp: 2100 },
]

function getScholarRank(xp: number) {
  let current = SCHOLAR_LEVELS[0]
  let next = SCHOLAR_LEVELS[1]
  for (let i = 0; i < SCHOLAR_LEVELS.length; i++) {
    if (xp >= SCHOLAR_LEVELS[i].minXp) {
      current = SCHOLAR_LEVELS[i]
      next = SCHOLAR_LEVELS[i + 1] || {
        level: current.level + 1,
        title: 'Supreme Master',
        minXp: current.minXp + 750,
      }
    }
  }
  const span = Math.max(1, next.minXp - current.minXp)
  const pct = Math.min(100, Math.max(0, Math.round(((xp - current.minXp) / span) * 100)))
  return {
    level: current.level,
    title: current.title,
    nextTitle: next.title,
    xpToNext: Math.max(0, next.minXp - xp),
    progressPct: pct,
  }
}

function getBossBankForSubject(subject: string, nextTopic: string): Omit<SubjectBossConfig, 'bossId'> {
  const lower = subject.toLowerCase()
  if (lower.includes('english')) {
    return {
      bossName: 'The Essay Sphinx',
      bossTitle: `Master of ${nextTopic}`,
      subject,
      tagline: 'Break the Sphinx’s riddle with crisp grammar, structure, and vocabulary!',
      accent: 'from-amber-500 to-rose-600',
      xpReward: 150,
      questions: [
        {
          id: 'eng-1',
          prompt: 'Which opening sentence is strongest for a formal school essay?',
          options: [
            'Hey guys, today I wanna talk about clean energy.',
            'Renewable energy is essential for building a sustainable and healthier future.',
            'Clean energy is kinda cool and everyone likes it.',
            'So basically energy stuff matters a lot.',
          ],
          correctIndex: 1,
          explanation: 'Formal essays avoid slang ("Hey guys", "kinda") and start with a clear, objective thesis statement.',
        },
        {
          id: 'eng-2',
          prompt: 'What is the main purpose of a topic sentence in a body paragraph?',
          options: [
            'To introduce the single main idea of that paragraph',
            'To list every fact from the whole essay at once',
            'To say goodbye to the reader',
            'To repeat the title word for word',
          ],
          correctIndex: 0,
          explanation: 'A strong topic sentence guides the reader by stating the paragraph’s focused point before giving examples.',
        },
        {
          id: 'eng-3',
          prompt: 'Choose the sentence with correct subject-verb agreement:',
          options: [
            'The group of Class 6 students are ready for the debate.',
            'Neither the teacher nor the students was late.',
            'Each of the essay paragraphs has a clear conclusion.',
            'The list of books were on the desk.',
          ],
          correctIndex: 2,
          explanation: '"Each" is singular, so it pairs with the singular verb "has".',
        },
      ],
    }
  }
  if (lower.includes('math')) {
    return {
      bossName: 'Professor Quadratix',
      bossTitle: `Guardian of ${nextTopic}`,
      subject,
      tagline: 'Solve 3 fast calculations to shatter Professor Quadratix’s equation shield!',
      accent: 'from-violet-600 to-indigo-700',
      xpReward: 150,
      questions: [
        {
          id: 'math-1',
          prompt: 'If 3x + 7 = 22, what is the value of x?',
          options: ['3', '5', '7', '15'],
          correctIndex: 1,
          explanation: 'Subtract 7 from both sides to get 3x = 15, then divide by 3: x = 5.',
        },
        {
          id: 'math-2',
          prompt: 'A rectangle has length 12 cm and width 5 cm. What is its perimeter?',
          options: ['17 cm', '34 cm', '60 cm', '24 cm'],
          correctIndex: 1,
          explanation: 'Perimeter = 2 × (length + width) = 2 × (12 + 5) = 34 cm.',
        },
        {
          id: 'math-3',
          prompt: 'What is 25% of 160?',
          options: ['20', '35', '40', '45'],
          correctIndex: 2,
          explanation: '25% is one-quarter (1/4). 160 ÷ 4 = 40.',
        },
      ],
    }
  }
  if (lower.includes('physics') || lower.includes('science')) {
    return {
      bossName: 'Captain Volt',
      bossTitle: `Commander of ${nextTopic}`,
      subject,
      tagline: 'Power up your scientific reasoning to outsmart Captain Volt!',
      accent: 'from-cyan-500 to-blue-700',
      xpReward: 150,
      questions: [
        {
          id: 'phy-1',
          prompt: 'What happens when a magnet is moved quickly inside a coil of wire?',
          options: [
            'The wire melts instantly',
            'An electric current is induced in the coil',
            'Gravity disappears around the wire',
            'The magnet loses all its mass',
          ],
          correctIndex: 1,
          explanation: 'A changing magnetic field inside a coil induces an electric current (Electromagnetic Induction).',
        },
        {
          id: 'phy-2',
          prompt: 'Which SI unit is used to measure force?',
          options: ['Joule (J)', 'Watt (W)', 'Newton (N)', 'Volt (V)'],
          correctIndex: 2,
          explanation: 'Force is measured in Newtons (N), named after Sir Isaac Newton.',
        },
        {
          id: 'phy-3',
          prompt: 'If a car travels 120 meters in 6 seconds, what is its average speed?',
          options: ['12 m/s', '20 m/s', '60 m/s', '720 m/s'],
          correctIndex: 1,
          explanation: 'Speed = Distance ÷ Time = 120 m ÷ 6 s = 20 m/s.',
        },
      ],
    }
  }
  if (lower.includes('chem')) {
    return {
      bossName: 'Dr. Alchemy',
      bossTitle: `Keeper of ${nextTopic}`,
      subject,
      tagline: 'Balance the reactions and decode pH clues to defeat Dr. Alchemy!',
      accent: 'from-emerald-500 to-teal-700',
      xpReward: 150,
      questions: [
        {
          id: 'chem-1',
          prompt: 'What pH value represents a completely neutral substance like pure water?',
          options: ['pH 1', 'pH 5', 'pH 7', 'pH 14'],
          correctIndex: 2,
          explanation: 'On the pH scale (0–14), below 7 is acidic, 7 is neutral, and above 7 is alkaline/basic.',
        },
        {
          id: 'chem-2',
          prompt: 'What does blue litmus paper turn into when dipped in an acid (like lemon juice)?',
          options: ['Red', 'Green', 'Stays blue', 'Colorless'],
          correctIndex: 0,
          explanation: 'Acids turn blue litmus paper red, while bases turn red litmus paper blue.',
        },
        {
          id: 'chem-3',
          prompt: 'When an acid reacts with a base, what two products are formed?',
          options: [
            'Salt and Water',
            'Oxygen and Iron',
            'Carbon and Sugar',
            'Hydrogen and Oil',
          ],
          correctIndex: 0,
          explanation: 'Neutralization: Acid + Base → Salt + Water.',
        },
      ],
    }
  }
  if (lower.includes('ict') || lower.includes('robot')) {
    return {
      bossName: 'Cyber Bot X',
      bossTitle: `Firewall of ${nextTopic}`,
      subject,
      tagline: 'Debug 3 logic puzzles to override Cyber Bot X!',
      accent: 'from-sky-500 to-indigo-700',
      xpReward: 150,
      questions: [
        {
          id: 'ict-1',
          prompt: 'Which number system do computers use at the hardware level?',
          options: ['Decimal (Base 10)', 'Binary (Base 2: 0s and 1s)', 'Roman numerals', 'Base 5'],
          correctIndex: 1,
          explanation: 'Computers process data using binary digits (bits): 0 (OFF) and 1 (ON).',
        },
        {
          id: 'ict-2',
          prompt: 'In programming, what does a "loop" let your code do?',
          options: [
            'Delete the computer screen',
            'Repeat a set of instructions automatically',
            'Turn off the internet',
            'Rename the keyboard',
          ],
          correctIndex: 1,
          explanation: 'Loops repeat actions cleanly without writing the same line of code over and over.',
        },
        {
          id: 'ict-3',
          prompt: 'What is the safest habit when choosing an account password?',
          options: [
            'Use "123456" so it is easy to guess',
            'Share it in public chat',
            'Mix letters, numbers, and symbols and keep it private',
            'Use your first name only',
          ],
          correctIndex: 2,
          explanation: 'Strong unique passwords protect your account from unauthorized access.',
        },
      ],
    }
  }
  return {
    bossName: `${subject} Sentinel`,
    bossTitle: `Challenger of ${nextTopic}`,
    subject,
    tagline: `Master ${nextTopic} concepts in 3 rapid-fire rounds to claim the Boss Trophy!`,
    accent: 'from-emerald-600 to-slate-800',
    xpReward: 150,
    questions: [
      {
        id: 'gen-1',
        prompt: `What is the smartest first step before revising "${nextTopic}" in ${subject}?`,
        options: [
          'Skim key definitions & teacher notes, then test yourself without looking',
          'Read the same page passively 10 times without taking notes',
          'Skip hard questions completely',
          'Wait until 5 minutes before the exam',
        ],
        correctIndex: 0,
        explanation: 'Active recall (testing yourself from memory) doubles retention compared to passive re-reading.',
      },
      {
        id: 'gen-2',
        prompt: 'If you get a practice question wrong, what turns that mistake into higher marks?',
        options: [
          'Close the notebook immediately',
          'Note why the right answer works and retry a similar question in 24 hours',
          'Memorize only the letter A/B/C without reading why',
          'Ignore that chapter',
        ],
        correctIndex: 1,
        explanation: 'Understanding the exact reason behind a mistake prevents repeating it on test day.',
      },
      {
        id: 'gen-3',
        prompt: 'How does studying in focused 10–15 minute missions help your brain?',
        options: [
          'It keeps concentration high and prevents fatigue',
          'It makes you forget faster',
          'It only works on weekends',
          'It replaces attending class',
        ],
        correctIndex: 0,
        explanation: 'Short focused sprints build strong memory pathways while keeping study fun and stress-free.',
      },
    ],
  }
}

export function SmartStudyCoachView({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const {
    role,
    students,
    quizzes,
    quizAttempts,
    assignments,
    feedback,
    examSheets,
    studyResources,
    merits,
    studyQuestProfiles,
    selectedChildId,
    activeStudentId,
    trackResourceDownload,
    completeStudyMission,
    logStudyFocusSession,
    clearStudyBossBattle,
    sendGuardianStudyCheer,
  } = useSchool()

  const activeStudent =
    role === 'student'
      ? students.find((s) => s.id === activeStudentId) || students[0]
      : students.find((s) => s.id === selectedChildId) || students[0]

  const questProfile = studyQuestProfiles[activeStudent.id] || {
    studentId: activeStudent.id,
    xp: 120,
    streakDays: 1,
    completedMissionIds: [],
    clearedBossIds: [],
    focusMinutesLogged: 0,
    unlockedBadges: ['First Quest'],
    guardianCheers: 0,
    lastStudyDate: new Date().toISOString().slice(0, 10),
  }

  const scholarRank = useMemo(() => getScholarRank(questProfile.xp), [questProfile.xp])

  // Interactive Mission Modal State
  const [activeMission, setActiveMission] = useState<StudyMission | null>(null)
  const [missionStepChecks, setMissionStepChecks] = useState<Record<number, boolean>>({})
  const [missionSecondsLeft, setMissionSecondsLeft] = useState(0)
  const [missionTimerRunning, setMissionTimerRunning] = useState(false)
  const [missionJustWon, setMissionJustWon] = useState(false)

  // Interactive Boss Battle Modal State
  const [activeBoss, setActiveBoss] = useState<SubjectBossConfig | null>(null)
  const [bossRound, setBossRound] = useState(0)
  const [bossHp, setBossHp] = useState(3)
  const [playerShield, setPlayerShield] = useState(3)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [bossResult, setBossResult] = useState<'playing' | 'victory' | 'defeat'>('playing')

  // Quick Focus Power-Up Widget State
  const [focusSubject, setFocusSubject] = useState<string>('')
  const [focusDurationPreset, setFocusDurationPreset] = useState<'10s' | '5m' | '10m' | '15m'>('5m')
  const [focusSecondsLeft, setFocusSecondsLeft] = useState<number>(300)
  const [focusRunning, setFocusRunning] = useState(false)

  // Reset modals whenever student changes
  useEffect(() => {
    setActiveMission(null)
    setActiveBoss(null)
    setMissionTimerRunning(false)
    setFocusRunning(false)
  }, [activeStudent.id])

  // Mission Timer Ticker
  useEffect(() => {
    if (!missionTimerRunning || missionSecondsLeft <= 0) return
    const t = window.setInterval(() => {
      setMissionSecondsLeft((prev) => {
        if (prev <= 1) {
          setMissionTimerRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [missionTimerRunning, missionSecondsLeft])

  // Standalone Focus Sprint Ticker
  useEffect(() => {
    if (!focusRunning) return
    if (focusSecondsLeft <= 0) {
      setFocusRunning(false)
      const mins = focusDurationPreset === '10s' ? 5 : Number(focusDurationPreset.replace('m', ''))
      const xp = focusDurationPreset === '10s' ? 40 : mins * 6
      logStudyFocusSession({
        studentId: activeStudent.id,
        subject: focusSubject || activeStudent.subjects[0]?.name || 'General Study',
        minutes: mins,
        xpReward: xp,
      })
      return
    }
    const t = window.setInterval(() => {
      setFocusSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [focusRunning, focusSecondsLeft, focusDurationPreset, focusSubject, activeStudent, logStudyFocusSession])

  // 1. Live Class Leaderboard Standing (locked strictly to student's own class)
  const standing = useMemo(() => {
    const classmates = students.filter((s) => s.className === activeStudent.className)
    const scored = classmates
      .map((s) => {
        const avg = s.subjects.length
          ? Math.round(s.subjects.reduce((acc, sub) => acc + sub.latestScore, 0) / s.subjects.length)
          : s.averageScore
        const attempts = quizAttempts.filter((a) => a.studentId === s.id)
        const qAvg = attempts.length
          ? Math.round(attempts.reduce((acc, a) => acc + a.percentage, 0) / attempts.length)
          : 0
        const mPts = merits
          .filter((m) => m.studentId === s.id && m.type === 'merit')
          .reduce((acc, m) => acc + m.points, 0)
        const pts = avg * 10 + Math.round(qAvg * 1.5) + mPts * 3 + Math.round(s.attendanceRate * 0.5)
        return { student: s, avg, pts }
      })
      .sort((a, b) => b.pts - a.pts)

    const idx = scored.findIndex((x) => x.student.id === activeStudent.id)
    const rank = idx >= 0 ? idx + 1 : 1
    const myPts = scored[idx]?.pts || 0
    const leader = scored[0]
    const ahead = idx > 0 ? scored[idx - 1] : null
    return {
      rank,
      total: scored.length,
      myPts,
      leaderName: leader?.student.name || '',
      gapToFirst: Math.max(0, (leader?.pts || 0) - myPts),
      aheadName: ahead?.student.name || '',
      gapToNext: ahead ? Math.max(1, ahead.pts - myPts) : 0,
    }
  }, [students, activeStudent, quizAttempts, merits])

  // 2. Student-Specific Assignments, Quizzes, Feedback & Exam Sheets
  const studentAssignments = useMemo(
    () => assignments.filter((a) => a.studentId === activeStudent.id),
    [assignments, activeStudent.id],
  )
  const pendingAssignments = useMemo(
    () => studentAssignments.filter((a) => a.status === 'pending' || a.status === 'overdue'),
    [studentAssignments],
  )
  const studentAttempts = useMemo(
    () => quizAttempts.filter((a) => a.studentId === activeStudent.id),
    [quizAttempts, activeStudent.id],
  )
  const quizAccuracy = useMemo(() => {
    if (studentAttempts.length === 0) return null
    return Math.round(
      studentAttempts.reduce((acc, a) => acc + a.percentage, 0) / studentAttempts.length,
    )
  }, [studentAttempts])

  const studentFeedback = useMemo(
    () => feedback.filter((f) => f.studentId === activeStudent.id),
    [feedback, activeStudent.id],
  )
  const sheetFeedback = useMemo(
    () => examSheets.filter((s) => s.studentId === activeStudent.id),
    [examSheets, activeStudent.id],
  )

  // 3. Deep Subject Result & Improvement Diagnostics
  const subjectInsights = useMemo(() => {
    return [...activeStudent.subjects]
      .map((sub: SubjectProgress) => {
        const delta = sub.latestScore - sub.previousScore
        const relatedPending = pendingAssignments.filter(
          (a) => a.subject.toLowerCase() === sub.name.toLowerCase(),
        )
        const relatedFeedback = studentFeedback.find(
          (f) => f.subject.toLowerCase() === sub.name.toLowerCase(),
        )

        let tier: 'boss_alert' | 'level_up' | 'rising_star' | 'mastered' = 'level_up'
        let tierLabel = 'Level-Up Zone'
        let recommendation = ''

        if (delta < 0 || sub.latestScore < 80) {
          tier = 'boss_alert'
          tierLabel = delta < 0 ? `Drop Alert (${delta}%)` : 'Priority Focus'
          recommendation =
            delta < 0
              ? `Score slipped from ${sub.previousScore}% to ${sub.latestScore}%. Spend 10 mins on "${sub.nextTopic}" with ${sub.teacher}'s notes, then beat the ${sub.name} Boss!`
              : `Currently at ${sub.latestScore}%. Focused active-recall drills on "${sub.nextTopic}" will unlock your biggest grade jump.`
        } else if (delta >= 5) {
          tier = 'rising_star'
          tierLabel = `Rising Star (+${delta}%)`
          recommendation = `Awesome +${delta}% surge! Keep momentum hot with a 5-min speed recap of "${sub.nextTopic}" to lock in A+ mastery.`
        } else if (sub.latestScore >= 88) {
          tier = 'mastered'
          tierLabel = 'Mastered Shield'
          recommendation = `Strong ${sub.latestScore}% mastery! Maintain your edge by attempting a timed past-paper question on "${sub.nextTopic}".`
        } else {
          tier = 'level_up'
          tierLabel = 'Level-Up Zone'
          recommendation = `Only ${Math.max(2, 90 - sub.latestScore)}% away from 90%+ top bracket. Practice "${sub.nextTopic}" examples to level up!`
        }

        if (relatedPending.length > 0) {
          recommendation += ` (${relatedPending.length} pending homework task due soon.)`
        } else if (relatedFeedback && relatedFeedback.category === 'attention') {
          recommendation += ` Teacher note: "${relatedFeedback.title}".`
        }

        // Priority sort score: lower = needs attention sooner
        const urgencyRank =
          (delta < 0 ? -40 : 0) + sub.latestScore - relatedPending.length * 6

        return {
          ...sub,
          delta,
          tier,
          tierLabel,
          recommendation,
          relatedPendingCount: relatedPending.length,
          urgencyRank,
        }
      })
      .sort((a, b) => a.urgencyRank - b.urgencyRank)
  }, [activeStudent.subjects, pendingAssignments, studentFeedback])

  useEffect(() => {
    if (subjectInsights[0]?.name) {
      setFocusSubject(subjectInsights[0].name)
    }
  }, [activeStudent.id, subjectInsights])

  const overallMetrics = useMemo(() => {
    const subs = activeStudent.subjects
    if (subs.length === 0) {
      return {
        currentAvg: activeStudent.averageScore,
        previousAvg: activeStudent.averageScore,
        netDelta: 0,
        biggestImprover: null as (typeof subjectInsights)[0] | null,
        urgentSubject: null as (typeof subjectInsights)[0] | null,
      }
    }
    const currentAvg = Math.round(subs.reduce((a, s) => a + s.latestScore, 0) / subs.length)
    const previousAvg = Math.round(subs.reduce((a, s) => a + s.previousScore, 0) / subs.length)
    const netDelta = currentAvg - previousAvg
    const biggestImprover = [...subjectInsights].sort((a, b) => b.delta - a.delta)[0] || null
    const urgentSubject = subjectInsights[0] || null
    return { currentAvg, previousAvg, netDelta, biggestImprover, urgentSubject }
  }, [activeStudent, subjectInsights])

  // 4. Missed Quiz Topics from Real Attempts
  const missedQuizTopics = useMemo(() => {
    const misses: {
      id: string
      subject: string
      quizTitle: string
      prompt: string
      options: string[]
      correctIndex: number
      correctAnswer: string
      explanation: string
    }[] = []

    studentAttempts.forEach((att) => {
      const quiz = quizzes.find((q) => q.id === att.quizId)
      if (!quiz) return
      quiz.questions.forEach((q, idx) => {
        if (att.answers[idx] !== q.correctIndex) {
          misses.push({
            id: `${att.id}-${q.id}`,
            subject: quiz.subject,
            quizTitle: quiz.title,
            prompt: q.prompt,
            options: q.options,
            correctIndex: q.correctIndex,
            correctAnswer: q.options[q.correctIndex],
            explanation: q.explanation,
          })
        }
      })
    })
    return misses
  }, [studentAttempts, quizzes])

  // 5. Dynamic Game Missions Board (generated strictly from student's live data!)
  const studyMissions = useMemo<StudyMission[]>(() => {
    const missions: StudyMission[] = []

    // Mission 1: Boss Recovery for Weakest / Declining Subject
    const weakest = subjectInsights[0]
    if (weakest) {
      missions.push({
        id: `mission-recover-${activeStudent.id}-${weakest.id}`,
        questType: 'BOSS RECOVERY',
        subject: weakest.name,
        title: `Rescue Mission: Master "${weakest.nextTopic}"`,
        coachReason:
          weakest.delta < 0
            ? `${weakest.name} dropped ${weakest.previousScore}% → ${weakest.latestScore}% (${weakest.delta}%). Recovering this topic gives the fastest boost to ${activeStudent.name.split(' ')[0]}'s rank!`
            : `${weakest.name} (${weakest.latestScore}%) is currently the #1 opportunity to climb ${activeStudent.className} standings.`,
        steps: [
          `Review ${weakest.teacher}'s key concepts on "${weakest.nextTopic}"`,
          `Write down 3 key rules or formulas from memory without peeking`,
          `Test yourself with 2 practice problems (or challenge the ${weakest.name} Boss!)`,
        ],
        xpReward: 120,
        estMinutes: 10,
        difficulty: 3,
        impactLabel: '+60 Leaderboard pts potential',
        targetTab: 'library',
        cta: 'Open Study Notes',
      })
    }

    // Mission 2: Pending / Overdue Homework Rescue
    const urgentHw = pendingAssignments[0]
    if (urgentHw) {
      missions.push({
        id: `mission-hw-${activeStudent.id}-${urgentHw.id}`,
        questType: 'HOMEWORK QUEST',
        subject: urgentHw.subject,
        title: `Clear Homework: "${urgentHw.title}"`,
        coachReason: `${urgentHw.status === 'overdue' ? 'Overdue' : 'Due soon'} (${urgentHw.dueDate}) for ${urgentHw.teacher}. Clearing pending work protects assessment consistency.`,
        steps: [
          `Open the assignment brief for "${urgentHw.title}"`,
          `Complete the main questions step-by-step and double-check neatness`,
          `Submit in DMHA Homework tab to lock in full credit`,
        ],
        xpReward: 95,
        estMinutes: 15,
        difficulty: 2,
        impactLabel: 'Protects term coursework grade',
        targetTab: 'assignments',
        cta: 'Go to Homework',
      })
    }

    // Mission 3: Unattempted Live Online Quiz
    const unattemptedQuiz = quizzes.find(
      (q) =>
        q.status === 'published' &&
        !studentAttempts.some((a) => a.quizId === q.id),
    )
    if (unattemptedQuiz) {
      missions.push({
        id: `mission-quiz-${activeStudent.id}-${unattemptedQuiz.id}`,
        questType: 'QUIZ CHALLENGE',
        subject: unattemptedQuiz.subject,
        title: `Speed Arena: "${unattemptedQuiz.title}"`,
        coachReason: `Unattempted live quiz (${unattemptedQuiz.durationMins} mins). Scoring 85%+ adds instant Quiz Bonus points to the Class Leaderboard!`,
        steps: [
          `Do a 2-minute formula & keyword warmup for ${unattemptedQuiz.subject}`,
          `Complete all ${unattemptedQuiz.questions.length} timed questions carefully`,
          `Review instant explanations on any tricky item`,
        ],
        xpReward: 110,
        estMinutes: unattemptedQuiz.durationMins || 10,
        difficulty: 2,
        impactLabel: 'Up to +150 Quiz Bonus pts',
        targetTab: 'quizzes',
        cta: 'Play Online Quiz',
      })
    }

    // Mission 4: Missed Quiz Concept Repair
    if (missedQuizTopics.length > 0) {
      missions.push({
        id: `mission-mistakes-${activeStudent.id}-${missedQuizTopics.length}`,
        questType: 'MISTAKE REPAIR',
        subject: missedQuizTopics[0].subject,
        title: `Fix ${missedQuizTopics.length} Missed Quiz Trap(s)`,
        coachReason: `Detected ${missedQuizTopics.length} incorrect answer(s) in past quizzes. Turning mistakes into mastery prevents repeat mark losses.`,
        steps: [
          `Read each missed question & its explanation in the Recovery Zone below`,
          `Explain the correct answer out loud in your own words`,
          `Retake the quiz or defeat the ${missedQuizTopics[0].subject} Boss`,
        ],
        xpReward: 100,
        estMinutes: 8,
        difficulty: 3,
        impactLabel: 'Turns weak traps into A+ marks',
        targetTab: 'quizzes',
        cta: 'Retake Quiz',
      })
    }

    // Mission 5: Exam Sheet Examiner Remarks Review
    if (sheetFeedback.length > 0) {
      const latest = sheetFeedback[0]
      missions.push({
        id: `mission-script-${activeStudent.id}-${latest.id}`,
        questType: 'SCRIPT REVIEW',
        subject: latest.subject,
        title: `Decode Teacher Remarks: "${latest.examTitle}"`,
        coachReason: `Scored ${latest.marksObtained}/${latest.totalMarks}. Reviewing exact examiner comments stops avoidable deductions next term.`,
        steps: [
          `Inspect scanned script "${latest.examTitle}"`,
          `Highlight the exact question where marks were lost`,
          `Rewrite one improved answer using teacher feedback`,
        ],
        xpReward: 85,
        estMinutes: 8,
        difficulty: 2,
        impactLabel: 'Stops repeat exam deductions',
        targetTab: 'scripts',
        cta: 'Inspect Script',
      })
    }

    // Mission 6: Keep Rising Star Momentum Alive!
    const star = overallMetrics.biggestImprover
    if (star && star.delta > 0) {
      missions.push({
        id: `mission-combo-${activeStudent.id}-${star.id}`,
        questType: 'MOMENTUM COMBO',
        subject: star.name,
        title: `Keep the +${star.delta}% Streak Alive in ${star.name}!`,
        coachReason: `${star.name} jumped from ${star.previousScore}% to ${star.latestScore}% (+${star.delta}%). A quick 5-min power drill locks in this winning habit!`,
        steps: [
          `Celebrate your +${star.delta}% jump in ${star.name}!`,
          `Preview 1 advanced example from "${star.nextTopic}"`,
          `Log a quick 5-min Focus Sprint to keep your combo streak glowing`,
        ],
        xpReward: 70,
        estMinutes: 5,
        difficulty: 1,
        impactLabel: 'Locks in A+ winning streak',
        targetTab: 'library',
        cta: 'Preview Notes',
      })
    }

    return missions
  }, [
    activeStudent,
    subjectInsights,
    pendingAssignments,
    quizzes,
    studentAttempts,
    missedQuizTopics,
    sheetFeedback,
    overallMetrics.biggestImprover,
  ])

  const completedMissionCount = studyMissions.filter((m) =>
    questProfile.completedMissionIds.includes(m.id),
  ).length
  const remainingXpAvailable = studyMissions
    .filter((m) => !questProfile.completedMissionIds.includes(m.id))
    .reduce((acc, m) => acc + m.xpReward, 0)

  const recommendedResources = useMemo(() => {
    const focusSubjects = new Set(subjectInsights.slice(0, 3).map((s) => s.name.toLowerCase()))
    const matched = studyResources.filter((r) => focusSubjects.has(r.subject.toLowerCase()))
    return matched.length > 0 ? matched : studyResources.slice(0, 3)
  }, [studyResources, subjectInsights])

  // Helpers to launch interactive Mission & Boss Battle
  const openMissionModal = (mission: StudyMission) => {
    setActiveMission(mission)
    setMissionStepChecks({})
    setMissionSecondsLeft(mission.estMinutes * 60)
    setMissionTimerRunning(false)
    setMissionJustWon(questProfile.completedMissionIds.includes(mission.id))
  }

  const launchBossBattle = (subjectName: string, nextTopic: string) => {
    const base = getBossBankForSubject(subjectName, nextTopic)
    // Inject real missed quiz questions for this subject at the front of the boss battle!
    const subjectMisses: BossQuestion[] = missedQuizTopics
      .filter((m) => m.subject.toLowerCase() === subjectName.toLowerCase())
      .slice(0, 2)
      .map((m) => ({
        id: `miss-${m.id}`,
        prompt: `[Missed Quiz Rematch] ${m.prompt}`,
        options: m.options,
        correctIndex: m.correctIndex,
        explanation: m.explanation,
      }))

    const mergedQuestions = [...subjectMisses, ...base.questions].slice(0, 3)
    const bossId = `boss-${activeStudent.id}-${subjectName.toLowerCase().replace(/\s+/g, '-')}`

    setActiveBoss({
      ...base,
      bossId,
      questions: mergedQuestions,
    })
    setBossRound(0)
    setBossHp(mergedQuestions.length)
    setPlayerShield(3)
    setSelectedOption(null)
    setBossResult('playing')
  }

  const handleBossAnswer = (optionIndex: number) => {
    if (!activeBoss || selectedOption !== null || bossResult !== 'playing') return
    const q = activeBoss.questions[bossRound]
    setSelectedOption(optionIndex)
    const isCorrect = optionIndex === q.correctIndex

    if (isCorrect) {
      const nextBossHp = Math.max(0, bossHp - 1)
      setBossHp(nextBossHp)
      if (nextBossHp === 0) {
        setBossResult('victory')
        clearStudyBossBattle({
          studentId: activeStudent.id,
          bossId: activeBoss.bossId,
          bossName: activeBoss.bossName,
          subject: activeBoss.subject,
          xpReward: activeBoss.xpReward,
        })
      }
    } else {
      const nextShield = Math.max(0, playerShield - 1)
      setPlayerShield(nextShield)
      if (nextShield === 0) {
        setBossResult('defeat')
      }
    }
  }

  const handleNextBossRound = () => {
    if (!activeBoss) return
    const nextIdx = bossRound + 1
    if (nextIdx >= activeBoss.questions.length) {
      if (bossHp <= 1) {
        setBossResult('victory')
        clearStudyBossBattle({
          studentId: activeStudent.id,
          bossId: activeBoss.bossId,
          bossName: activeBoss.bossName,
          subject: activeBoss.subject,
          xpReward: activeBoss.xpReward,
        })
      } else {
        setBossResult('defeat')
      }
      return
    }
    setBossRound(nextIdx)
    setSelectedOption(null)
  }

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const primaryBossSubject = subjectInsights[0]

  return (
    <PageShell
      eyebrow={`DMHA Smart Study Coach · ${activeStudent.name} (${activeStudent.className})`}
      title="Smart Study Coach & Quest Arena"
      subtitle="AI performance diagnostics powered by real results & improvement trends — turning every weak topic into a fun, playable game mission."
      action={
        <div className="flex flex-wrap gap-2">
          {primaryBossSubject && (
            <button
              type="button"
              onClick={() =>
                launchBossBattle(primaryBossSubject.name, primaryBossSubject.nextTopic)
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:brightness-105"
            >
              <Icon name="spark" size={14} />
              Fight {primaryBossSubject.name} Boss (+150 XP)
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('leaderboard')}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
          >
            Class Leaderboard
          </button>
        </div>
      }
    >
      {role === 'guardian' && <ChildSwitcherBar />}

      {/* 1. RPG SCHOLAR PLAYER HERO CARD */}
      <div className="dmhs-hero overflow-hidden rounded-[28px] p-6 text-white shadow-xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300 ring-1 ring-emerald-400/30">
                <Icon name="award" size={12} />
                Level {scholarRank.level} · {scholarRank.title}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-black text-amber-200">
                🔥 {questProfile.streakDays}-Day Study Streak
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/20 px-3 py-1 text-[10px] font-black text-sky-200">
                ⏱ {questProfile.focusMinutesLogged} mins Focused
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
              {standing.rank === 1
                ? `${activeStudent.name.split(' ')[0]} rules #1 in ${activeStudent.className} — Defend the Crown!`
                : `${activeStudent.name.split(' ')[0]} is #${standing.rank} in ${activeStudent.className} — Only ${standing.gapToNext} pts behind #${standing.rank - 1}!`}
            </h2>

            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              {overallMetrics.urgentSubject && overallMetrics.urgentSubject.delta < 0 ? (
                <>
                  <strong>Coach Analysis:</strong> {overallMetrics.urgentSubject.name} dipped{' '}
                  <strong className="text-rose-300">
                    {overallMetrics.urgentSubject.previousScore}% → {overallMetrics.urgentSubject.latestScore}% ({overallMetrics.urgentSubject.delta}%)
                  </strong>
                  , while{' '}
                  <strong className="text-emerald-300">
                    {overallMetrics.biggestImprover?.name} surged +{overallMetrics.biggestImprover?.delta}%
                  </strong>
                  . Clear today’s missions to earn <strong>+{remainingXpAvailable} XP</strong> and jump straight toward the top podium!
                </>
              ) : (
                <>
                  <strong>Coach Analysis:</strong> {activeStudent.name.split(' ')[0]}’s average is{' '}
                  <strong className="text-emerald-300">
                    {overallMetrics.currentAvg}% ({overallMetrics.netDelta >= 0 ? `+${overallMetrics.netDelta}` : overallMetrics.netDelta}% overall trend)
                  </strong>
                  . Focus on <strong>{primaryBossSubject?.name}</strong> ({primaryBossSubject?.latestScore}%) and beat the Boss Battle to earn{' '}
                  <strong>+150 XP &amp; +3 House Merits</strong>!
                </>
              )}
            </p>

            {/* XP Progress Bar */}
            <div className="mt-4 max-w-xl">
              <div className="flex items-center justify-between text-[11px] font-extrabold">
                <span className="text-emerald-300">{questProfile.xp.toLocaleString()} Total XP</span>
                <span className="text-slate-300">
                  {scholarRank.xpToNext} XP to Lv.{scholarRank.level + 1} ({scholarRank.nextTitle})
                </span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/10 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-amber-300 transition-all duration-500"
                  style={{ width: `${Math.max(8, scholarRank.progressPct)}%` }}
                />
              </div>
            </div>

            {/* Unlocked Trophy Badges Shelf */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Badges:
              </span>
              {questProfile.unlockedBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-200"
                >
                  ★ {badge}
                </span>
              ))}
              {role === 'guardian' && (
                <button
                  type="button"
                  onClick={() => sendGuardianStudyCheer(activeStudent.id)}
                  className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  <Icon name="heart" size={11} />
                  Cheer {activeStudent.name.split(' ')[0]} (+15 XP Boost)
                </button>
              )}
            </div>
          </div>

          {/* Right Live Stats Cluster */}
          <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-emerald-300">Class Rank</p>
              <p className="mt-1 text-2xl font-black">#{standing.rank}</p>
              <p className="text-[10px] text-slate-400">of {standing.total} in {activeStudent.className}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-amber-300">Quests Done</p>
              <p className="mt-1 text-2xl font-black">
                {completedMissionCount}/{studyMissions.length}
              </p>
              <p className="text-[10px] text-slate-400">{questProfile.clearedBossIds.length} Bosses Slain</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-sky-300">Avg Trend</p>
              <p className="mt-1 text-2xl font-black">
                {overallMetrics.netDelta >= 0 ? `+${overallMetrics.netDelta}%` : `${overallMetrics.netDelta}%`}
              </p>
              <p className="text-[10px] text-slate-400">{overallMetrics.previousAvg}% → {overallMetrics.currentAvg}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[9px] font-extrabold uppercase text-rose-300">Gap to #1</p>
              <p className="mt-1 text-2xl font-black">{standing.gapToFirst}</p>
              <p className="text-[10px] text-slate-400">Leaderboard pts</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SMART RESULT & IMPROVEMENT DIAGNOSTIC STRIP */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dmhs-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Biggest Improver
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
              {overallMetrics.biggestImprover
                ? `+${overallMetrics.biggestImprover.delta}%`
                : 'Steady'}
            </span>
          </div>
          <p className="mt-1.5 text-base font-black text-slate-900">
            {overallMetrics.biggestImprover?.name || 'Balanced'}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            {overallMetrics.biggestImprover
              ? `Jumped ${overallMetrics.biggestImprover.previousScore}% → ${overallMetrics.biggestImprover.latestScore}%`
              : 'All subjects holding steady'}
          </p>
        </div>

        <div className="dmhs-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Urgent Focus Target
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700">
              {overallMetrics.urgentSubject
                ? `${overallMetrics.urgentSubject.latestScore}% (${overallMetrics.urgentSubject.delta >= 0 ? `+${overallMetrics.urgentSubject.delta}` : overallMetrics.urgentSubject.delta}%)`
                : 'None'}
            </span>
          </div>
          <p className="mt-1.5 text-base font-black text-slate-900">
            {overallMetrics.urgentSubject?.name || 'All Clear'}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
            Next: {overallMetrics.urgentSubject?.nextTopic || 'Keep practicing'}
          </p>
        </div>

        <div className="dmhs-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Quiz &amp; Homework Health
            </span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-700">
              {quizAccuracy !== null ? `${quizAccuracy}% Quiz Avg` : 'No Quiz Yet'}
            </span>
          </div>
          <p className="mt-1.5 text-base font-black text-slate-900">
            {pendingAssignments.length} Pending Homework
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            {missedQuizTopics.length} quiz mistake(s) queued for repair
          </p>
        </div>

        <div className="dmhs-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Quest Completion Forecast
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800">
              +{remainingXpAvailable} XP Loot
            </span>
          </div>
          <p className="mt-1.5 text-base font-black text-slate-900">
            Projected +4% Avg Boost
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Every 3 quests cleared unlocks +2 House Merits!
          </p>
        </div>
      </div>

      {/* 3. MAIN ARENA: INTERACTIVE GAME MISSION BOARD + SUBJECT IMPROVEMENT MATRIX */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Left: Game-Style Study Mission Board */}
        <div className="dmhs-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-600">
                Playable Study Quests · Auto-Built from Results
              </span>
              <h3 className="mt-0.5 text-lg font-black text-slate-900">
                Today’s Game Mission Board
              </h3>
            </div>
            <span className="rounded-full bg-[#0f172a] px-3 py-1 text-xs font-black text-emerald-300">
              {completedMissionCount}/{studyMissions.length} Cleared
            </span>
          </div>

          <div className="mt-4 space-y-3.5">
            {studyMissions.map((mission) => {
              const isDone = questProfile.completedMissionIds.includes(mission.id)
              const badgeColor =
                mission.questType === 'BOSS RECOVERY'
                  ? 'bg-rose-100 text-rose-800'
                  : mission.questType === 'HOMEWORK QUEST'
                    ? 'bg-amber-100 text-amber-800'
                    : mission.questType === 'QUIZ CHALLENGE'
                      ? 'bg-violet-100 text-violet-800'
                      : mission.questType === 'MISTAKE REPAIR'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-emerald-100 text-emerald-800'

              return (
                <div
                  key={mission.id}
                  className={`rounded-2xl border p-4 transition ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-slate-200/80 bg-slate-50/70 hover:border-emerald-300 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase ${badgeColor}`}>
                          {mission.questType}
                        </span>
                        <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-300">
                          {mission.subject}
                        </span>
                        <span className="text-[10px] font-black text-amber-600">
                          {'★'.repeat(mission.difficulty)}
                          {'☆'.repeat(3 - mission.difficulty)} · {mission.estMinutes}m
                        </span>
                        <span className="rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-black text-amber-900">
                          +{mission.xpReward} XP
                        </span>
                      </div>

                      <h4
                        className={`mt-2 text-sm font-black ${
                          isDone ? 'text-emerald-900 line-through' : 'text-slate-900'
                        }`}
                      >
                        {mission.title}
                      </h4>

                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {mission.coachReason}
                      </p>

                      <p className="mt-1.5 text-[10px] font-extrabold text-emerald-700">
                        Reward Impact: {mission.impactLabel}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[11px] font-black text-white">
                          <Icon name="check" size={12} />
                          Cleared (+{mission.xpReward} XP)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMissionModal(mission)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#0f172a] px-4 py-2 text-[11px] font-black text-emerald-300 shadow-xs transition hover:bg-emerald-600 hover:text-white"
                        >
                          <Icon name="play" size={11} />
                          Start Mission
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate(mission.targetTab)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-extrabold text-slate-700 hover:bg-slate-50"
                      >
                        {mission.cta} →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Subject Result & Improvement Analysis Radar */}
        <div className="space-y-6">
          <div className="dmhs-card p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-sky-600">
                  Before vs. Now Analysis
                </span>
                <h3 className="mt-0.5 text-lg font-black text-slate-900">
                  Subject Mastery &amp; Suggestions
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Sorted by Priority
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {subjectInsights.map((sub) => {
                const isBossCleared = questProfile.clearedBossIds.includes(
                  `boss-${activeStudent.id}-${sub.name.toLowerCase().replace(/\s+/g, '-')}`,
                )
                const tierBadge =
                  sub.tier === 'boss_alert'
                    ? 'bg-rose-100 text-rose-700'
                    : sub.tier === 'rising_star'
                      ? 'bg-emerald-100 text-emerald-800'
                      : sub.tier === 'mastered'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${tierBadge}`}>
                          {sub.tierLabel}
                        </span>
                        <span className="text-xs font-black text-slate-900">{sub.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400">
                          {sub.previousScore}% →
                        </span>
                        <span className="text-xs font-black text-slate-900">
                          {sub.latestScore}%
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                            sub.delta > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : sub.delta < 0
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {sub.delta > 0 ? `+${sub.delta}%` : `${sub.delta}%`}
                        </span>
                      </div>
                    </div>

                    {/* Dual Progress Bar showing previous score marker vs latest score */}
                    <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          sub.tier === 'boss_alert'
                            ? 'bg-rose-500'
                            : sub.latestScore >= 88
                              ? 'bg-emerald-500'
                              : 'bg-sky-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.latestScore)}%` }}
                      />
                      <div
                        title={`Previous Score: ${sub.previousScore}%`}
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-900/70"
                        style={{ left: `${Math.min(99, sub.previousScore)}%` }}
                      />
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                      {sub.recommendation}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-400">
                        Topic: <strong className="text-slate-700">{sub.nextTopic}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => launchBossBattle(sub.name, sub.nextTopic)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black transition ${
                          isBossCleared
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-[#0f172a] text-amber-300 hover:bg-rose-600 hover:text-white'
                        }`}
                      >
                        {isBossCleared ? '★ Rematch Boss' : '⚔️ Battle Boss'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Focus Power-Up Sprint Card */}
          <div className="dmhs-card p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-600">
                  Gamified Study Timer
                </span>
                <h3 className="mt-0.5 text-base font-black text-slate-900">
                  Focus Power-Up Sprint
                </h3>
              </div>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">
                +40 to +90 XP
              </span>
            </div>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <select
                value={focusSubject}
                onChange={(e) => setFocusSubject(e.target.value)}
                disabled={focusRunning}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                {subjectInsights.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.latestScore}%)
                  </option>
                ))}
              </select>

              <div className="flex gap-1">
                {(
                  [
                    ['10s', '10s Demo', 10],
                    ['5m', '5m', 300],
                    ['10m', '10m', 600],
                    ['15m', '15m', 900],
                  ] as const
                ).map(([key, label, secs]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={focusRunning}
                    onClick={() => {
                      setFocusDurationPreset(key)
                      setFocusSecondsLeft(secs)
                    }}
                    className={`flex-1 rounded-xl px-2 py-2 text-[10px] font-black transition ${
                      focusDurationPreset === key
                        ? 'bg-[#0f172a] text-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#0f172a] px-4 py-3.5 text-white">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                  {focusRunning ? `Powering up ${focusSubject}...` : 'Ready to Launch'}
                </p>
                <p className="mt-0.5 font-mono text-2xl font-black tracking-tight">
                  {formatTimer(focusSecondsLeft)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (focusSecondsLeft === 0) {
                      const secs =
                        focusDurationPreset === '10s'
                          ? 10
                          : Number(focusDurationPreset.replace('m', '')) * 60
                      setFocusSecondsLeft(secs)
                    }
                    setFocusRunning((r) => !r)
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    focusRunning
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                  }`}
                >
                  {focusRunning ? 'Pause' : 'Start Sprint'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MISTAKE RECOVERY ZONE & MATCHED DIGITAL STUDY NOTES */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="dmhs-card p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Quiz Mistake Recovery ({missedQuizTopics.length})
              </h3>
              <p className="text-xs font-medium text-slate-400">
                Auto-extracted from {activeStudent.name.split(' ')[0]}’s Online Quiz attempts.
              </p>
            </div>
            {missedQuizTopics.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  launchBossBattle(missedQuizTopics[0].subject, missedQuizTopics[0].quizTitle)
                }
                className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-900 hover:bg-amber-200"
              >
                ⚔️ Rematch Mistakes
              </button>
            )}
          </div>

          {missedQuizTopics.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
              Clean slate! No unresolved quiz mistakes right now. Challenge a Subject Boss or play a live Online Quiz to earn bonus XP!
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {missedQuizTopics.slice(0, 4).map((m) => (
                <div key={m.id} className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4">
                  <p className="text-[10px] font-extrabold uppercase text-amber-800">
                    {m.subject} · {m.quizTitle}
                  </p>
                  <p className="mt-1 text-xs font-black text-slate-900">{m.prompt}</p>
                  <p className="mt-1.5 text-xs font-bold text-emerald-700">
                    Correct Answer: {m.correctAnswer}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">{m.explanation}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dmhs-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Recommended Study Power-Ups
              </h3>
              <p className="text-xs font-medium text-slate-400">
                Matched to {activeStudent.name.split(' ')[0]}’s top priority subjects.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="text-xs font-extrabold text-emerald-700 hover:underline"
            >
              All Materials →
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {recommendedResources.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="min-w-0">
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-300">
                    {res.subject} · {res.type}
                  </span>
                  <p className="mt-1.5 truncate text-xs font-black text-slate-900">{res.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {res.teacherName} · {res.durationOrPages}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => trackResourceDownload(res.id)}
                  className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-700 shadow-2xs ring-1 ring-emerald-200 hover:bg-emerald-600 hover:text-white"
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE MISSION PLAY MODAL */}
      {activeMission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
          onClick={() => {
            setMissionTimerRunning(false)
            setActiveMission(null)
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[#0f172a] px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                    {activeMission.questType}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-900">
                    +{activeMission.xpReward} XP Loot
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-black text-slate-900">{activeMission.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{activeMission.coachReason}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMissionTimerRunning(false)
                  setActiveMission(null)
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {missionJustWon ? (
              <div className="mt-5 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 p-6 text-center text-white">
                <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-100">
                  Quest Complete!
                </p>
                <h4 className="mt-1 text-2xl font-black">
                  +{activeMission.xpReward} XP Claimed!
                </h4>
                <p className="mt-2 text-xs text-emerald-50">
                  Awesome work, {activeStudent.name.split(' ')[0]}! Progress saved to SQLite &amp; synced with your Quest Profile.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMission(null)}
                    className="rounded-full bg-white px-5 py-2 text-xs font-black text-emerald-800"
                  >
                    Back to Mission Board
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tab = activeMission.targetTab
                      setActiveMission(null)
                      onNavigate(tab)
                    }}
                    className="rounded-full bg-slate-950/30 px-5 py-2 text-xs font-black text-white ring-1 ring-white/30"
                  >
                    {activeMission.cta} →
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Built-in Mission Timer */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0f172a] p-4 text-white">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                      Mission Focus Clock
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black">
                      {formatTimer(missionSecondsLeft)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMissionTimerRunning((r) => !r)}
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-300"
                    >
                      {missionTimerRunning ? 'Pause Clock' : 'Start Clock'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMissionSecondsLeft(10)
                        setMissionTimerRunning(true)
                      }}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold text-slate-200 hover:bg-white/20"
                    >
                      10s Quick Sprint
                    </button>
                  </div>
                </div>

                {/* Interactive Micro-Objectives */}
                <div className="mt-5">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Mission Checkpoints (Check off each step)
                  </p>
                  <div className="mt-2.5 space-y-2.5">
                    {activeMission.steps.map((step, idx) => {
                      const done = !!missionStepChecks[idx]
                      return (
                        <label
                          key={idx}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                            done
                              ? 'border-emerald-300 bg-emerald-50/70'
                              : 'border-slate-200 bg-slate-50/70 hover:border-emerald-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() =>
                              setMissionStepChecks((prev) => ({ ...prev, [idx]: !prev[idx] }))
                            }
                            className="mt-0.5 size-4 rounded accent-emerald-600"
                          />
                          <span
                            className={`text-xs font-bold ${
                              done ? 'text-emerald-800 line-through' : 'text-slate-800'
                            }`}
                          >
                            Step {idx + 1}: {step}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const tab = activeMission.targetTab
                      setMissionTimerRunning(false)
                      setActiveMission(null)
                      onNavigate(tab)
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Open {activeMission.cta} →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMissionTimerRunning(false)
                      completeStudyMission({
                        studentId: activeStudent.id,
                        missionId: activeMission.id,
                        title: activeMission.title,
                        subject: activeMission.subject,
                        xpReward: activeMission.xpReward,
                        focusMinutes: activeMission.estMinutes,
                      })
                      setMissionJustWon(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Icon name="award" size={14} />
                    Complete Mission &amp; Claim +{activeMission.xpReward} XP
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. PLAYABLE 3-ROUND SUBJECT BOSS BATTLE MODAL */}
      {activeBoss && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
          onClick={() => setActiveBoss(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white shadow-2xl"
          >
            {/* Boss Header Banner */}
            <div className={`bg-gradient-to-r ${activeBoss.accent} p-6 text-white`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em]">
                    ⚔️ DMHA Study Boss Arena · {activeBoss.subject}
                  </span>
                  <h3 className="mt-2 text-2xl font-black">{activeBoss.bossName}</h3>
                  <p className="text-xs font-semibold text-white/85">{activeBoss.bossTitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveBoss(null)}
                  className="flex size-9 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/35"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              {/* Dual HP Bars */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 px-3.5 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase text-rose-200">
                    Boss HP ({bossHp}/{activeBoss.questions.length})
                  </p>
                  <p className="mt-1 text-base tracking-widest">
                    {'❤️'.repeat(bossHp)}
                    {'🖤'.repeat(Math.max(0, activeBoss.questions.length - bossHp))}
                  </p>
                </div>
                <div className="rounded-2xl bg-black/25 px-3.5 py-2.5">
                  <p className="text-[10px] font-extrabold uppercase text-emerald-200">
                    {activeStudent.name.split(' ')[0]}’s Shield ({playerShield}/3)
                  </p>
                  <p className="mt-1 text-base tracking-widest">
                    {'🛡️'.repeat(playerShield)}
                    {'⬜'.repeat(Math.max(0, 3 - playerShield))}
                  </p>
                </div>
              </div>
            </div>

            {/* Boss Arena Body */}
            <div className="p-6">
              {bossResult === 'victory' ? (
                <div className="rounded-3xl bg-emerald-50 p-6 text-center">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">
                    🏆 Boss Defeated!
                  </p>
                  <h4 className="mt-1 text-2xl font-black text-slate-900">
                    {activeStudent.name.split(' ')[0]} conquered {activeBoss.bossName}!
                  </h4>
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    Unlocked <strong>+{activeBoss.xpReward} XP</strong>, <strong>+3 House Merit</strong>, and the{' '}
                    <strong>Boss Slayer</strong> badge!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveBoss(null)}
                    className="mt-5 rounded-full bg-[#0f172a] px-6 py-2.5 text-xs font-black text-emerald-300"
                  >
                    Return to Quest Board
                  </button>
                </div>
              ) : bossResult === 'defeat' ? (
                <div className="rounded-3xl bg-amber-50 p-6 text-center">
                  <p className="text-xs font-black uppercase tracking-[.18em] text-amber-800">
                    Shields Depleted — Great Effort!
                  </p>
                  <h4 className="mt-1 text-xl font-black text-slate-900">
                    {activeBoss.bossName} survived this round!
                  </h4>
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    Review the Coach Hints you unlocked and jump right back in for a rematch!
                  </p>
                  <div className="mt-5 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBossRound(0)
                        setBossHp(activeBoss.questions.length)
                        setPlayerShield(3)
                        setSelectedOption(null)
                        setBossResult('playing')
                      }}
                      className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-black text-white"
                    >
                      Retry Boss Battle
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveBoss(null)}
                      className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-xs font-extrabold text-slate-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const q = activeBoss.questions[bossRound]
                  const answered = selectedOption !== null
                  const wasCorrect = selectedOption === q.correctIndex
                  return (
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span>
                          Round {bossRound + 1} of {activeBoss.questions.length}
                        </span>
                        <span className="text-emerald-600">
                          Correct Hit = -1 Boss HP
                        </span>
                      </div>

                      <h4 className="mt-2.5 text-base font-black leading-snug text-slate-900">
                        {q.prompt}
                      </h4>

                      <div className="mt-4 space-y-2.5">
                        {q.options.map((opt, idx) => {
                          let style =
                            'border-slate-200 bg-slate-50/70 text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40'
                          if (answered) {
                            if (idx === q.correctIndex) {
                              style = 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                            } else if (idx === selectedOption) {
                              style = 'border-rose-400 bg-rose-50 text-rose-900'
                            } else {
                              style = 'border-slate-100 bg-slate-50 text-slate-400 opacity-65'
                            }
                          }
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={answered}
                              onClick={() => handleBossAnswer(idx)}
                              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-xs font-bold transition ${style}`}
                            >
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-black text-slate-700 shadow-2xs">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          )
                        })}
                      </div>

                      {answered && (
                        <div
                          className={`mt-4 rounded-2xl p-4 text-xs ${
                            wasCorrect
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                              : 'border border-amber-200 bg-amber-50 text-amber-900'
                          }`}
                        >
                          <p className="font-black">
                            {wasCorrect
                              ? '⚡ CRITICAL HIT! You damaged the Boss (-1 HP)!'
                              : '🛡️ Boss Counter-Attack (-1 Shield)! Here is the Coach Tip:'}
                          </p>
                          <p className="mt-1 leading-relaxed">{q.explanation}</p>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={handleNextBossRound}
                              className="rounded-full bg-[#0f172a] px-4 py-2 text-xs font-black text-emerald-300"
                            >
                              {bossRound + 1 >= activeBoss.questions.length
                                ? 'Finish Battle →'
                                : 'Next Round →'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
