"use client"

import { useState, useEffect, useCallback } from "react"
import { LibraryList } from "@/components/library-list"
import { listPapers } from "@/lib/storage/db"
import type { PaperRecord } from "@/lib/storage/types"

export default function LibraryPage() {
  const [papers, setPapers] = useState<PaperRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const list = await listPapers()
      setPapers(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b shrink-0">
        <h1 className="font-semibold text-lg">Library</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Papers you&apos;ve analyzed and saved locally
        </p>
      </div>
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="p-4 text-muted-foreground">Loading…</div>
        ) : (
          <LibraryList papers={papers} onRefresh={refresh} />
        )}
      </div>
    </div>
  )
}
