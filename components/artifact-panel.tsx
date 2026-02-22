"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Presentation, Layers } from "lucide-react"
import type { Artifact } from "@/lib/storage/types"
import { PersonaGoalSelector, type PersonaGoalValue } from "@/components/persona-goal-selector"

interface ArtifactPanelProps {
  paperId: string
  artifacts: Artifact[]
  onGenerateSummary: (opts: { persona?: PersonaGoalValue }) => void
  onGenerateSlides: (opts: { persona?: PersonaGoalValue; slideCount?: number }) => void
  onGenerateFlashcards: (opts: { persona?: PersonaGoalValue; count?: number }) => void
  onOpenArtifact: (artifact: Artifact) => void
  isGenerating?: boolean
}

export function ArtifactPanel({
  paperId,
  artifacts,
  onGenerateSummary,
  onGenerateSlides,
  onGenerateFlashcards,
  onOpenArtifact,
  isGenerating = false,
}: ArtifactPanelProps) {
  const [persona, setPersona] = useState<PersonaGoalValue>({})

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0 space-y-2">
        <PersonaGoalSelector value={persona} onChange={setPersona} disabled={isGenerating} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={isGenerating}
            onClick={() => onGenerateSummary({ persona })}
          >
            <FileText className="size-3.5" />
            Summary
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={isGenerating}
            onClick={() => onGenerateSlides({ persona, slideCount: 6 })}
          >
            <Presentation className="size-3.5" />
            Slides
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={isGenerating}
            onClick={() => onGenerateFlashcards({ persona, count: 12 })}
          >
            <Layers className="size-3.5" />
            Flashcards
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              Generated summaries, slides, and flashcards will appear here.
            </p>
          ) : (
            artifacts.map((a) => (
              <button
                key={a.artifactId}
                type="button"
                onClick={() => onOpenArtifact(a)}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors border cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span className="font-medium capitalize">{a.artifactType}</span>
                <span className="text-xs text-muted-foreground block mt-0.5">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
