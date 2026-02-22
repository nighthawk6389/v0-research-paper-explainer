import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((config: { schema: unknown }) => config) },
}))

describe("generate-slides API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns JSON with title and slides array", async () => {
    const { generateText } = await import("ai")
    const mockOutput = {
      title: "Test Deck",
      slides: [
        { title: "Slide 1", bullets: ["Point A"], speakerNotes: "Note 1" },
        { title: "Slide 2", bullets: ["Point B"] },
      ],
    }
    vi.mocked(generateText).mockResolvedValue({ output: mockOutput } as any)

    const req = new Request("http://localhost/api/generate-slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperText: "# Paper\n\nContent." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title).toBe("Test Deck")
    expect(data.slides).toHaveLength(2)
    expect(data.slides[0].title).toBe("Slide 1")
    expect(data.slides[0].bullets).toEqual(["Point A"])
  })

  it("accepts slideCount and passes to prompt", async () => {
    const { generateText } = await import("ai")
    vi.mocked(generateText).mockResolvedValue({
      output: { title: "T", slides: [] },
    } as any)

    const req = new Request("http://localhost/api/generate-slides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperText: "Content", slideCount: 8 }),
    })
    await POST(req)
    const call = vi.mocked(generateText).mock.calls[0][0]
    expect(call.system).toContain("8")
  })
})
