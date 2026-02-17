"use client"

import { useCallback, useRef } from "react"
import { SectionBlock } from "@/components/section-block"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen } from "lucide-react"
import type { Paper, Section } from "@/lib/paper-schema"

interface StructuredViewProps {
  paper: Paper
  hoveredSection: string | null
  onSectionHover: (sectionId: string | null) => void
  onSectionClick: (section: Section) => void
}

export function StructuredView({
  paper,
  hoveredSection,
  onSectionHover,
  onSectionClick,
}: StructuredViewProps) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const scrollToSection = useCallback((sectionId: string) => {
    const el = sectionRefs.current[sectionId]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Paper header */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0">
        <h1 className="font-bold text-base leading-snug text-balance">
          {paper.title}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {paper.authors.join(", ")}
        </p>
      </div>

      {/* Table of contents */}
      <div className="px-4 py-2 border-b bg-muted/30 shrink-0 max-h-24 overflow-y-auto">
        <div className="flex items-center gap-1.5 mb-1.5">
          <BookOpen className="size-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Contents
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-3 gap-y-1">
          {paper.sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-48"
            >
              {section.heading}
            </button>
          ))}
        </nav>
      </div>

      {/* Sections */}
      <div className="flex-1 min-h-0">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-1">
          {paper.sections.map((section) => (
            <div
              key={section.id}
              ref={(el) => {
                sectionRefs.current[section.id] = el
              }}
            >
              <SectionBlock
                section={section}
                isHovered={hoveredSection === section.id}
                onHover={onSectionHover}
                onClick={onSectionClick}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
      </div>
    </div>
  )
}
