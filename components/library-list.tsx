"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Search, Trash2, ExternalLink } from "lucide-react"
import type { PaperRecord } from "@/lib/storage/types"
import { deletePaper } from "@/lib/storage/db"
import { toast } from "sonner"

interface LibraryListProps {
  papers: PaperRecord[]
  onRefresh: () => void
}

export function LibraryList({ papers: initialPapers, onRefresh }: LibraryListProps) {
  const [search, setSearch] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return initialPapers
    const q = search.trim().toLowerCase()
    return initialPapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.authors ?? []).some((a) => a.toLowerCase().includes(q))
    )
  }, [initialPapers, search])

  const handleDelete = useCallback(
    async (paperId: string) => {
      setIsDeleting(true)
      try {
        await deletePaper(paperId)
        onRefresh()
        setDeleteId(null)
        toast.success("Removed from library")
      } catch (e) {
        toast.error("Failed to remove")
        console.error(e)
      } finally {
        setIsDeleting(false)
      }
    },
    [onRefresh]
  )

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {initialPapers.length === 0
              ? "No papers in library. Analyze a paper on the home page to save it here."
              : "No papers match your search."}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => (
              <li
                key={p.paperId}
                className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/paper/${p.paperId}`}
                      className="font-medium text-foreground hover:underline line-clamp-2"
                    >
                      {p.title}
                    </Link>
                    {p.authors && p.authors.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {p.authors.join(", ")}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {p.stats.numSections} sections · {p.stats.numEquations} equations · saved{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/paper/${p.paperId}`} aria-label="Open">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(p.paperId)}
                      aria-label="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from library?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the paper and all its saved explanations and artifacts. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
