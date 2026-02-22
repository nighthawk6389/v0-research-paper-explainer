import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

vi.mock("ai", () => ({
  streamText: vi.fn(),
}))

describe("generate-summary API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns plain text stream with summary content", async () => {
    const { streamText } = await import("ai")
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("# Big idea\n\nSummary text."))
        controller.close()
      },
    })
    vi.mocked(streamText).mockReturnValue({
      textStream: mockStream,
    } as any)

    const req = new Request("http://localhost/api/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperText: "# Paper\n\nContent." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/plain")
    const text = await res.text()
    expect(text).toContain("Big idea")
    expect(text).toContain("Summary text")
  })

  it("includes persona and goal in prompt when provided", async () => {
    const { streamText } = await import("ai")
    vi.mocked(streamText).mockReturnValue({
      textStream: new ReadableStream({ start(c) { c.close() } }),
    } as any)

    const req = new Request("http://localhost/api/generate-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paperText: "Paper content",
        persona: "Product manager",
        goal: "Understand the big idea",
        tone: "concise",
      }),
    })
    await POST(req)
    const call = vi.mocked(streamText).mock.calls[0][0]
    expect(call.system).toContain("AUDIENCE")
    expect(call.system).toContain("Product manager")
    expect(call.system).toContain("Understand the big idea")
    expect(call.system).toContain("concise")
  })
})
