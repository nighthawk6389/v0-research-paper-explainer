import { z } from "zod"

export const contentBlockSchema = z.object({
  type: z.enum(["text", "math"]),
  value: z.string().describe("Plain text content or LaTeX math string"),
  label: z
    .string()
    .nullable()
    .describe("Equation label like (1), (2) if present, null otherwise"),
  isInline: z
    .boolean()
    .nullable()
    .describe("True if this is inline math within text, false for display/block math, null for text type"),
})

export const sectionSchema = z.object({
  id: z.string().describe("Unique section identifier, e.g. section-1, section-2"),
  heading: z.string().describe("Section heading exactly as it appears in the paper"),
  type: z.enum(["text", "math", "mixed"]).describe("Whether this section is primarily text, math, or mixed"),
  content: z.array(contentBlockSchema).describe("Ordered array of text and math content blocks within this section"),
  pageNumbers: z.array(z.number()).describe("Which page numbers this section spans (1-indexed)"),
})

export const paperSchema = z.object({
  title: z.string().describe("The title of the paper"),
  authors: z.array(z.string()).describe("List of author names"),
  abstract: z.string().describe("The full abstract text"),
  sections: z.array(sectionSchema).describe("All sections between the abstract and references/bibliography, in order"),
})

export type ContentBlock = z.infer<typeof contentBlockSchema>
export type Section = z.infer<typeof sectionSchema>
export type Paper = z.infer<typeof paperSchema>
