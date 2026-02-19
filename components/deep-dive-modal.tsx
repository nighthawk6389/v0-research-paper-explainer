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
  ChevronRight,
  ArrowDown,
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
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

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

  // Use a stable ID based on latex hash
  const stableId = useMemo(() => {
    const hash = latex ? latex.substring(0, 50).replace(/[^a-zA-Z0-9]/g, "") : "empty"
    return `deep-dive-${hash}`
  }, [latex])

  const { messages, sendMessage, status, setMessages } = useChat({
    id: stableId,
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

  // Detect when user manually scrolls up
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null
    
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const isAtBottom = distanceFromBottom < 50 // 50px threshold
      
      setIsUserScrolledUp(!isAtBottom)
      setShowScrollButton(!isAtBottom && isStreaming)
    }

    viewport.addEventListener("scroll", handleScroll)
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [isStreaming])

  // Auto-scroll only if user hasn't scrolled up
  useEffect(() => {
    if (isUserScrolledUp) return
    
    const viewport = scrollRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null
    
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages, isUserScrolledUp])

  const scrollToBottom = useCallback(() => {
    const viewport = scrollRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']"
    ) as HTMLElement | null
    
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
      setIsUserScrolledUp(false)
      setShowScrollButton(false)
    }
  }, [])

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
      <DialogContent className="max-w-[90vw] w-full h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Sigma className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Deep Dive Analysis
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Mathematical analysis powered by Wolfram Alpha
              </DialogDescription>
            </div>
          </div>
          {/* Show the equation being analyzed */}
          {latex && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-lg border shadow-sm">
              <MathBlock latex={latex} displayMode={true} />
            </div>
          )}
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-hidden relative" ref={scrollRef}>
          {/* Scroll to bottom button */}
          {showScrollButton && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
              <Button
                size="sm"
                onClick={scrollToBottom}
                className="shadow-lg h-8 px-3 gap-1.5"
              >
                <ArrowDown className="size-3" />
                <span className="text-xs">New messages</span>
              </Button>
            </div>
          )}
          <ScrollArea className="h-full">
            <div className="px-6 py-4 space-y-5">
              {messages.map((message, idx) => {
                const text = getMessageText(message)
                const toolCalls = getToolCalls(message)

                // Skip the first user message (auto-generated)
                if (message.role === "user" && idx === 0) return null

                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm max-w-[80%] shadow-sm">
                        {text}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={message.id} className="space-y-4">
                    {/* Wolfram Alpha Pods */}
                    {toolCalls.map((tc, tcIdx) => {
                      const input = ("input" in tc && tc.input) as {
                        query?: string
                        purpose?: string
                      }
                      const output = tc.state === "output-available" ? (tc.output as any) : null

                      return (
                        <div
                          key={tc.toolInvocationId}
                          className="wolfram-pod border rounded-xl overflow-hidden bg-gradient-to-br from-white to-orange-50/30 dark:from-gray-900 dark:to-orange-950/10 shadow-md"
                        >
                          {/* Pod Header */}
                          <div className="px-4 py-3 border-b bg-orange-500/5 dark:bg-orange-500/10">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="p-1 rounded bg-orange-500/10">
                                  <Sigma className="size-3.5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-orange-900 dark:text-orange-100">
                                      Wolfram Alpha Query {tcIdx + 1}
                                    </span>
                                    {tc.state === "output-available" ? (
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                      >
                                        Complete
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                      >
                                        <Loader2 className="size-2.5 animate-spin mr-1" />
                                        Computing
                                      </Badge>
                                    )}
                                  </div>
                                  {input?.purpose && (
                                    <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">
                                      {input.purpose}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {input?.query && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <ChevronRight className="size-3 text-muted-foreground" />
                                <code className="text-[11px] bg-white dark:bg-gray-800 px-2 py-0.5 rounded border font-mono text-orange-700 dark:text-orange-300">
                                  {input.query}
                                </code>
                              </div>
                            )}
                          </div>

                          {/* Pod Content */}
                          {tc.state === "output-available" && output && (
                            <div className="p-4">
                              {output.error ? (
                                <p className="text-xs text-destructive italic">
                                  {output.error}
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {/* Show images in a grid */}
                                  {output.images && output.images.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {output.images.map((img, imgIdx) => (
                                        <div
                                          key={imgIdx}
                                          className="flex flex-col gap-1.5"
                                        >
                                          {img.title && (
                                            <div className="text-[11px] font-medium text-muted-foreground px-1">
                                              {img.title}
                                            </div>
                                          )}
                                          <div className="bg-white dark:bg-gray-800 rounded-lg border p-2 flex items-center justify-center">
                                            <img
                                              src={img.src}
                                              alt={img.alt}
                                              className="max-w-full h-auto"
                                              crossOrigin="anonymous"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Show pods if available */}
                                  {output.pods && output.pods.length > 0 && (
                                    <div className="space-y-2">
                                      {output.pods.slice(0, 6).map((pod: any, podIdx: number) => (
                                        <div
                                          key={podIdx}
                                          className="border rounded-lg p-3 bg-white/50 dark:bg-gray-800/50"
                                        >
                                          <div className="text-[11px] font-semibold text-foreground mb-1.5">
                                            {pod.title}
                                          </div>
                                          {pod.subpods && pod.subpods.map((subpod: any, subIdx: number) => (
                                            <div key={subIdx} className="space-y-2">
                                              {subpod.plaintext && (
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                  {subpod.plaintext}
                                                </p>
                                              )}
                                              {subpod.img && (
                                                <div className="bg-white dark:bg-gray-900 rounded border p-2 flex items-center justify-center">
                                                  <img
                                                    src={subpod.img.src}
                                                    alt={subpod.img.alt || pod.title}
                                                    className="max-w-full h-auto"
                                                    crossOrigin="anonymous"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {tc.state === "input-streaming" ||
                            (tc.state === "input-available" && (
                              <div className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="size-3 animate-spin" />
                                <span>Waiting for computation...</span>
                              </div>
                            ))}
                        </div>
                      )
                    })}

                    {/* AI Commentary */}
                    {text && (
                      <div className="text-sm leading-relaxed text-foreground/90 space-y-2">
                        <MarkdownContent content={text} />
                      </div>
                    )}
                  </div>
                )
              })}

              {isStreaming && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20 mb-3">
                    <Loader2 className="size-6 animate-spin text-orange-600 dark:text-orange-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Preparing deep dive analysis...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Consulting with Wolfram Alpha
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat input */}
        <div className="border-t p-4 shrink-0 bg-muted/20">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this equation, request a derivation, plot..."
              disabled={isStreaming}
              className="flex-1 h-9 text-sm"
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
          <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
            <CornerDownLeft className="size-3" />
            <span>
              Try: "derive this step by step", "plot this function", "what
              happens when x approaches 0"
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
