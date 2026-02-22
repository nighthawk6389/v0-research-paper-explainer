import { describe, it, expect, beforeEach } from "vitest"
import {
  getPaperIdFromUpload,
  savePaper,
  listPapers,
  getPaper,
  deletePaper,
  buildPaperRecord,
  saveConversation,
  getConversation,
  listConversations,
  saveArtifact,
  getArtifact,
  listArtifacts,
  deleteArtifact,
  buildArtifact,
  blobToBase64,
} from "./db"
import type { Paper } from "@/lib/paper-schema"
import type { Conversation, Artifact } from "./types"

const mockPaper: Paper = {
  title: "Storage Test Paper",
  authors: ["Author 1"],
  abstract: "Abstract text",
  sections: [
    {
      id: "section-0",
      heading: "Abstract",
      type: "text",
      content: [{ type: "text", value: "Abstract text", label: null, isInline: null }],
      pageNumbers: [1],
    },
  ],
}

describe("getPaperIdFromUpload", () => {
  it("returns sha256 hex for blob content", async () => {
    const blob = new Blob(["hello"], { type: "application/pdf" })
    const id = await getPaperIdFromUpload(blob)
    expect(id).toMatch(/^[a-f0-9]{64}$/)
  })

  it("returns sha256 hex for URL", async () => {
    const id = await getPaperIdFromUpload(undefined, "https://example.com/paper.pdf")
    expect(id).toMatch(/^[a-f0-9]{64}$/)
  })

  it("throws when neither blob nor url provided", async () => {
    await expect(getPaperIdFromUpload()).rejects.toThrow("Need pdfBlob or url")
  })
})

describe("blobToBase64", () => {
  it("returns data URL for blob", async () => {
    const blob = new Blob(["x"], { type: "application/pdf" })
    const out = await blobToBase64(blob)
    expect(out).toMatch(/^data:application\/pdf;base64,/)
  })
})

describe("Paper storage", () => {
  const paperId = "test-paper-id-" + Date.now()

  beforeEach(async () => {
    try {
      await deletePaper(paperId)
    } catch {
      // ignore if not found
    }
  })

  it("savePaper and getPaper round-trip", async () => {
    const record = buildPaperRecord(paperId, mockPaper, { source: { type: "upload" } })
    await savePaper(record)
    const got = await getPaper(paperId)
    expect(got).toBeDefined()
    expect(got?.title).toBe("Storage Test Paper")
    expect(got?.paperData.sections).toHaveLength(1)
    expect(got?.blockIds["section-0"]).toEqual(["section-0-block-0"])
    expect(got?.stats.numSections).toBe(1)
  })

  it("listPapers includes saved paper", async () => {
    const record = buildPaperRecord(paperId, mockPaper, {})
    await savePaper(record)
    const list = await listPapers()
    expect(list.some((p) => p.paperId === paperId)).toBe(true)
  })

  it("deletePaper removes paper and cascades", async () => {
    const record = buildPaperRecord(paperId, mockPaper, {})
    await savePaper(record)
    await deletePaper(paperId)
    const got = await getPaper(paperId)
    expect(got).toBeUndefined()
  })
})

describe("Conversation storage", () => {
  const paperId = "test-paper-conv-" + Date.now()
  const conversationId = "conv-" + crypto.randomUUID()

  beforeEach(async () => {
    try {
      await deletePaper(paperId)
    } catch {
      // ensure paper exists for listConversations
    }
    const record = buildPaperRecord(paperId, mockPaper, {})
    await savePaper(record)
  })

  it("saveConversation and getConversation round-trip", async () => {
    const conv: Conversation = {
      conversationId,
      paperId,
      anchor: { type: "section", sectionId: "section-0" },
      difficulty: "basic",
      messages: [
        { role: "user", content: "Explain this", createdAt: Date.now() },
        { role: "assistant", content: "Sure.", createdAt: Date.now() },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveConversation(conv)
    const got = await getConversation(conversationId)
    expect(got).toBeDefined()
    expect(got?.messages).toHaveLength(2)
    expect(got?.anchor.sectionId).toBe("section-0")
  })

  it("listConversations returns conversations for paper", async () => {
    const conv: Conversation = {
      conversationId,
      paperId,
      anchor: { type: "section", sectionId: "section-0" },
      difficulty: "advanced",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveConversation(conv)
    const list = await listConversations(paperId)
    expect(list.some((c) => c.conversationId === conversationId)).toBe(true)
  })

  it("listConversations filters by difficulty", async () => {
    const conv: Conversation = {
      conversationId,
      paperId,
      anchor: { type: "section", sectionId: "section-0" },
      difficulty: "advanced",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveConversation(conv)
    const list = await listConversations(paperId, { difficulty: "basic" })
    expect(list.some((c) => c.conversationId === conversationId)).toBe(false)
  })
})

describe("Artifact storage", () => {
  const paperId = "test-paper-art-" + Date.now()

  beforeEach(async () => {
    try {
      await deletePaper(paperId)
    } catch {
      //
    }
    const record = buildPaperRecord(paperId, mockPaper, {})
    await savePaper(record)
  })

  it("buildArtifact and saveArtifact round-trip", async () => {
    const artifact = buildArtifact(
      paperId,
      "summary",
      { persona: "engineer" },
      { type: "summary", markdown: "# Summary\nContent here." }
    )
    await saveArtifact(artifact)
    const got = await getArtifact(artifact.artifactId)
    expect(got).toBeDefined()
    expect(got?.content.type).toBe("summary")
    if (got?.content.type === "summary") expect(got.content.markdown).toContain("Summary")
  })

  it("listArtifacts returns artifacts for paper", async () => {
    const artifact = buildArtifact(
      paperId,
      "flashcards",
      {},
      { type: "flashcards", cards: [{ front: "Q", back: "A" }] }
    )
    await saveArtifact(artifact)
    const list = await listArtifacts(paperId)
    expect(list.some((a) => a.artifactId === artifact.artifactId)).toBe(true)
  })

  it("listArtifacts filters by type", async () => {
    const artifact = buildArtifact(
      paperId,
      "slides",
      {},
      { type: "slides", title: "Deck", slides: [{ title: "S1", bullets: [] }] }
    )
    await saveArtifact(artifact)
    const list = await listArtifacts(paperId, "summary")
    expect(list.some((a) => a.artifactId === artifact.artifactId)).toBe(false)
  })

  it("deleteArtifact removes artifact", async () => {
    const artifact = buildArtifact(
      paperId,
      "summary",
      {},
      { type: "summary", markdown: "x" }
    )
    await saveArtifact(artifact)
    await deleteArtifact(artifact.artifactId)
    const got = await getArtifact(artifact.artifactId)
    expect(got).toBeUndefined()
  })
})
