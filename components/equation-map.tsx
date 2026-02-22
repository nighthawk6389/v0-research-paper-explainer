"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { MathBlock } from "@/components/math-block"
import { extractEquations } from "@/lib/paper-utils"
import type { Paper, Section } from "@/lib/paper-schema"
import type { Equation } from "@/lib/paper-schema"
import { BookOpen, Sigma, MessageSquare } from "lucide-react"

interface EquationMapProps {
  paper: Paper
  onExplainEquation?: (equation: Equation, section: Section) => void
  onDeepDive?: (latex: string, section: Section) => void
}

export function EquationMap({
  paper,
  onExplainEquation,
  onDeepDive,
}: EquationMapProps) {
  const equationsBySection = useMemo(() => {
    const equations = extractEquations(paper)
    const map = new Map<string, Equation[]>()
    for (const eq of equations) {
      const list = map.get(eq.sectionId) ?? []
      list.push(eq)
      map.set(eq.sectionId, list)
    }
    return map
  }, [paper])

  const sectionById = useMemo(() => {
    const m = new Map<string, Section>()
    for (const s of paper.sections) m.set(s.id, s)
    return m
  }, [paper.sections])

  const sectionsWithEquations = useMemo(
    () =>
      paper.sections.filter((s) => equationsBySection.get(s.id)?.length),
    [paper.sections, equationsBySection]
  )

  if (sectionsWithEquations.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No display equations found in this paper.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b bg-muted/30 shrink-0 flex items-center gap-1.5">
        <Sigma className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          Equations
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3 space-y-4">
          {sectionsWithEquations.map((section) => {
            const equations = equationsBySection.get(section.id) ?? []
            return (
              <div key={section.id}>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {section.heading}
                  </span>
                  {section.pageNumbers.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      p.{section.pageNumbers.join(",")}
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {equations.map((eq) => (
                    <li
                      key={eq.equationId}
                      className="border rounded-md p-3 bg-card hover:bg-muted/30 transition-colors"
                    >
                      {/* Full-width scrollable equation row */}
                      <div className="w-full overflow-x-auto">
                        <MathBlock
                          latex={eq.latex}
                          displayMode
                          label={eq.label ?? undefined}
                          className="text-sm"
                          onDeepDive={
                            onDeepDive
                              ? () => onDeepDive(eq.latex, section)
                              : undefined
                          }
                          deepDiveLabel="Deep Dive"
                        />
                      </div>
                      {/* Explain button below equation */}
                      {onExplainEquation && (
                        <div className="flex justify-end mt-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => onExplainEquation(eq, section)}
                          >
                            <MessageSquare className="size-3" />
                            Explain
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
