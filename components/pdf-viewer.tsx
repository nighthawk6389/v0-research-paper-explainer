"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PdfViewerProps {
  pdfData: string | null // base64
  pdfUrl: string | null
  highlightedPage: number | null
}

export function PdfViewer({ pdfData, pdfUrl, highlightedPage }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState(1.0)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const file = pdfData
    ? `data:application/pdf;base64,${pdfData}`
    : pdfUrl || null

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
    },
    []
  )

  // Scroll to highlighted page
  useEffect(() => {
    if (highlightedPage && pageRefs.current[highlightedPage]) {
      pageRefs.current[highlightedPage]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }, [highlightedPage])

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="text-4xl opacity-30">PDF</div>
          <p className="text-sm">Upload a paper to view it here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
        <span className="text-xs text-muted-foreground">
          {numPages > 0 ? `${numPages} pages` : "Loading..."}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            disabled={scale <= 0.5}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
            disabled={scale >= 2.0}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const container = containerRef.current?.querySelector(
                "[data-slot='scroll-area-viewport']"
              )
              if (container) container.scrollBy({ top: -300, behavior: "smooth" })
            }}
            aria-label="Scroll up"
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              const container = containerRef.current?.querySelector(
                "[data-slot='scroll-area-viewport']"
              )
              if (container) container.scrollBy({ top: 300, behavior: "smooth" })
            }}
            aria-label="Scroll down"
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-hidden" ref={containerRef}>
      <ScrollArea className="h-full">
        <div className="p-4 flex flex-col items-center gap-4">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="space-y-4 w-full max-w-lg">
                <Skeleton className="h-96 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            }
            error={
              <div className="text-sm text-destructive p-4">
                Failed to load PDF. Make sure the URL points directly to a PDF
                file.
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <div
                  key={pageNum}
                  ref={(el) => {
                    pageRefs.current[pageNum] = el
                  }}
                  className={`mb-4 shadow-sm rounded transition-all ${
                    highlightedPage === pageNum
                      ? "ring-2 ring-foreground/20 ring-offset-2"
                      : ""
                  }`}
                >
                  <Page
                    pageNumber={pageNum}
                    scale={scale}
                    loading={<Skeleton className="h-96 w-[500px]" />}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </div>
              )
            )}
          </Document>
        </div>
      </ScrollArea>
      </div>
    </div>
  )
}
