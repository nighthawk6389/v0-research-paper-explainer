"use client"

import { useState, useCallback } from "react"
import { MathBlock } from "@/components/math-block"
import { Lightbulb, ChevronRight } from "lucide-react"
import type { Section } from "@/lib/paper-schema"

interface SectionBlockProps {
  section: Section
  isHovered: boolean
  onHover: (sectionId: string | null) => void
  onClick: (section: Section) => void
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

export function SectionBlock({
  section,
  isHovered,
  onHover,
  onClick,
}: SectionBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = useCallback(() => {
    onClick(section)
  }, [section, onClick])

  const handleMouseEnter = useCallback(() => {
    onHover(section.id)
  }, [section.id, onHover])

  const handleMouseLeave = useCallback(() => {
    onHover(null)
  }, [onHover])

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded((prev) => !prev)
  }, [])

  // Get a short preview: first text block, truncated
  const previewText = section.content.find((b) => b.type === "text")?.value || ""
  const hasMath = section.content.some((b) => b.type === "math")
  const truncatedPreview =
    previewText.length > 120 ? previewText.slice(0, 120) + "..." : previewText

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative rounded-lg border transition-all cursor-pointer ${
        isHovered
          ? "border-blue-400/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
          : "border-transparent hover:border-border hover:bg-accent/30"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Compact header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={toggleExpand}
          className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors"
          aria-label={isExpanded ? "Collapse section" : "Expand section"}
        >
          <ChevronRight
            className={`size-3.5 text-muted-foreground transition-transform duration-150 ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </button>
        <h3 className="font-medium text-[13px] text-foreground leading-tight flex-1 min-w-0 truncate">
          {section.heading}
        </h3>
        <div className="shrink-0 flex items-center gap-1.5">
          {hasMath && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              Math
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            p.{section.pageNumbers[0]}
          </span>
          <div
            className={`flex items-center gap-0.5 text-xs transition-opacity ${
              isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Lightbulb className="size-3" />
          </div>
        </div>
      </div>

      {/* Preview line (collapsed) */}
      {!isExpanded && truncatedPreview && (
        <div className="px-3 pb-2 pl-8">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {truncatedPreview}
          </p>
        </div>
      )}

      {/* Full content (expanded) */}
      {isExpanded && (
        <div className="px-3 pb-3 pl-8 space-y-2 text-sm leading-relaxed text-foreground/80">
          {section.content.map((block, idx) => {
            if (block.type === "math") {
              return (
                <MathBlock
                  key={idx}
                  latex={block.value}
                  displayMode={!block.isInline}
                  label={block.label}
                />
              )
            }
            return (
              <p key={idx} className="text-pretty text-xs">
                {renderTextWithInlineMath(block.value)}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}
