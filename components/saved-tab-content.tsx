"use client"

import { useState, useEffect, useCallback } from "react"
import { listConversations, listArtifacts } from "@/lib/storage/db"
import { ConversationList } from "@/components/conversation-list"
import { ArtifactPanel } from "@/components/artifact-panel"
import type { Conversation, Artifact } from "@/lib/storage/types"
import type { Paper, Section } from "@/lib/paper-schema"
import type { PersonaGoalValue } from "@/components/persona-goal-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SavedTabContentProps {
  paperId: string
  paper: Paper
  onOpenConversation: (conversation: Conversation, section: Section | null) => void
  onGenerateSummary: (opts: { persona?: PersonaGoalValue }) => void
  onGenerateSlides: (opts: { persona?: PersonaGoalValue; slideCount?: number }) => void
  onGenerateFlashcards: (opts: { persona?: PersonaGoalValue; count?: number }) => void
  onOpenArtifact: (artifact: Artifact) => void
  isGenerating?: boolean
}

export function SavedTabContent({
  paperId,
  paper,
  onOpenConversation,
  onGenerateSummary,
  onGenerateSlides,
  onGenerateFlashcards,
  onOpenArtifact,
  isGenerating,
}: SavedTabContentProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  const refresh = useCallback(async () => {
    const [convos, arts] = await Promise.all([
      listConversations(paperId),
      listArtifacts(paperId),
    ])
    setConversations(convos)
    setArtifacts(arts)
  }, [paperId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleGenerateSummary = useCallback(
    async (opts: Parameters<typeof onGenerateSummary>[0]) => {
      await onGenerateSummary(opts)
      refresh()
    },
    [onGenerateSummary, refresh]
  )
  const handleGenerateSlides = useCallback(
    async (opts: Parameters<typeof onGenerateSlides>[0]) => {
      await onGenerateSlides(opts)
      refresh()
    },
    [onGenerateSlides, refresh]
  )
  const handleGenerateFlashcards = useCallback(
    async (opts: Parameters<typeof onGenerateFlashcards>[0]) => {
      await onGenerateFlashcards(opts)
      refresh()
    },
    [onGenerateFlashcards, refresh]
  )

  const handleOpenConversation = useCallback(
    (conversation: Conversation) => {
      const section = paper.sections.find((s) => s.id === conversation.anchor.sectionId) ?? null
      onOpenConversation(conversation, section)
    },
    [paper.sections, onOpenConversation]
  )

  return (
    <Tabs defaultValue="conversations" className="h-full flex flex-col">
      <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-9 shrink-0">
        <TabsTrigger value="conversations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs">
          Conversations
        </TabsTrigger>
        <TabsTrigger value="artifacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs">
          Artifacts
        </TabsTrigger>
      </TabsList>
      <TabsContent value="conversations" className="flex-1 min-h-0 mt-0">
        <ConversationList conversations={conversations} onOpen={handleOpenConversation} />
      </TabsContent>
      <TabsContent value="artifacts" className="flex-1 min-h-0 mt-0">
        <ArtifactPanel
          paperId={paperId}
          artifacts={artifacts}
          onGenerateSummary={handleGenerateSummary}
          onGenerateSlides={handleGenerateSlides}
          onGenerateFlashcards={handleGenerateFlashcards}
          onOpenArtifact={onOpenArtifact}
          isGenerating={isGenerating}
        />
      </TabsContent>
    </Tabs>
  )
}
