"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownContent } from "@/components/markdown-content"
import { MathBlock } from "@/components/math-block"
import { Send, Loader2, CornerDownLeft, BookOpen } from "lucide-react"
import type { Section } from "@/lib/paper-schema"

interface ExplanationModalProps {
  section: Section | null
  paperTitle: string
  isOpen: boolean
  onClose: () => void
}

function buildSectionContentText(section: Section): string {
  return section.content
    .map((block) => {
      if (block.type === "math") {
        return `$$${block.value}$$${block.label ? ` ${block.label}` : ""}`
      }
      return block.value
    })
    .join("\n\n")
}

export function ExplanationModal({
  section,
  paperTitle,
  isOpen,
  onClose,
}: ExplanationModalProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasInitiatedRef = useRef(false)
  const currentSectionIdRef = useRef<string | null>(null)

  const sectionContentText = section ? buildSectionContentText(section) : ""

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/explain",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            paperTitle,
            sectionHeading: section?.heading || "",
            sectionContent: sectionContentText,
          },
        }),
      }),
    [paperTitle, section?.heading, sectionContentText]
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: section?.id || "default",
    transport,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  // Auto-send initial "explain" message when a new section is opened
  useEffect(() => {
    if (
      isOpen &&
      section &&
      section.id !== currentSectionIdRef.current
    ) {
      currentSectionIdRef.current = section.id
      hasInitiatedRef.current = false
      setMessages([])
    }
  }, [isOpen, section, setMessages])

  useEffect(() => {
    if (
      isOpen &&
      section &&
      !hasInitiatedRef.current &&
      messages.length === 0 &&
      currentSectionIdRef.current === section.id
    ) {
      hasInitiatedRef.current = true
      sendMessage({
        text: `Please explain this section to me. Break it down so someone with college-level math can understand it.`,
      })
    }
  }, [isOpen, section, messages.length, sendMessage])

  // Auto-scroll to bottom on new messages
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
    currentSectionIdRef.current = null
    hasInitiatedRef.current = false
    onClose()
  }, [onClose])

  function getMessageText(
    message: (typeof messages)[0]
  ): string {
    if (!message.parts || !Array.isArray(message.parts)) return ""
    return message.parts
      .filter(
        (p): p is { type: "text"; text: string } => p.type === "text"
      )
      .map((p) => p.text)
      .join("")
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground shrink-0" />
            <SheetTitle className="text-sm leading-tight truncate">
              {section?.heading || "Section"}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            Ask follow-up questions to deepen your understanding
          </SheetDescription>
        </SheetHeader>

        {/* Section preview */}
        {section && (
          <div className="px-5 py-3 border-b bg-muted/20 shrink-0">
            <details className="group">
              <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                View original section content
              </summary>
              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                {section.content.slice(0, 3).map((block, i) => {
                  if (block.type === "math") {
                    return (
                      <MathBlock
                        key={i}
                        latex={block.value}
                        displayMode={!block.isInline}
                        label={block.label}
                        className="text-xs"
                      />
                    )
                  }
                  return (
                    <p key={i} className="line-clamp-3">
                      {block.value}
                    </p>
                  )
                })}
                {section.content.length > 3 && (
                  <p className="text-muted-foreground/60 italic">
                    ...and {section.content.length - 3} more blocks
                  </p>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 min-h-0 overflow-hidden" ref={scrollRef}>
        <ScrollArea className="h-full">
          <div className="px-5 py-4 space-y-4">
            {messages.map((message, idx) => {
              const text = getMessageText(message)
              // Skip the first user message (auto-generated prompt)
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
                <div key={message.id}>
                  <MarkdownContent content={text} />
                </div>
              )
            })}

            {isStreaming && messages.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Analyzing section...</span>
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
              placeholder="Ask a follow-up question..."
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
              <span className="sr-only">Send message</span>
            </Button>
          </form>
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
            <CornerDownLeft className="size-3" />
            <span>Press Enter to send</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
