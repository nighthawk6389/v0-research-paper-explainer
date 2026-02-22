import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((config: { schema: unknown }) => config) },
}))

describe("generate-flashcards API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns JSON with cards array", async () => {
    const { generateText } = await import("ai")
    const mockOutput = {
      cards: [
        { front: "What is X?", back: "X is...", difficulty: "easy" },
        { front: "What is Y?", back: "Y is...", tags: ["concept"] },
      ],
    }
    vi.mocked(generateText).mockResolvedValue({ output: mockOutput } as any)

    const req = new Request("http://localhost/api/generate-flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperText: "# Paper\n\nContent." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cards).toHaveLength(2)
    expect(data.cards[0].front).toBe("What is X?")
    expect(data.cards[0].difficulty).toBe("easy")
  })

  it("accepts flashcardCount and clamps to valid range", async () => {
    const { generateText } = await import("ai")
    vi.mocked(generateText).mockResolvedValue({
      output: { cards: [] },
    } as any)

    const req = new Request("http://localhost/api/generate-flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperText: "Content", flashcardCount: 20 }),
    })
    await POST(req)
    const call = vi.mocked(generateText).mock.calls[0][0]
    expect(call.system).toContain("20")
  })
})
