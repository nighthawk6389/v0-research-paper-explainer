"use client"

import { useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Sparkles, ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface PaperLoadingProps {
  status?: {
    message: string
    detail?: string
    model?: string
    prompt?: string
  }
}

export function PaperLoading({ status }: PaperLoadingProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  
  return (
    <div className="flex h-full">
      {/* Left panel skeleton */}
      <div className="flex-1 p-6 space-y-4 border-r">
        <Skeleton className="h-[500px] w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>

      {/* Right panel skeleton with status */}
      <div className="flex-1 p-4 space-y-3">
        <div className="mb-6">
          <div className="flex items-start gap-3">
            <Loader2 className="size-5 animate-spin text-primary mt-0.5 shrink-0" />
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium leading-snug">
                {status?.message || "Analyzing paper..."}
              </p>
              {status?.detail && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {status.detail}
                </p>
              )}
              {status?.model && (
                <div className="flex items-center gap-2 pt-1">
                  <Sparkles className="size-3 text-muted-foreground" />
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {status.model}
                  </Badge>
                </div>
              )}
              {status?.prompt && (
                <div className="mt-3 border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrompt(!showPrompt)}
                    className="w-full justify-between h-auto py-2 text-xs"
                  >
                    <span className="flex items-center gap-1.5">
                      {showPrompt ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      View system prompt
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {status.prompt.length} chars
                    </span>
                  </Button>
                  {showPrompt && (
                    <div className="p-3 border-t bg-muted/50 max-h-[300px] overflow-y-auto">
                      <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono">
                        {status.prompt}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
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
