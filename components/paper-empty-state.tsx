"use client"

import { FileText, ArrowUp } from "lucide-react"

export function PaperEmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm space-y-4 px-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <FileText className="size-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Understand any research paper
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Paste a PDF URL or upload a paper above. The AI will break it down
            into sections and explain complex math and concepts at an
            accessible level.
          </p>
        </div>
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <ArrowUp className="size-3.5" />
          <span>Start by adding a paper above</span>
        </div>
        <div className="pt-2 space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium">How it works:</p>
          <div className="text-[11px] text-muted-foreground space-y-1 text-left mx-auto max-w-xs">
            <p>1. Upload a PDF or paste a direct link to one</p>
            <p>2. AI extracts and structures the paper into sections</p>
            <p>3. Hover over sections to see them highlighted</p>
            <p>4. Click any section for a college-level explanation</p>
            <p>5. Ask follow-up questions in the explanation panel</p>
          </div>
        </div>
      </div>
    </div>
  )
}
