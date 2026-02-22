"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { PaperWorkspace } from "@/components/paper-workspace"
import {
  getPaper,
  blobToBase64,
  saveArtifact,
  buildArtifact,
} from "@/lib/storage/db"
import { compressPaperForPrompt } from "@/lib/paper-utils"
import type { Paper, Section } from "@/lib/paper-schema"
import type { Artifact } from "@/lib/storage/types"
import { Toaster, toast } from "sonner"
import { ArtifactViewerModal } from "@/components/artifact-viewer-modal"

export default function PaperViewPage() {
  const params = useParams()
  const router = useRouter()
  const paperId = typeof params.paperId === "string" ? params.paperId : null

  const [paper, setPaper] = useState<Paper | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [blockIds, setBlockIds] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)
  const [openConversationMessages, setOpenConversationMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }> | null
  >(null)
  const [deepDiveLatex, setDeepDiveLatex] = useState<string | null>(null)
  const [deepDiveSection, setDeepDiveSection] = useState<Section | null>(null)
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false)
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false)
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null)

  useEffect(() => {
    if (!paperId) {
      setLoading(false)
      setError("Missing paper ID")
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getPaper(paperId)
      .then(async (record) => {
        if (cancelled || !record) {
          if (!record) setError("Paper not found")
          return
        }
        setPaper(record.paperData)
        setBlockIds(record.blockIds ?? {})
        setPdfUrl(record.pdfUrl ?? null)
        if (record.pdfBlob) {
          try {
            const dataUrl = await blobToBase64(record.pdfBlob)
            setPdfBase64(dataUrl.replace(/^data:application\/pdf;base64,/, ""))
          } catch {
            setPdfBase64(null)
          }
        } else {
          setPdfBase64(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
          console.error(e)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paperId])

  const handleSectionClick = useCallback((section: Section) => {
    setSelectedSection(section)
    setOpenConversationId(null)
    setOpenConversationMessages(null)
    setIsModalOpen(true)
  }, [])

  const handleOpenConversation = useCallback(
    (
      conv: { conversationId: string; messages: Array<{ role: "user" | "assistant"; content: string }> },
      section: Section | null
    ) => {
      if (!section) return
      setSelectedSection(section)
      setOpenConversationId(conv.conversationId)
      setOpenConversationMessages(conv.messages)
      setIsModalOpen(true)
    },
    []
  )

  const handleGenerateSummary = useCallback(
    async (opts: { persona?: { persona?: string; goal?: string; tone?: string } }) => {
      if (!paper || !paperId) return
      setIsGeneratingArtifact(true)
      try {
        const paperText = compressPaperForPrompt(paper, "summary")
        const res = await fetch("/api/generate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperText,
            persona: opts.persona?.persona,
            goal: opts.persona?.goal,
            tone: opts.persona?.tone,
          }),
        })
        if (!res.ok) throw new Error("Failed to generate summary")
        const markdown = await res.text()
        const artifact = buildArtifact(
          paperId,
          "summary",
          { persona: opts.persona?.persona, goal: opts.persona?.goal, tone: opts.persona?.tone },
          { type: "summary", markdown }
        )
        await saveArtifact(artifact)
        toast.success("Summary saved")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to generate summary")
      } finally {
        setIsGeneratingArtifact(false)
      }
    },
    [paper, paperId]
  )

  const handleGenerateSlides = useCallback(
    async (opts: { persona?: { persona?: string; goal?: string; tone?: string }; slideCount?: number }) => {
      if (!paper || !paperId) return
      setIsGeneratingArtifact(true)
      try {
        const paperText = compressPaperForPrompt(paper, "slides")
        const res = await fetch("/api/generate-slides", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperText,
            persona: opts.persona?.persona,
            goal: opts.persona?.goal,
            tone: opts.persona?.tone,
            slideCount: opts.slideCount ?? 6,
          }),
        })
        if (!res.ok) throw new Error("Failed to generate slides")
        const data = await res.json()
        const artifact = buildArtifact(
          paperId,
          "slides",
          { persona: opts.persona?.persona, goal: opts.persona?.goal, tone: opts.persona?.tone, slideCount: opts.slideCount ?? 6 },
          { type: "slides", title: data.title, slides: data.slides }
        )
        await saveArtifact(artifact)
        toast.success("Slides saved")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to generate slides")
      } finally {
        setIsGeneratingArtifact(false)
      }
    },
    [paper, paperId]
  )

  const handleGenerateFlashcards = useCallback(
    async (opts: { persona?: { persona?: string; goal?: string; tone?: string }; count?: number }) => {
      if (!paper || !paperId) return
      setIsGeneratingArtifact(true)
      try {
        const paperText = compressPaperForPrompt(paper, "flashcards")
        const res = await fetch("/api/generate-flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paperText,
            persona: opts.persona?.persona,
            goal: opts.persona?.goal,
            tone: opts.persona?.tone,
            flashcardCount: opts.count ?? 12,
          }),
        })
        if (!res.ok) throw new Error("Failed to generate flashcards")
        const data = await res.json()
        const artifact = buildArtifact(
          paperId,
          "flashcards",
          { persona: opts.persona?.persona, goal: opts.persona?.goal, tone: opts.persona?.tone, flashcardCount: opts.count ?? 12 },
          { type: "flashcards", cards: data.cards }
        )
        await saveArtifact(artifact)
        toast.success("Flashcards saved")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to generate flashcards")
      } finally {
        setIsGeneratingArtifact(false)
      }
    },
    [paper, paperId]
  )

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setOpenConversationId(null)
    setOpenConversationMessages(null)
    setTimeout(() => setSelectedSection(null), 300)
  }, [])

  const handleDeepDive = useCallback((latex: string, section: Section) => {
    setDeepDiveLatex(latex)
    setDeepDiveSection(section)
    setIsDeepDiveOpen(true)
  }, [])

  const handleDeepDiveClose = useCallback(() => {
    setIsDeepDiveOpen(false)
    setTimeout(() => {
      setDeepDiveLatex(null)
      setDeepDiveSection(null)
    }, 300)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        Loading paper…
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <p className="text-destructive">{error || "Paper not found"}</p>
        <button
          type="button"
          onClick={() => router.push("/library")}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toaster position="top-right" />
      {!pdfBase64 && !pdfUrl && (
        <div className="px-4 py-2 bg-muted/50 text-muted-foreground text-sm border-b shrink-0">
          PDF not saved — re-upload on the home page to view the PDF. Sections and explanations are
          still available below.
        </div>
      )}
      <div className="flex-1 min-h-0">
        <PaperWorkspace
          paper={paper}
          pdfData={pdfBase64}
          pdfUrl={pdfUrl}
          hoveredSection={hoveredSection}
          onSectionHover={setHoveredSection}
          selectedSection={selectedSection}
          onSectionClick={handleSectionClick}
          isExplainOpen={isModalOpen}
          onExplainClose={handleModalClose}
          deepDiveLatex={deepDiveLatex}
          deepDiveSection={deepDiveSection}
          onDeepDive={handleDeepDive}
          onDeepDiveClose={handleDeepDiveClose}
          onExplainEquation={(_, section) => handleSectionClick(section)}
          paperId={paperId}
          blockIds={blockIds}
          onOpenConversation={handleOpenConversation}
          onGenerateSummary={handleGenerateSummary}
          onGenerateSlides={handleGenerateSlides}
          onGenerateFlashcards={handleGenerateFlashcards}
          onOpenArtifact={setOpenArtifact}
          isGeneratingArtifact={isGeneratingArtifact}
          initialConversationId={openConversationId}
          initialMessages={openConversationMessages ?? undefined}
        />
      </div>

      <ArtifactViewerModal
        artifact={openArtifact}
        onClose={() => setOpenArtifact(null)}
      />
    </div>
  )
}
