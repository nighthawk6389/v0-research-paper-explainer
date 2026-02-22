import type { Paper, Section, Equation, PaperStats } from "@/lib/paper-schema"

const PARAGRAPH_TRUNCATE = 500
const SUMMARY_SECTIONS_KEYWORDS = ["introduction", "intro", "method", "methodology", "results", "conclusion", "discussion", "abstract"]

/**
 * Generates deterministic block IDs for each section's content blocks.
 * blockId = `${sectionId}-block-${index}`
 */
export function enrichPaperWithBlockIds(paper: Paper): Record<string, string[]> {
  const blockIds: Record<string, string[]> = {}
  for (const section of paper.sections) {
    blockIds[section.id] = section.content.map((_, idx) => `${section.id}-block-${idx}`)
  }
  return blockIds
}

/**
 * Collects display equations from all sections (excludes inline math).
 * equationId matches the blockId for anchoring.
 */
export function extractEquations(paper: Paper): Equation[] {
  const out: Equation[] = []
  for (const section of paper.sections) {
    section.content.forEach((block, idx) => {
      if (block.type !== "math") return
      if (block.isInline === true) return
      const equationId = `${section.id}-block-${idx}`
      out.push({
        equationId,
        latex: block.value,
        label: block.label ?? null,
        sectionId: section.id,
        sectionHeading: section.heading,
        pageNumbers: section.pageNumbers,
      })
    })
  }
  return out
}

/**
 * Counts sections, text blocks, and math blocks.
 */
export function getPaperStats(paper: Paper): PaperStats {
  let numParagraphs = 0
  let numEquations = 0
  for (const section of paper.sections) {
    for (const block of section.content) {
      if (block.type === "text") numParagraphs++
      else if (block.type === "math") numEquations++
    }
  }
  return {
    numSections: paper.sections.length,
    numParagraphs,
    numEquations,
  }
}

function sectionText(section: Section, truncate?: number): string {
  return section.content
    .map((block) => {
      if (block.type === "math") return `$$${block.value}$$${block.label ? ` ${block.label}` : ""}`
      let t = block.value
      if (truncate != null && t.length > truncate) t = t.slice(0, truncate) + "..."
      return t
    })
    .join("\n\n")
}

/**
 * Builds a condensed paper text for LLM prompts to avoid huge token payloads.
 */
export function compressPaperForPrompt(
  paper: Paper,
  mode: "summary" | "slides" | "flashcards"
): string {
  const lines: string[] = []
  lines.push(`# ${paper.title}`)
  lines.push(`Authors: ${paper.authors.join(", ")}`)
  lines.push("")
  lines.push("## Abstract")
  lines.push(paper.abstract)
  lines.push("")

  const toc = paper.sections.map((s) => `- ${s.heading}`).join("\n")
  lines.push("## Table of contents")
  lines.push(toc)
  lines.push("")

  if (mode === "summary") {
    for (const section of paper.sections) {
      const headingLower = section.heading.toLowerCase()
      const isKeySection = SUMMARY_SECTIONS_KEYWORDS.some((k) => headingLower.includes(k))
      lines.push(`## ${section.heading}`)
      lines.push(isKeySection ? sectionText(section) : sectionText(section, PARAGRAPH_TRUNCATE))
      lines.push("")
    }
  } else if (mode === "flashcards") {
    for (const section of paper.sections) {
      lines.push(`## ${section.heading}`)
      lines.push(sectionText(section, PARAGRAPH_TRUNCATE))
      lines.push("")
    }
  } else {
    // slides: headings + first paragraph each
    for (const section of paper.sections) {
      lines.push(`## ${section.heading}`)
      const firstText = section.content.find((b) => b.type === "text")?.value ?? ""
      lines.push(firstText.length > PARAGRAPH_TRUNCATE ? firstText.slice(0, PARAGRAPH_TRUNCATE) + "..." : firstText)
      lines.push("")
    }
  }

  return lines.join("\n")
}
