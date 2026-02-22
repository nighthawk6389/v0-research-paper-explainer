import type { Paper } from "@/lib/paper-schema"

export const PARSE_VERSION = 1

export interface PaperRecord {
  paperId: string
  createdAt: number
  updatedAt: number
  title: string
  authors?: string[]
  year?: string
  source?: { type: "upload" | "url"; value?: string }
  pdfBlob?: Blob
  pdfUrl?: string | null
  parseVersion: number
  paperData: Paper
  blockIds: Record<string, string[]>
  stats: { numSections: number; numParagraphs: number; numEquations: number }
}

export type AnchorType = "section" | "paragraph" | "equation"

export interface ConversationAnchor {
  type: AnchorType
  sectionId: string
  blockId?: string
  pageNumbers?: number[]
}

export interface ConversationMessage {
  role: "user" | "assistant"
  content: string
  createdAt: number
  model?: string
}

export interface PersonaConfig {
  persona?: string
  goal?: string
  tone?: string
}

export interface Conversation {
  conversationId: string
  paperId: string
  anchor: ConversationAnchor
  difficulty: "basic" | "advanced" | "phd"
  model?: string
  persona?: PersonaConfig
  title?: string
  messages: ConversationMessage[]
  createdAt: number
  updatedAt: number
}

export type ArtifactContent =
  | { type: "summary"; markdown: string }
  | {
      type: "slides"
      title: string
      slides: Array<{ title: string; bullets: string[]; speakerNotes?: string }>
    }
  | {
      type: "flashcards"
      cards: Array<{
        front: string
        back: string
        tags?: string[]
        difficulty?: "easy" | "medium" | "hard"
      }>
    }

export interface ArtifactParams {
  persona?: string
  goal?: string
  tone?: string
  difficulty?: "basic" | "advanced" | "phd"
  slideCount?: number
  flashcardCount?: number
}

export interface Artifact {
  artifactId: string
  paperId: string
  artifactType: "summary" | "slides" | "flashcards"
  params: ArtifactParams
  content: ArtifactContent
  createdAt: number
  updatedAt: number
}

export interface ListConversationsFilters {
  difficulty?: "basic" | "advanced" | "phd"
  anchorType?: AnchorType
}
