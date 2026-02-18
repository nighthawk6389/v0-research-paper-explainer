"use client"

import { useEffect, useRef, useMemo, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { MarkdownContent } from "@/components/markdown-content"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, X, Sigma } from "lucide-react"
import { Button } from "@/components/ui/button"

interface InlineFormulaExplainProps {
  latex: string
  paperTitle: string
  sectionContext: string
  onClose: () => void
}

export function InlineFormulaExplain({
  latex,
  paperTitle,
  sectionContext,
  onClose,
}: InlineFormulaExplainProps) {
  const hasInitiatedRef = useRef(false)

  const stableId = useMemo(() => {
    const hash = latex.substring(0, 50).replace(/[^a-zA-Z0-9]/g, "")
    return `formula-explain-${hash}`
  }, [latex])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/formula-explain",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            latex,
            paperTitle,
            sectionContext,
          },
        }),
      }),
    [latex, paperTitle, sectionContext]
  )

  const { messages, sendMessage, status } = useChat({
    id: stableId,
    transport,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (!hasInitiatedRef.current && messages.length === 0) {
      hasInitiatedRef.current = true
      sendMessage({
        text: "Briefly explain what each symbol and term means in this equation, and what the equation computes.",
      })
    }
  }, [messages.length, sendMessage])

  const getMessageText = useCallback(
    (message: (typeof messages)[0]): string => {
      if (!message.parts || !Array.isArray(message.parts)) return ""
      return message.parts
        .filter(
          (p): p is { type: "text"; text: string } => p.type === "text"
        )
        .map((p) => p.text)
        .join("")
    },
    []
  )

  const assistantMessage = messages.find((m) => m.role === "assistant")
  const text = assistantMessage ? getMessageText(assistantMessage) : ""

  return (
    <div className="mt-2 mb-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-100/50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-1.5">
          <Sigma className="size-3 text-blue-600 dark:text-blue-400" />
          <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
            Quick Formula Breakdown
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 text-blue-600 dark:text-blue-400 hover:bg-blue-200/50 dark:hover:bg-blue-800/50"
          onClick={onClose}
        >
          <X className="size-3" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        <div className="px-3 py-2.5">
          {isStreaming && !text && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="size-3 animate-spin" />
              <span>Breaking down formula...</span>
            </div>
          )}
          {text && (
            <div className="text-xs">
              <MarkdownContent content={text} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
