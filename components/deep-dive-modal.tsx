"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { MarkdownContent } from "@/components/markdown-content"
import { MathBlock } from "@/components/math-block"
import {
  Send,
  Loader2,
  CornerDownLeft,
  Sigma,
  ExternalLink,
  ImageIcon,
} from "lucide-react"

interface DeepDiveModalProps {
  latex: string | null
  sectionContext: string
  paperTitle: string
  isOpen: boolean
  onClose: () => void
}

export function DeepDiveModal({
  latex,
  sectionContext,
  paperTitle,
  isOpen,
  onClose,
}: DeepDiveModalProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasInitiatedRef = useRef(false)
  const currentLatexRef = useRef<string | null>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/deep-dive",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            latex: latex || "",
            sectionContext,
            paperTitle,
          },
        }),
      }),
    [latex, sectionContext, paperTitle]
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `deep-dive-${latex?.slice(0, 30) || "none"}`,
    transport,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  // Reset when latex changes
  useEffect(() => {
    if (isOpen && latex && latex !== currentLatexRef.current) {
      currentLatexRef.current = latex
      hasInitiatedRef.current = false
      setMessages([])
    }
  }, [isOpen, latex, setMessages])

  // Auto-send initial analysis request
  useEffect(() => {
    if (
      isOpen &&
      latex &&
      !hasInitiatedRef.current &&
      messages.length === 0 &&
      currentLatexRef.current === latex
    ) {
      hasInitiatedRef.current = true
      sendMessage({
        text: "Analyze this equation. Use Wolfram Alpha to show step-by-step derivations, simplifications, plots, and concrete examples where helpful.",
      })
    }
  }, [isOpen, latex, messages.length, sendMessage])

  // Auto-scroll
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    )
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() || isStreaming) return
      sendMessage({ text: input })
      setInput("")
    },
    [input, isStreaming, sendMessage]
  )

  const handleClose = useCallback(() => {
    currentLatexRef.current = null
    hasInitiatedRef.current = false
    onClose()
  }, [onClose])

  function getMessageText(message: (typeof messages)[0]): string {
    if (!message.parts || !Array.isArray(message.parts)) return ""
    return message.parts
      .filter(
        (p): p is { type: "text"; text: string } => p.type === "text"
      )
      .map((p) => p.text)
      .join("")
  }

  // Extract tool call info from messages for display
  function getToolCalls(message: (typeof messages)[0]) {
    if (!message.parts || !Array.isArray(message.parts)) return []
    return message.parts.filter(
      (p): p is Extract<(typeof message.parts)[0], { type: "tool-invocation" }> =>
        p.type === "tool-invocation"
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Sigma className="size-4 text-orange-500 shrink-0" />
            <DialogTitle className="text-sm">
              Deep Dive with Wolfram Alpha
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            AI-powered mathematical analysis with Wolfram Alpha computations
          </DialogDescription>
          {/* Show the equation being analyzed */}
          {latex && (
            <div className="mt-2">
              <MathBlock latex={latex} displayMode={true} className="text-sm" />
            </div>
          )}
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-hidden" ref={scrollRef}>
          <ScrollArea className="h-full">
            <div className="px-5 py-4 space-y-4">
              {messages.map((message, idx) => {
                const text = getMessageText(message)
                const toolCalls = getToolCalls(message)

                // Skip the first user message (auto-generated)
                if (message.role === "user" && idx === 0) return null

                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm max-w-[85%]">
                        {text}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={message.id} className="space-y-3">
                    {/* Tool invocations */}
                    {toolCalls.map((tc) => (
                      <div
                        key={tc.toolInvocationId}
                        className="border rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/50 dark:border-orange-800/30"
                      >
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-orange-200/30 dark:border-orange-800/20">
                          <ExternalLink className="size-3 text-orange-600" />
                          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                            Wolfram Alpha Query
                          </span>
                          {tc.state === "output-available" ? (
                            <Badge
                              variant="secondary"
                              className="text-[9px] ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            >
                              Complete
                            </Badge>
                          ) : (
                            <Loader2 className="size-3 animate-spin text-orange-500 ml-auto" />
                          )}
                        </div>
                        <div className="px-3 py-2">
                          {"input" in tc && tc.input && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Query: </span>
                                <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                                  {(tc.input as { query?: string })?.query}
                                </code>
                              </p>
                              {(tc.input as { purpose?: string })?.purpose && (
                                <p className="text-[11px] text-muted-foreground italic">
                                  {(tc.input as { purpose?: string })?.purpose}
                                </p>
                              )}
                            </div>
                          )}
                          {tc.state === "output-available" && tc.output && (
                            <div className="mt-2">
                              {/* Show images from Wolfram Alpha */}
                              {(tc.output as any)?.images?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {(
                                    tc.output as {
                                      images: {
                                        title: string
                                        src: string
                                        alt: string
                                      }[]
                                    }
                                  ).images
                                    .slice(0, 4)
                                    .map(
                                      (
                                        img: {
                                          title: string
                                          src: string
                                          alt: string
                                        },
                                        i: number
                                      ) => (
                                        <div
                                          key={i}
                                          className="bg-white rounded border p-1"
                                        >
                                          <img
                                            src={img.src}
                                            alt={img.alt}
                                            className="max-h-24"
                                            crossOrigin="anonymous"
                                          />
                                        </div>
                                      )
                                    )}
                                </div>
                              )}
                              {(tc.output as any)?.error && (
                                <p className="text-xs text-destructive">
                                  {(tc.output as any).error}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Text content */}
                    {text && <MarkdownContent content={text} />}
                  </div>
                )
              })}

              {isStreaming && messages.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>
                    Preparing deep dive analysis...
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat input */}
        <div className="border-t p-4 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this equation, request a derivation, plot..."
              disabled={isStreaming}
              className="flex-1 h-9"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="shrink-0 size-9"
            >
              {isStreaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
            <CornerDownLeft className="size-3" />
            <span>
              Try: "derive this step by step", "plot this function",
              "what happens when x approaches 0"
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
