"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"

export function PaperLoading() {
  return (
    <div className="flex h-full">
      {/* Left panel skeleton */}
      <div className="flex-1 p-6 space-y-4 border-r">
        <Skeleton className="h-[500px] w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>

      {/* Right panel skeleton */}
      <div className="flex-1 p-4 space-y-3">
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Analyzing paper...</p>
            <p className="text-xs text-muted-foreground">
              Extracting sections and math notations using AI
            </p>
          </div>
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-2 mt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
