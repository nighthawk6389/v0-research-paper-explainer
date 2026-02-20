"use client"

import { useState, useCallback, useMemo } from "react"
import { PaperUploadBar } from "@/components/paper-upload-bar"
import { PdfViewer } from "@/components/pdf-viewer"
import { StructuredView } from "@/components/structured-view"
import { ExplanationModal } from "@/components/explanation-modal"
import { DeepDiveModal } from "@/components/deep-dive-modal"
import { PaperLoading } from "@/components/paper-loading"
import { PaperEmptyState } from "@/components/paper-empty-state"
import { getCachedPaper, setCachedPaper } from "@/lib/paper-cache"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Toaster, toast } from "sonner"
import type { Paper, Section } from "@/lib/paper-schema"

export default function Home() {
  const [paper, setPaper] = useState<Paper | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUploadHint, setShowUploadHint] = useState(false)
  const [deepDiveLatex, setDeepDiveLatex] = useState<string | null>(null)
  const [deepDiveSection, setDeepDiveSection] = useState<Section | null>(null)
  const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("anthropic/claude-haiku-4.5")
  const [loadingStatus, setLoadingStatus] = useState<{
    message: string
    detail?: string
    model?: string
  } | null>(null)

  // Compute highlighted page from hovered section
  const highlightedPage = useMemo(() => {
    if (!hoveredSection || !paper) return null
    const section = paper.sections.find((s) => s.id === hoveredSection)
    return section?.pageNumbers[0] ?? null
  }, [hoveredSection, paper])

  const handleAnalyze = useCallback(
    async (uploadData: { pdfBase64?: string; url?: string; pdfBlob?: Blob; model: string }) => {
      setIsLoading(true)
      setError(null)
      setPaper(null)
      setShowUploadHint(false)
      setLoadingStatus({ message: "Starting analysis..." })
      setSelectedModel(uploadData.model)

      // Store PDF data for the viewer
      if (uploadData.pdfBase64) {
        setPdfBase64(uploadData.pdfBase64)
        setPdfUrl(null)
      } else if (uploadData.url) {
        setPdfBase64(null)
        setPdfUrl(uploadData.url)
      }

      try {
        // Check cache first
        const cached = await getCachedPaper(uploadData.pdfBase64, uploadData.url)
        if (cached) {
          setPaper(cached.paper)
          toast.success("Loaded from cache", {
            description: `${cached.paper.title} - ${cached.paper.sections.length} sections`,
          })
          setIsLoading(false)
          setLoadingStatus(null)
          return
        }

        // Use streaming endpoint
        const response = await fetch("/api/parse-paper?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64: uploadData.pdfBase64,
            url: uploadData.url,
            model: uploadData.model,
          }),
        })

        if (!response.ok || !response.body) {
          throw new Error("Failed to start analysis")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let receivedComplete = false
        let eventCount = { status: 0, complete: 0, error: 0, other: 0 }
        let chunkIndex = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log("[v0] SSE stream ended", {
              receivedComplete,
              eventCount,
              bufferLength: buffer.length,
              remainingBuffer: buffer.slice(0, 200),
            })
            break
          }

          chunkIndex++
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          if (lines.length > 0 && chunkIndex <= 3) {
            console.log("[v0] SSE chunk", { chunkIndex, lineCount: lines.length, firstLine: lines[0]?.slice(0, 80) })
          }

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.startsWith("event:")) {
              const event = line.slice(6).trim()
              const nextLine = lines[i + 1]
              if (!nextLine?.startsWith("data:")) {
                console.warn("[v0] SSE event without data line", { event, nextLine: nextLine?.slice(0, 60), lineIndex: i })
                eventCount.other++
                continue
              }

              const rawData = nextLine.slice(5).trim()
              let data: { paper?: Paper; fetchFailed?: boolean; error?: string; message?: string; detail?: string }
              try {
                data = JSON.parse(rawData) as typeof data
              } catch (parseErr) {
                console.error("[v0] SSE data parse failed", {
                  event,
                  rawDataSnippet: rawData.slice(0, 120),
                  error: parseErr instanceof Error ? parseErr.message : String(parseErr),
                })
                if (event === "error") {
                  throw new Error("Failed to parse paper")
                }
                eventCount.other++
                continue
              }

              if (event === "status") {
                eventCount.status++
                if (eventCount.status <= 2 || data.message) {
                  console.log("[v0] SSE status", { eventCount: eventCount.status, message: data.message, detail: data.detail })
                }
                setLoadingStatus(data)
              } else if (event === "complete") {
                eventCount.complete++
                console.log("[v0] SSE complete received", {
                  eventCount: eventCount.complete,
                  hasPaper: !!data?.paper,
                  sectionsLength: data?.paper?.sections?.length,
                })

                  if (!data?.paper) {
                    console.error("[v0] Complete event has no paper data", { data })
                    throw new Error("Parse completed but no paper data received")
                  }

                  if (!Array.isArray(data.paper.sections)) {
                    console.error("[v0] Paper sections is not an array", {
                      sectionsType: typeof data.paper.sections,
                    })
                    throw new Error("Paper sections are not in the expected format")
                  }

                  const validPaper = data.paper
                  console.log("[v0] Setting paper state", {
                    title: validPaper.title,
                    sections: validPaper.sections.length,
                  })
                  setPaper(validPaper)
                  
                  // Cache the parsed paper using original upload data
                  await setCachedPaper(
                    validPaper,
                    uploadData.pdfBase64 || "",
                    uploadData.url || null,
                    selectedModel
                  ).catch((err) => {
                    console.error("[v0] Failed to cache paper:", err)
                  })
                  
                  toast.success("Paper analyzed successfully", {
                    description: `Found ${validPaper.sections.length} sections`,
                  })
                  receivedComplete = true
                  setIsLoading(false)
                  setLoadingStatus(null)
                  return
                } else if (event === "error") {
                  eventCount.error++
                  console.log("[v0] SSE error received", { eventCount: eventCount.error, fetchFailed: data.fetchFailed, error: data.error })
                  if (data.fetchFailed) {
                    setError(null)
                    setShowUploadHint(true)
                    toast.error("Could not download from this URL", {
                      description:
                        "This publisher blocks automated downloads. Please download the PDF in your browser and use the Upload button instead.",
                      duration: 8000,
                    })
                  } else {
                    throw new Error(data.error || "Failed to parse paper")
                  }
                  setIsLoading(false)
                  setLoadingStatus(null)
                  return
                } else {
                  eventCount.other++
                  console.warn("[v0] SSE unknown event type", { event, keys: data ? Object.keys(data).slice(0, 5) : [] })
                }
              }
            }
          }
        }

        // If stream ended without receiving a complete event, it likely timed out
        if (!receivedComplete) {
          console.error("[v0] Stream ended without complete — throwing timeout", { eventCount, receivedComplete })
          throw new Error(
            "Paper analysis timed out. The paper may be too large or complex. Try using a faster model like Claude Haiku 4.5, or try again later."
          )
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred"
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
    setIsModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    // Delay clearing the section so the close animation plays
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

  // Build section context text for deep dive
  const deepDiveSectionContext = useMemo(() => {
    if (!deepDiveSection) return ""
    return deepDiveSection.content
      .map((block) => {
        if (block.type === "math") return `$$${block.value}$$`
        return block.value
      })
      .join("\n\n")
  }, [deepDiveSection])

  const hasPaper = paper !== null

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Toaster position="top-right" />

      <PaperUploadBar onAnalyze={handleAnalyze} isLoading={isLoading} showUploadHint={showUploadHint} />

      <main className="flex-1 min-h-0">
        {isLoading ? (
          <PaperLoading status={loadingStatus || undefined} />
        ) : !hasPaper ? (
          <PaperEmptyState />
        ) : (
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={50} minSize={30}>
              <PdfViewer
                pdfData={pdfBase64}
                pdfUrl={pdfUrl}
                highlightedPage={highlightedPage}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={30}>
              <StructuredView
                paper={paper}
                hoveredSection={hoveredSection}
                onSectionHover={setHoveredSection}
                onSectionClick={handleSectionClick}
                onDeepDive={handleDeepDive}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>

      <ExplanationModal
        section={selectedSection}
        paperTitle={paper?.title || ""}
        paperAbstract={paper?.abstract || ""}
        allSections={paper?.sections || []}
        isOpen={isModalOpen}
        onClose={handleModalClose}
      />

      <DeepDiveModal
        latex={deepDiveLatex}
        sectionContext={deepDiveSectionContext}
        paperTitle={paper?.title || ""}
        isOpen={isDeepDiveOpen}
        onClose={handleDeepDiveClose}
      />

      {/* Error banner */}
      {error && !isLoading && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive font-medium">
            Analysis Error
          </p>
          <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
        </div>
      )}
    </div>
  )
}
