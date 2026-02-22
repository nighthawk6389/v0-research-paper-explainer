import { describe, it, expect, vi, beforeEach } from "vitest"

// ── AI SDK mock ─────────────────────────────────────────────────────────────
vi.mock("ai", () => ({
  streamText: vi.fn(),
  tool: vi.fn((config) => config),
  convertToModelMessages: vi.fn(async (messages) => messages),
  consumeStream: vi.fn(),
  stepCountIs: vi.fn((n) => n),
}))

// ── Wolfram Alpha mock ──────────────────────────────────────────────────────
vi.mock("@/lib/wolfram-alpha", () => ({
  queryWolframAlpha: vi.fn(),
  formatWolframResultAsMarkdown: vi.fn(() => "### Result\n42\n"),
}))

import { POST } from "./route"
import type { UIMessage } from "ai"

const makeRequest = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/deep-dive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const baseBody = {
  messages: [] as UIMessage[],
  latex: "E = mc^2",
  sectionContext: "From the relativistic energy section.",
  paperTitle: "Theory of Relativity",
}

describe("deep-dive API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("streaming response", () => {
    it("returns a streaming response", async () => {
      const { streamText } = await import("ai")
      const mockStream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode("data: {}\n\n"))
          c.close()
        },
      })
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStreamResponse: vi.fn(() => new Response(mockStream)),
      } as any)

      const res = await POST(makeRequest(baseBody))
      expect(res).toBeInstanceOf(Response)
    })

    it("passes the correct model to streamText", async () => {
      const { streamText } = await import("ai")
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
      } as any)

      await POST(makeRequest({ ...baseBody, model: "anthropic/claude-opus-4-5" }))

      const call = vi.mocked(streamText).mock.calls[0][0]
      expect(call.model).toBe("anthropic/claude-opus-4-5")
    })

    it("defaults to anthropic/claude-haiku-4.5 when no model is specified", async () => {
      const { streamText } = await import("ai")
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
      } as any)

      await POST(makeRequest(baseBody))

      const call = vi.mocked(streamText).mock.calls[0][0]
      expect(call.model).toBe("anthropic/claude-haiku-4.5")
    })

    it("includes paper context in the system prompt", async () => {
      const { streamText } = await import("ai")
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
      } as any)

      await POST(makeRequest(baseBody))

      const call = vi.mocked(streamText).mock.calls[0][0]
      expect(call.system).toContain("Theory of Relativity")
      expect(call.system).toContain("E = mc^2")
    })

    it("includes persona/goal/tone in system prompt when provided", async () => {
      const { streamText } = await import("ai")
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
      } as any)

      await POST(
        makeRequest({
          ...baseBody,
          persona: "Graduate student",
          goal: "Build intuition",
          tone: "concise",
        })
      )

      const call = vi.mocked(streamText).mock.calls[0][0]
      expect(call.system).toContain("Graduate student")
      expect(call.system).toContain("Build intuition")
      expect(call.system).toContain("concise")
    })

    it("does not include persona section when none provided", async () => {
      const { streamText } = await import("ai")
      vi.mocked(streamText).mockReturnValue({
        toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
      } as any)

      await POST(makeRequest(baseBody))

      const call = vi.mocked(streamText).mock.calls[0][0]
      expect(call.system).not.toContain("AUDIENCE/GOAL")
    })
  })

  describe("Wolfram Alpha tool execute", () => {
    async function executeWolframTool(wolframResult: Awaited<ReturnType<typeof import("@/lib/wolfram-alpha").queryWolframAlpha>>) {
      const { streamText } = await import("ai")
      const { queryWolframAlpha } = await import("@/lib/wolfram-alpha")

      let capturedTools: Record<string, { execute: Function }> = {}
      vi.mocked(streamText).mockImplementation((config: any) => {
        capturedTools = config.tools
        return {
          toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
        } as any
      })

      vi.mocked(queryWolframAlpha).mockResolvedValueOnce(wolframResult)

      await POST(makeRequest(baseBody))

      return capturedTools.wolframAlpha.execute({ query: "integrate x^2", purpose: "test" })
    }

    it("returns success=true with pods and images when Wolfram succeeds", async () => {
      const result = await executeWolframTool({
        success: true,
        inputInterpretation: "integral of x^2",
        error: null,
        pods: [
          {
            title: "Indefinite integral",
            subpods: [
              {
                title: "",
                plaintext: "x^3/3 + constant",
                img: {
                  src: "https://api.wolframalpha.com/v2/Media.jsp?s=1",
                  alt: "integral result",
                  width: 300,
                  height: 100,
                },
              },
            ],
          },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.pods).toHaveLength(1)
      expect(result.images).toHaveLength(1)
      expect(result.images[0].src).toContain("wolframalpha.com")
      expect(result.images[0].width).toBe(300)
      expect(result.images[0].height).toBe(100)
    })

    it("returns success=false with error message when Wolfram fails", async () => {
      const result = await executeWolframTool({
        success: false,
        inputInterpretation: null,
        error: "Query not understood",
        pods: [],
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe("Query not understood")
      expect(result.images).toHaveLength(0)
      expect(result.pods).toHaveLength(0)
    })

    it("returns empty images array when pods have no images", async () => {
      const result = await executeWolframTool({
        success: true,
        inputInterpretation: "x^2",
        error: null,
        pods: [
          {
            title: "Result",
            subpods: [{ title: "", plaintext: "x^2", img: null }],
          },
        ],
      })

      expect(result.images).toHaveLength(0)
    })

    it("echoes back query and purpose in the result", async () => {
      const { streamText } = await import("ai")
      const { queryWolframAlpha } = await import("@/lib/wolfram-alpha")

      let capturedTools: Record<string, { execute: Function }> = {}
      vi.mocked(streamText).mockImplementation((config: any) => {
        capturedTools = config.tools
        return {
          toUIMessageStreamResponse: vi.fn(() => new Response(new ReadableStream({ start(c) { c.close() } }))),
        } as any
      })

      vi.mocked(queryWolframAlpha).mockResolvedValueOnce({
        success: true, inputInterpretation: null, error: null, pods: [],
      })

      await POST(makeRequest(baseBody))

      const result = await capturedTools.wolframAlpha.execute({
        query: "solve x^2 - 1 = 0",
        purpose: "Find roots",
      })

      expect(result.query).toBe("solve x^2 - 1 = 0")
      expect(result.purpose).toBe("Find roots")
    })
  })
})
