import { describe, it, expect } from "vitest"
import {
  extractEquations,
  enrichPaperWithBlockIds,
  getPaperStats,
  compressPaperForPrompt,
} from "./paper-utils"
import type { Paper } from "./paper-schema"

const mockPaper: Paper = {
  title: "Test Paper",
  authors: ["Author A", "Author B"],
  abstract: "Short abstract.",
  sections: [
    {
      id: "section-0",
      heading: "Abstract",
      type: "text",
      content: [{ type: "text", value: "Short abstract.", label: null, isInline: null }],
      pageNumbers: [1],
    },
    {
      id: "section-1",
      heading: "Introduction",
      type: "mixed",
      content: [
        { type: "text", value: "Intro paragraph.", label: null, isInline: null },
        { type: "math", value: "E = mc^2", label: "(1)", isInline: false },
        { type: "math", value: "x + y", label: null, isInline: true },
      ],
      pageNumbers: [1, 2],
    },
    {
      id: "section-2",
      heading: "Method",
      type: "math",
      content: [
        { type: "math", value: "\\nabla f", label: "(2)", isInline: false },
      ],
      pageNumbers: [2],
    },
  ],
}

describe("enrichPaperWithBlockIds", () => {
  it("generates block IDs per section", () => {
    const blockIds = enrichPaperWithBlockIds(mockPaper)
    expect(blockIds["section-0"]).toEqual(["section-0-block-0"])
    expect(blockIds["section-1"]).toEqual([
      "section-1-block-0",
      "section-1-block-1",
      "section-1-block-2",
    ])
    expect(blockIds["section-2"]).toEqual(["section-2-block-0"])
  })
})

describe("extractEquations", () => {
  it("returns only display equations (excludes inline math)", () => {
    const equations = extractEquations(mockPaper)
    expect(equations).toHaveLength(2)
    expect(equations[0]).toMatchObject({
      equationId: "section-1-block-1",
      latex: "E = mc^2",
      label: "(1)",
      sectionId: "section-1",
      sectionHeading: "Introduction",
      pageNumbers: [1, 2],
    })
    expect(equations[1]).toMatchObject({
      equationId: "section-2-block-0",
      latex: "\\nabla f",
      label: "(2)",
      sectionId: "section-2",
      sectionHeading: "Method",
    })
  })

  it("returns empty array for paper with no display equations", () => {
    const textOnly: Paper = {
      ...mockPaper,
      sections: [
        {
          id: "s0",
          heading: "Only text",
          type: "text",
          content: [{ type: "text", value: "Hi", label: null, isInline: null }],
          pageNumbers: [1],
        },
      ],
    }
    expect(extractEquations(textOnly)).toEqual([])
  })
})

describe("getPaperStats", () => {
  it("counts sections, paragraphs, and equations", () => {
    const stats = getPaperStats(mockPaper)
    expect(stats).toEqual({
      numSections: 3,
      numParagraphs: 2,
      numEquations: 3,
    })
  })
})

describe("compressPaperForPrompt", () => {
  it("includes title, authors, abstract, and TOC for all modes", () => {
    const out = compressPaperForPrompt(mockPaper, "summary")
    expect(out).toContain("# Test Paper")
    expect(out).toContain("Authors: Author A, Author B")
    expect(out).toContain("## Abstract")
    expect(out).toContain("Short abstract.")
    expect(out).toContain("## Table of contents")
    expect(out).toContain("- Abstract")
    expect(out).toContain("- Introduction")
    expect(out).toContain("- Method")
  })

  it("summary mode includes full section content for key sections", () => {
    const out = compressPaperForPrompt(mockPaper, "summary")
    expect(out).toContain("## Abstract")
    expect(out).toContain("Intro paragraph.")
    expect(out).toContain("E = mc^2")
  })

  it("slides mode includes section headings and first paragraph", () => {
    const out = compressPaperForPrompt(mockPaper, "slides")
    expect(out).toContain("## Introduction")
    expect(out).toContain("Intro paragraph.")
  })

  it("flashcards mode truncates long paragraphs", () => {
    const long = "x".repeat(600)
    const paperWithLong: Paper = {
      ...mockPaper,
      sections: [
        {
          id: "s0",
          heading: "Long",
          type: "text",
          content: [{ type: "text", value: long, label: null, isInline: null }],
          pageNumbers: [1],
        },
      ],
    }
    const out = compressPaperForPrompt(paperWithLong, "flashcards")
    expect(out).toContain("...")
    expect(out.length).toBeLessThan(long.length + 200)
  })
})
