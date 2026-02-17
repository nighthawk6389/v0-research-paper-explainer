"use client"

import { useCallback } from "react"
import { MathBlock } from "@/components/math-block"
import { Lightbulb } from "lucide-react"
import type { Section } from "@/lib/paper-schema"

interface SectionBlockProps {
  section: Section
  isHovered: boolean
  onHover: (sectionId: string | null) => void
  onClick: (section: Section) => void
}

function renderTextWithInlineMath(text: string) {
  // Split on $...$ for inline math but not $$...$$
  const parts = text.split(/(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Odd indices are math content
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
  const handleClick = useCallback(() => {
    onClick(section)
  }, [section, onClick])

  const handleMouseEnter = useCallback(() => {
    onHover(section.id)
  }, [section.id, onHover])

  const handleMouseLeave = useCallback(() => {
    onHover(null)
  }, [onHover])

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group relative rounded-lg border p-4 transition-all cursor-pointer ${
        isHovered
          ? "border-foreground/30 bg-accent/50 shadow-sm"
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
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm text-foreground leading-tight">
          {section.heading}
        </h3>
        <div
          className={`shrink-0 flex items-center gap-1 text-xs transition-opacity ${
            isHovered ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Lightbulb className="size-3.5" />
          <span className="text-muted-foreground">Explain</span>
        </div>
      </div>

      <div className="space-y-2 text-sm leading-relaxed text-foreground/80">
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
            <p key={idx} className="text-pretty">
              {renderTextWithInlineMath(block.value)}
            </p>
          )
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {section.type === "math" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            Math
          </span>
        )}
        {section.type === "mixed" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Mixed
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">
          {section.pageNumbers.length === 1
            ? `p. ${section.pageNumbers[0]}`
            : `pp. ${section.pageNumbers[0]}-${section.pageNumbers[section.pageNumbers.length - 1]}`}
        </span>
      </div>
    </div>
  )
}
