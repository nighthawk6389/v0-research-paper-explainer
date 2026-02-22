"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MarkdownContent } from "@/components/markdown-content"
import { MathBlock } from "@/components/math-block"
import { InlineFormulaExplain } from "@/components/inline-formula-explain"
import {
  Send,
  Loader2,
  CornerDownLeft,
  BookOpen,
  GraduationCap,
  FileText,
  MessageSquare,
  ArrowDown,
} from "lucide-react"
import { PersonaGoalSelector, type PersonaGoalValue } from "@/components/persona-goal-selector"
import type { Section } from "@/lib/paper-schema"
import type { DifficultyLevel } from "@/lib/prompts"
import { saveConversation } from "@/lib/storage/db"
import type { ConversationAnchor } from "@/lib/storage/types"

interface ExplanationModalProps {
  section: Section | null
  paperTitle: string
  paperAbstract: string
  allSections: Section[]
  isOpen: boolean
  onClose: () => void
  /** When set, conversations are persisted and initial state can be loaded */
  paperId?: string
  blockIds?: Record<string, string[]>
  initialConversationId?: string
  initialMessages?: Array<{ role: "user" | "assistant"; content: string }>
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

function renderTextWithInlineMath(text: string) {
  const parts = text.split(/(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <MathBlock key={i} latex={part} displayMode={false} />
    }
    return <span key={i}>{part}</span>
  })
}

function toUIMessage(m: { role: "user" | "assistant"; content: string }, i: number) {
  return { id: `msg-${i}`, role: m.role, parts: [{ type: "text" as const, text: m.content }] }
}

