"use client"

import { useState, useCallback } from "react"
import { PaperUploadBar } from "@/components/paper-upload-bar"
import { PaperWorkspace } from "@/components/paper-workspace"
import { PaperLoading } from "@/components/paper-loading"
import { PaperEmptyState } from "@/components/paper-empty-state"
import {
  getPaperIdFromUpload,
  getPaper,
  savePaper,
  buildPaperRecord,
  blobToBase64,
  saveArtifact,
  buildArtifact,
} from "@/lib/storage/db"
import { compressPaperForPrompt } from "@/lib/paper-utils"
import { readParseStream } from "@/lib/sse-stream"
import { Toaster, toast } from "sonner"
import type { Paper, Section } from "@/lib/paper-schema"

export default function Home() {
  const [paper, setPaper] = useState<Paper | null>(null)
  const [paperId, setPaperId] = useState<string | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)
  const [openConversationMessages, setOpenConversationMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }> | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [showUploadHint, setShowUploadHint] = useState(false)
  const [deepDiveLatex, setDeepDiveLatex] = useState<string | null>(null)
  const [deepDiveSection, setDeepDiveSection] = useState<Section | null>(null)
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("anthropic/claude-haiku-4.5")
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<{
    message: string
    detail?: string
    model?: string
  } | null>(null)

  const handleAnalyze = useCallback(
    async (uploadData: { pdfBase64?: string; url?: string; pdfBlob?: Blob; model: string }) => {
      setIsLoading(true)
      setError(null)
      setPaper(null)
      setShowUploadHint(false)
      setLoadingStatus({ message: "Starting analysis..." })
      setSelectedModel(uploadData.model)

      if (uploadData.pdfBase64) {
        setPdfBase64(uploadData.pdfBase64)
        setPdfUrl(null)
      } else if (uploadData.url) {
        setPdfBase64(null)
        setPdfUrl(uploadData.url)
      }

      try {
        const id = await getPaperIdFromUpload(uploadData.pdfBlob, uploadData.url)
        const existing = await getPaper(id)
        if (existing) {
          setPaperId(id)
          setPaper(existing.paperData)
          if (existing.pdfBlob) {
            const dataUrl = await blobToBase64(existing.pdfBlob)
            setPdfBase64(dataUrl.replace(/^data:application\/pdf;base64,/, ""))
            setPdfUrl(existing.pdfUrl ?? null)
          } else {
            setPdfBase64(null)
            setPdfUrl(existing.pdfUrl ?? null)
          }
          toast.success("Loaded from library", {
            description: `${existing.title} - ${existing.paperData.sections.length} sections`,
          })
          return
        }

        const response = await fetch("/api/parse-paper?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64: uploadData.pdfBase64,
            url: uploadData.url,
            model: uploadData.model,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to start analysis")
        }

        await readParseStream(response, {
          onStatus: (data) =>
            setLoadingStatus({
              message: data.message || "Processing...",
              detail: data.detail,
            }),
          onComplete: async (validPaper) => {
            const id = await getPaperIdFromUpload(uploadData.pdfBlob, uploadData.url)
            setPaperId(id)
            setPaper(validPaper)
            const pdfBlob = uploadData.pdfBlob
            const record = buildPaperRecord(id, validPaper, {
              pdfBlob,
              pdfUrl: uploadData.url ?? null,
              source: uploadData.url ? { type: "url", value: uploadData.url } : { type: "upload" },
            })
            try {
              await savePaper(record)
              toast.success("Paper analyzed and saved", {
                description: `Found ${validPaper.sections.length} sections. Saved to Library.`,
              })
            } catch (err) {
              console.error("[v0] Failed to save paper:", err)
              toast.error("Saved locally but failed to add to Library", {
                description: err instanceof Error ? err.message : "Unknown error",
              })
            }
          },
          onFetchError: () => {
            setError(null)
            setShowUploadHint(true)
            toast.error("Could not download from this URL", {
              description:
                "This publisher blocks automated downloads. Please download the PDF in your browser and use the Upload button instead.",
              duration: 8000,
            })
          },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred"
        setError(message)
        toast.error("Analysis failed", { description: message })
      } finally {
        setIsLoading(false)
        setLoadingStatus(null)
      }
    },
    []
  )

  const handleSectionClick = useCallback((section: Section) => {
    setSelectedSection(section)
    setOpenConversationId(null)
    setOpenConversationMessages(null)
    setIsModalOpen(true)
  }, [])

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
          {
            persona: opts.persona?.persona,
            goal: opts.persona?.goal,
            tone: opts.persona?.tone,
          },
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
    async (opts: {
      persona?: { persona?: string; goal?: string; tone?: string }
      slideCount?: number
    }) => {
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
          {
            persona: opts.persona?.persona,
            goal: opts.persona?.goal,
            tone: opts.persona?.tone,
            slideCount: opts.slideCount ?? 6,
          },
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
    async (opts: {
      persona?: { persona?: string; goal?: string; tone?: string }
      count?: number
    }) => {
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
          {
            persona: opts.persona?.persona,
            goal: opts.persona?.goal,
            tone: opts.persona?.tone,
            flashcardCount: opts.count ?? 12,
          },
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

  const handleOpenConversation = useCallback(
    (
      _conversation: { conversationId: string; messages: Array<{ role: "user" | "assistant"; content: string }> },
      section: Section | null
    ) => {
      if (!section) return
      setSelectedSection(section)
      setOpenConversationId(_conversation.conversationId)
      setOpenConversationMessages(_conversation.messages)
      setIsModalOpen(true)
    },
    []
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

  const hasPaper = paper !== null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toaster position="top-right" />

      <PaperUploadBar
        onAnalyze={handleAnalyze}
        isLoading={isLoading}
        showUploadHint={showUploadHint}
      />

      <main className="flex-1 min-h-0">
        {isLoading ? (
          <PaperLoading status={loadingStatus || undefined} />
        ) : !hasPaper ? (
          <PaperEmptyState />
        ) : (
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
            paperId={paperId ?? undefined}
            onOpenConversation={handleOpenConversation}
            onGenerateSummary={handleGenerateSummary}
            onGenerateSlides={handleGenerateSlides}
            onGenerateFlashcards={handleGenerateFlashcards}
            onOpenArtifact={() => {}}
            isGeneratingArtifact={isGeneratingArtifact}
            initialConversationId={openConversationId}
            initialMessages={openConversationMessages ?? undefined}
          />
        )}
      </main>

      {error && !isLoading && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive font-medium">Analysis Error</p>
          <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
        </div>
      )}
    </div>
  )
}
