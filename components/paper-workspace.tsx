"use client"

import { useMemo } from "react"
import { PdfViewer } from "@/components/pdf-viewer"
import { StructuredView } from "@/components/structured-view"
import { EquationMap } from "@/components/equation-map"
import { SavedTabContent } from "@/components/saved-tab-content"
import { ExplanationModal } from "@/components/explanation-modal"
import { DeepDiveModal } from "@/components/deep-dive-modal"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Paper, Section } from "@/lib/paper-schema"
import type { Equation } from "@/lib/paper-schema"
import type { Conversation } from "@/lib/storage/types"
import type { Artifact } from "@/lib/storage/types"
import type { PersonaGoalValue } from "@/components/persona-goal-selector"

export interface PaperWorkspaceProps {
  paper: Paper
  /** Base64 PDF data (no data URL prefix) or null if not available */
  pdfData: string | null
  pdfUrl: string | null
  hoveredSection: string | null
  onSectionHover: (sectionId: string | null) => void
  selectedSection: Section | null
  onSectionClick: (section: Section) => void
  isExplainOpen: boolean
  onExplainClose: () => void
  deepDiveLatex: string | null
  deepDiveSection: Section | null
  onDeepDive: (latex: string, section: Section) => void
  onDeepDiveClose: () => void
  /** When user clicks Explain on an equation in the equation map */
  onExplainEquation?: (equation: Equation, section: Section) => void
  /** Optional: paperId and blockIds for saving conversations (library mode) */
  paperId?: string
  blockIds?: Record<string, string[]>
  /** Optional: saved conversation to restore for selected section */
  initialConversationId?: string | null
  initialMessages?: Array<{ role: "user" | "assistant"; content: string }>
  /** When user opens a saved conversation from the Saved tab */
  onOpenConversation?: (conversation: Conversation, section: Section | null) => void
  /** Artifact generation (when paperId is set) */
  onGenerateSummary?: (opts: { persona?: PersonaGoalValue }) => void
  onGenerateSlides?: (opts: { persona?: PersonaGoalValue; slideCount?: number }) => void
  onGenerateFlashcards?: (opts: { persona?: PersonaGoalValue; count?: number }) => void
  onOpenArtifact?: (artifact: Artifact) => void
  isGeneratingArtifact?: boolean
}

export function PaperWorkspace({
  paper,
  pdfData,
  pdfUrl,
  hoveredSection,
  onSectionHover,
  selectedSection,
  onSectionClick,
  isExplainOpen,
  onExplainClose,
  deepDiveLatex,
  deepDiveSection,
  onDeepDive,
  onDeepDiveClose,
  onExplainEquation,
  paperId,
  blockIds,
  initialConversationId,
  initialMessages,
  onOpenConversation,
  onGenerateSummary,
  onGenerateSlides,
  onGenerateFlashcards,
  onOpenArtifact,
  isGeneratingArtifact,
}: PaperWorkspaceProps) {
  const highlightedPage = useMemo(() => {
    if (!hoveredSection || !paper) return null
    const section = paper.sections.find((s) => s.id === hoveredSection)
    return section?.pageNumbers[0] ?? null
  }, [hoveredSection, paper])

  const deepDiveSectionContext = useMemo(() => {
    if (!deepDiveSection) return ""
    return deepDiveSection.content
      .map((block) => {
        if (block.type === "math") return `$$${block.value}$$`
        return block.value
      })
      .join("\n\n")
  }, [deepDiveSection])

  return (
    <>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={50} minSize={30}>
          <PdfViewer
            pdfData={pdfData}
            pdfUrl={pdfUrl}
            highlightedPage={highlightedPage}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={30}>
          <Tabs defaultValue="sections" className="h-full flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-9 shrink-0">
              <TabsTrigger value="sections" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Sections
              </TabsTrigger>
              <TabsTrigger value="equations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                Equations
              </TabsTrigger>
              {paperId && (
                <TabsTrigger value="saved" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                  Saved
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="sections" className="flex-1 min-h-0 mt-0">
              <StructuredView
                paper={paper}
                hoveredSection={hoveredSection}
                onSectionHover={onSectionHover}
                onSectionClick={onSectionClick}
                onDeepDive={onDeepDive}
              />
            </TabsContent>
            <TabsContent value="equations" className="flex-1 min-h-0 mt-0">
              <EquationMap
                paper={paper}
                onExplainEquation={onExplainEquation}
                onDeepDive={onDeepDive}
              />
            </TabsContent>
            {paperId && (
              <TabsContent value="saved" className="flex-1 min-h-0 mt-0">
                <SavedTabContent
                  paperId={paperId}
                  paper={paper}
                  onOpenConversation={onOpenConversation ?? (() => {})}
                  onGenerateSummary={onGenerateSummary ?? (() => {})}
                  onGenerateSlides={onGenerateSlides ?? (() => {})}
                  onGenerateFlashcards={onGenerateFlashcards ?? (() => {})}
                  onOpenArtifact={onOpenArtifact ?? (() => {})}
                  isGenerating={isGeneratingArtifact}
                />
              </TabsContent>
            )}
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>

      <ExplanationModal
        section={selectedSection}
        paperTitle={paper.title}
        paperAbstract={paper.abstract}
        allSections={paper.sections}
        isOpen={isExplainOpen}
        onClose={onExplainClose}
        paperId={paperId}
        blockIds={blockIds}
        initialConversationId={initialConversationId ?? undefined}
        initialMessages={initialMessages}
      />

      <DeepDiveModal
        latex={deepDiveLatex}
        sectionContext={deepDiveSectionContext}
        paperTitle={paper.title}
        isOpen={!!deepDiveLatex}
        onClose={onDeepDiveClose}
      />
    </>
  )
}
