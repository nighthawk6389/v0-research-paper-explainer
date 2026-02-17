"use client"

import { useState, useCallback, useMemo } from "react"
import { PaperUploadBar } from "@/components/paper-upload-bar"
import { PdfViewer } from "@/components/pdf-viewer"
import { StructuredView } from "@/components/structured-view"
import { ExplanationModal } from "@/components/explanation-modal"
import { PaperLoading } from "@/components/paper-loading"
import { PaperEmptyState } from "@/components/paper-empty-state"
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

  // Compute highlighted page from hovered section
  const highlightedPage = useMemo(() => {
    if (!hoveredSection || !paper) return null
    const section = paper.sections.find((s) => s.id === hoveredSection)
    return section?.pageNumbers[0] ?? null
  }, [hoveredSection, paper])

  const handleAnalyze = useCallback(
    async (data: { pdfBase64?: string; url?: string; pdfBlob?: Blob }) => {
      setIsLoading(true)
      setError(null)
      setPaper(null)
      setShowUploadHint(false)

      // Store PDF data for the viewer
      if (data.pdfBase64) {
        setPdfBase64(data.pdfBase64)
        setPdfUrl(null)
      } else if (data.url) {
        setPdfBase64(null)
        setPdfUrl(data.url)
      }

      try {
        const response = await fetch("/api/parse-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64: data.pdfBase64,
            url: data.url,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          // If the server couldn't fetch the URL, show a helpful message
          if (result.fetchFailed) {
            setError(null)
            setShowUploadHint(true)
            toast.error("Could not download from this URL", {
              description:
                "This publisher blocks automated downloads. Please download the PDF in your browser and use the Upload button instead.",
              duration: 8000,
            })
          } else {
            throw new Error(result.error || "Failed to parse paper")
          }
          return
        }

        setPaper(result.paper)
        toast.success("Paper analyzed successfully", {
          description: `Found ${result.paper.sections.length} sections`,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An error occurred"
        setError(message)
        toast.error("Analysis failed", { description: message })
      } finally {
        setIsLoading(false)
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

  const hasPaper = paper !== null

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Toaster position="top-right" />

      <PaperUploadBar onAnalyze={handleAnalyze} isLoading={isLoading} showUploadHint={showUploadHint} />

      <main className="flex-1 min-h-0">
        {isLoading ? (
          <PaperLoading />
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
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </main>

      <ExplanationModal
        section={selectedSection}
        paperTitle={paper?.title || ""}
        isOpen={isModalOpen}
        onClose={handleModalClose}
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
