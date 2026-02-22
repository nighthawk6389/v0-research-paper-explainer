"use client"

import { useState, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import type { Artifact } from "@/lib/storage/types"
import { FileText, Presentation, Layers, Download, Loader2 } from "lucide-react"

interface ArtifactViewerModalProps {
  artifact: Artifact | null
  onClose: () => void
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-4 mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-sm">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-3 text-sm">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-")
    return isBlock ? (
      <code className="block bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto my-3 whitespace-pre">
        {children}
      </code>
    ) : (
      <code className="bg-muted rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    )
  },
  hr: () => <hr className="my-4 border-border" />,
}

function SummaryView({ markdown }: { markdown: string }) {
  return (
    <div className="pb-4">
      <ReactMarkdown components={markdownComponents}>{markdown}</ReactMarkdown>
    </div>
  )
}

function SlidesView({
  title,
  slides,
}: {
  title: string
  slides: Array<{ title: string; bullets: string[]; speakerNotes?: string }>
}) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadPptx = useCallback(async () => {
    setIsDownloading(true)
    try {
      const { generatePptx } = await import("@/lib/generate-pptx")
      await generatePptx(title, slides)
    } catch (err) {
      console.error("PPTX generation failed:", err)
    } finally {
      setIsDownloading(false)
    }
  }, [title, slides])

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownloadPptx}
          disabled={isDownloading}
          className="shrink-0 gap-1.5"
        >
          {isDownloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          {isDownloading ? "Generating…" : "Download PPTX"}
        </Button>
      </div>
      {slides.map((slide, i) => (
        <div key={i} className="border rounded-lg p-5 space-y-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Slide {i + 1}
            </span>
          </div>
          <p className="font-semibold text-base">{slide.title}</p>
          {slide.bullets.length > 0 && (
            <ul className="list-disc list-outside pl-5 space-y-1.5">
              {slide.bullets.map((b, j) => (
                <li key={j} className="text-sm leading-relaxed">{b}</li>
              ))}
            </ul>
          )}
          {slide.speakerNotes && (
            <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
              🗒 {slide.speakerNotes}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function FlashcardsView({
  cards,
}: {
  cards: Array<{
    front: string
    back: string
    tags?: string[]
    difficulty?: string
  }>
}) {
  const difficultyColor = (d?: string) => {
    if (d === "easy") return "text-green-600 dark:text-green-400"
    if (d === "hard") return "text-red-600 dark:text-red-400"
    return "text-yellow-600 dark:text-yellow-400"
  }

  return (
    <div className="space-y-3 pb-4">
      {cards.map((card, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Question {i + 1}
            </span>
            <p className="font-medium text-sm mt-1">{card.front}</p>
          </div>
          <div className="px-4 py-3">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Answer
            </span>
            <p className="text-sm mt-1 leading-relaxed">{card.back}</p>
          </div>
          {((card.tags?.length ?? 0) > 0 || card.difficulty) && (
            <div className="px-4 pb-2 flex items-center gap-2">
              {card.tags?.map((t) => (
                <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {t}
                </span>
              ))}
              {card.difficulty && (
                <span className={`text-[10px] font-medium ${difficultyColor(card.difficulty)}`}>
                  {card.difficulty}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function ArtifactViewerModal({ artifact, onClose }: ArtifactViewerModalProps) {
  if (!artifact) return null

  const title =
    artifact.artifactType === "summary"
      ? "Summary"
      : artifact.artifactType === "slides"
        ? "Slides"
        : "Flashcards"
  const Icon =
    artifact.artifactType === "summary"
      ? FileText
      : artifact.artifactType === "slides"
        ? Presentation
        : Layers

  return (
    <Dialog open={!!artifact} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] !max-w-5xl h-[90vh] !flex !flex-col !gap-0 !p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4 shrink-0" />
            {title}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {new Date(artifact.createdAt).toLocaleString()}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {artifact.content.type === "summary" && (
            <SummaryView markdown={artifact.content.markdown} />
          )}
          {artifact.content.type === "slides" && (
            <SlidesView
              title={artifact.content.title}
              slides={artifact.content.slides}
            />
          )}
          {artifact.content.type === "flashcards" && (
            <FlashcardsView cards={artifact.content.cards} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
