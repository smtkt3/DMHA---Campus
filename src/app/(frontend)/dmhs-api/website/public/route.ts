import { NextResponse } from 'next/server'
import { loadPersistedState } from '@/lib/dmhs-db'
import { initialSchoolWebsiteConfig } from '@/components/school/data'
import type { SchoolWebsiteConfig } from '@/components/school/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const state = loadPersistedState()
  const currentData = (state.exists && state.data ? state.data : {}) as Record<string, unknown>
  const config: SchoolWebsiteConfig =
    currentData.websiteConfig && typeof currentData.websiteConfig === 'object'
      ? (currentData.websiteConfig as SchoolWebsiteConfig)
      : initialSchoolWebsiteConfig
  return NextResponse.json({ ok: true, config })
}
