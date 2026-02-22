"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileText, Library } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppHeader({ paperTitle }: { paperTitle?: string | null }) {
  const pathname = usePathname()

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-4 px-4 py-2 max-w-screen-2xl mx-auto">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
            pathname === "/" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <FileText className="size-4" />
          <span>Paper Explainer</span>
        </Link>
        <Link
          href="/library"
          className={cn(
            "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
            pathname === "/library" ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Library className="size-4" />
          <span>Library</span>
        </Link>
        {paperTitle && (
          <span className="text-sm text-muted-foreground truncate max-w-[200px] md:max-w-md" title={paperTitle}>
            / {paperTitle}
          </span>
        )}
      </div>
    </header>
  )
}