export function ExplanationModal({
  section,
  paperTitle,
  paperAbstract,
  allSections,
  isOpen,
  onClose,
  paperId,
  blockIds,
  initialConversationId,
  initialMessages,
}: ExplanationModalProps) {
  const [input, setInput] = useState("")
  const [difficultyLevel, setDifficultyLevel] =
    useState<DifficultyLevel>("advanced")
  const [personaGoal, setPersonaGoal] = useState<PersonaGoalValue>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasInitiatedRef = useRef(false)
  const currentSectionIdRef = useRef<string | null>(null)
  const currentDifficultyRef = useRef<DifficultyLevel>("advanced")
  const lastSavedCountRef = useRef(0)
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)

  const sectionContentText = section ? buildSectionContentText(section) : ""

  console.log("[v0] ExplanationModal rendered", {
    hasSection: !!section,
    sectionId: section?.id,
    sectionHeading: section?.heading,
    contentLength: sectionContentText.length,
    allSectionsCount: allSections?.length,
  })

  const previousSectionsContext = useMemo(() => {
    if (!section) return ""
    const sectionIndex = allSections?.findIndex((s) => s.id === section.id) ?? -1
    console.log("[v0] Computing previous sections context", {
      sectionIndex,
      allSectionsLength: allSections?.length,
    })
    if (sectionIndex <= 0) return ""
    const prevSections = allSections.slice(
      Math.max(0, sectionIndex - 3),
      sectionIndex
    )
    return prevSections
      .map((s) => `## ${s.heading}\n${buildSectionContentText(s)}`)
      .join("\n\n")
  }, [section, allSections])

  const stableId = useMemo(() => {
    return `explain-${section?.id || "default"}`
  }, [section?.id])

  const chatId = initialConversationId ?? stableId

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/explain",
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            messages,
            paperTitle,
            paperAbstract,
            sectionHeading: section?.heading || "",
            sectionContent: sectionContentText,
            previousSectionsContext,
            difficultyLevel,
            persona: personaGoal.persona,
            goal: personaGoal.goal,
            tone: personaGoal.tone,
          },
        }),
      }),
    [
      paperTitle,
      paperAbstract,
      section?.heading,
      sectionContentText,
      previousSectionsContext,
      difficultyLevel,
      personaGoal.persona,
      personaGoal.goal,
      personaGoal.tone,
    ]
  )

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    transport,
  })

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (isOpen && section && section.id !== currentSectionIdRef.current) {
      currentSectionIdRef.current = section.id
      hasInitiatedRef.current = false
      lastSavedCountRef.current = 0
      if (!initialMessages?.length) setMessages([])
      setExpandedFormula(null)
    }
  }, [isOpen, section, setMessages, initialMessages?.length])

  useEffect(() => {
    if (isOpen && section && initialMessages?.length && currentSectionIdRef.current === section.id) {
      setMessages(initialMessages.map(toUIMessage))
      hasInitiatedRef.current = true
    }
  }, [isOpen, section?.id, initialMessages, setMessages])

  useEffect(() => {
    if (
      isOpen &&
      section &&
      !hasInitiatedRef.current &&
      messages.length === 0 &&
      currentSectionIdRef.current === section.id &&
      !initialMessages?.length
    ) {
      hasInitiatedRef.current = true
      currentDifficultyRef.current = difficultyLevel
      sendMessage({
        text: `Please explain this section to me. Break it down so someone with college-level math can understand it.`,
      })
    }
  }, [isOpen, section, messages.length, sendMessage, difficultyLevel, initialMessages?.length])

  useEffect(() => {
    if (
      isOpen &&
      section &&
      hasInitiatedRef.current &&
      difficultyLevel !== currentDifficultyRef.current
    ) {
      currentDifficultyRef.current = difficultyLevel
      setMessages([])
      hasInitiatedRef.current = false
    }
  }, [difficultyLevel, isOpen, section, setMessages])

  const getMessageText = useCallback((message: (typeof messages)[0]): string => {
    if (!message.parts || !Array.isArray(message.parts)) return ""
    return message.parts
      .filter(
        (p): p is { type: "text"; text: string } => p.type === "text"
      )
      .map((p) => p.text)
      .join("")
  }, [messages])

  useEffect(() => {
    if (
      !paperId ||
      !section ||
      status === "streaming" ||
      status === "submitted" ||
      messages.length === 0
    )
      return
    if (messages.length <= lastSavedCountRef.current) return
    lastSavedCountRef.current = messages.length
    const anchor: ConversationAnchor = {
      type: "section",
      sectionId: section.id,
      pageNumbers: section.pageNumbers,
    }
    const conversation = {
      conversationId: chatId,
      paperId,
      anchor,
      difficulty: difficultyLevel,
      persona: personaGoal.persona || personaGoal.goal || personaGoal.tone
        ? { persona: personaGoal.persona, goal: personaGoal.goal, tone: personaGoal.tone }
        : undefined,
      title: section.heading,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: getMessageText(m),
        createdAt: Date.now(),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    saveConversation(conversation).catch((e) =>
      console.warn("[ExplanationModal] Failed to save conversation:", e)
    )
  }, [paperId, section, chatId, difficultyLevel, personaGoal, messages, status, getMessageText])

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
    currentSectionIdRef.current = null
    hasInitiatedRef.current = false
    setExpandedFormula(null)
    onClose()
  }, [onClose])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[98vw] w-full h-[92vh] flex flex-col p-0 gap-0">
        <DialogTitle className="sr-only">
          {section?.heading || "Section Explanation"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          AI-generated explanation of the {section?.heading || "section"} from the research paper
        </DialogDescription>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="size-4 text-muted-foreground shrink-0" />
              <h2 className="text-sm font-semibold leading-tight truncate">
                {section?.heading || "Section"}
              </h2>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-3.5 text-muted-foreground" />
                <Select
                  value={difficultyLevel}
                  onValueChange={(v) =>
                    setDifficultyLevel(v as DifficultyLevel)
                  }
                  disabled={isStreaming}
                >
                  <SelectTrigger className="h-7 text-xs w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="phd">PhD Level</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <PersonaGoalSelector
            value={personaGoal}
            onChange={setPersonaGoal}
            disabled={isStreaming}
          />
        </div>

        {/* Split layout: Left = section text, Right = explanation */}
        <div className="flex-1 min-h-0 flex">
          {/* Left panel: Original section text */}
          <div className="w-[45%] border-r flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Original Section Text
                </span>
                {section && (
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">
                    p.{section.pageNumbers.join("-")}
                  </span>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-3">
                {section?.content?.map((block, idx) => {
                  if (block.type === "math") {
                    const isExpanded = expandedFormula === `${section.id}-${idx}`
                    return (
                      <div key={idx}>
                        <MathBlock
                          latex={block.value}
                          displayMode={!block.isInline}
                          label={block.label}
                          className="text-sm"
                          deepDiveLabel="Explain"
                          onDeepDive={
                            !block.isInline
                              ? () => {
                                  setExpandedFormula(
                                    isExpanded
                                      ? null
                                      : `${section.id}-${idx}`
                                  )
                                }
                              : undefined
                          }
                        />
                        {isExpanded && (
                          <InlineFormulaExplain
                            latex={block.value}
                            paperTitle={paperTitle}
                            sectionContext={sectionContentText}
                            onClose={() => setExpandedFormula(null)}
                          />
                        )}
                      </div>
                    )
                  }
                  return (
                    <p
                      key={idx}
                      className="text-[13px] leading-relaxed text-foreground/80"
                    >
                      {renderTextWithInlineMath(block.value)}
                    </p>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right panel: AI explanation chat */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  AI Explanation
                </span>
              </div>
            </div>

            {/* Chat messages */}
            <div
              className="flex-1 min-h-0 overflow-hidden relative"
              ref={scrollRef}
            >
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
                <div className="px-5 py-4 space-y-4">
                  {messages.map((message, idx) => {
                    const text = getMessageText(message)
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
              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2"
              >
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
