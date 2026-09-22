'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PramaanApp() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/session/PRM-CX0104')
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center bg-[var(--surface-canvas)]">
      <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
        <div className="w-6 h-6 border-2 border-[var(--cobalt)] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading Live Interview Room…</span>
      </div>
    </div>
  )
}
