import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

// Mock the AI SDK
vi.mock("ai", () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  Output: {
    object: vi.fn((config) => config),
  },
}))

// Mock paper schema and prompts
vi.mock("@/lib/paper-schema", () => ({
  paperSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      authors: { type: "array" },
      abstract: { type: "string" },
      sections: { type: "array" },
    },
  },
}))

vi.mock("@/lib/prompts", () => ({
  PARSE_PAPER_PROMPT: "Test prompt for parsing papers",
}))

function collectStream(response: Response): Promise<string> {
  return new Promise(async (resolve) => {
    const reader = response.body?.getReader()
    if (!reader) return resolve("")
    const decoder = new TextDecoder()
    let result = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += decoder.decode(value)
    }
    resolve(result)
  })
}

describe("parse-paper API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("streaming endpoint", () => {
    it("should return a streaming response for valid PDF input", async () => {
      const { streamText } = await import("ai")
      
      const mockPartialStream = (async function* () {
        yield { sections: [{ id: "section-0", heading: "Abstract" }] }
        yield { sections: [{ id: "section-0", heading: "Abstract" }, { id: "section-1", heading: "Introduction" }] }
      })()

      const mockFinalOutput = {
        title: "Test Paper",
        authors: ["Author 1"],
        abstract: "Test abstract",
        sections: [
          { id: "section-0", heading: "Abstract" },
          { id: "section-1", heading: "Introduction" },
        ],
      }

      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: mockPartialStream,
        output: Promise.resolve(mockFinalOutput),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: "base64data",
          model: "anthropic/claude-sonnet-4.5",
        }),
      })

      const response = await POST(request)
      expect(response).toBeDefined()
      expect(response.headers.get("content-type")).toContain("text/event-stream")
    })

    it("should handle PDF URL input", async () => {
      const { streamText } = await import("ai")

      const originalFetch = global.fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        arrayBuffer: async () => new ArrayBuffer(100),
      })

      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: (async function* () {})(),
        output: Promise.resolve({
          title: "URL Paper",
          authors: [],
          abstract: "",
          sections: [],
        }),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/paper.pdf",
          model: "anthropic/claude-sonnet-4.5",
        }),
      })

      const response = await POST(request)
      expect(response).toBeDefined()

      const text = await collectStream(response)
      expect(text).toContain("event: complete")

      global.fetch = originalFetch
    })

    it("should send progress updates as sections are parsed", async () => {
      const { streamText } = await import("ai")
      
      const mockPartialStream = (async function* () {
        yield { sections: Array(3).fill({}) }
        yield { sections: Array(7).fill({}) }
        yield { sections: Array(12).fill({}) }
      })()

      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: mockPartialStream,
        output: Promise.resolve({
          title: "Test",
          authors: [],
          abstract: "",
          sections: Array(12).fill({}),
        }),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({ pdfBase64: "data", model: "test-model" }),
      })

      const response = await POST(request)
      const text = await collectStream(response)

      expect(text).toContain("parsing")
      expect(text).toContain("section")
    })

    it("should send complete event with paper data", async () => {
      const { streamText } = await import("ai")

      const mockPaper = {
        title: "Complete Test",
        authors: ["Author"],
        abstract: "Abstract",
        sections: [{ id: "s1", heading: "Intro" }],
      }

      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: (async function* () {
          yield { sections: [{ id: "s1", heading: "Intro" }] }
        })(),
        output: Promise.resolve(mockPaper),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({ pdfBase64: "data", model: "test-model" }),
      })

      const response = await POST(request)
      const text = await collectStream(response)

      expect(text).toContain("event: complete")
      expect(text).toContain('"title":"Complete Test"')
    })
  })

  describe("error handling", () => {
    it("should handle missing PDF data in non-streaming mode", async () => {
      const request = new Request("http://localhost/api/parse-paper", {
        method: "POST",
        body: JSON.stringify({ model: "test-model" }),
      })

      const response = await POST(request)
      const json = await response.json()

      expect(json.error).toContain("No PDF data provided")
    })

    it("should handle missing PDF data in streaming mode", async () => {
      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({ model: "test-model" }),
      })

      const response = await POST(request)
      const text = await collectStream(response)

      expect(text).toContain("event: error")
      expect(text).toContain("No PDF data provided")
    })

    it("should handle PDF fetch errors", async () => {
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error("Fetch failed"))

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/invalid.pdf",
          model: "test-model",
        }),
      })

      const response = await POST(request)
      const text = await collectStream(response)

      expect(text).toContain("event: error")
      expect(text).toContain("fetchFailed")

      global.fetch = originalFetch
    })

    it("should handle LLM returning no output", async () => {
      const { streamText } = await import("ai")

      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: (async function* () {})(),
        output: Promise.resolve(null),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({ pdfBase64: "data", model: "test-model" }),
      })

      const response = await POST(request)
      const text = await collectStream(response)

      expect(text).toContain("event: error")
      expect(text).toContain("did not return structured output")
    })
  })

  describe("model configuration", () => {
    it("should use the specified model", async () => {
      const { streamText } = await import("ai")
      
      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: (async function* () {})(),
        output: Promise.resolve({ title: "", authors: [], abstract: "", sections: [] }),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({
          pdfBase64: "data",
          model: "anthropic/claude-haiku-4.5",
        }),
      })

      const response = await POST(request)
      await collectStream(response)
      
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "anthropic/claude-haiku-4.5",
        })
      )
    })

    it("should default to Claude Haiku 4.5 if no model specified", async () => {
      const { streamText } = await import("ai")
      
      vi.mocked(streamText).mockReturnValue({
        partialOutputStream: (async function* () {})(),
        output: Promise.resolve({ title: "", authors: [], abstract: "", sections: [] }),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({ pdfBase64: "data" }),
      })

      const response = await POST(request)
      await collectStream(response)
      
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "anthropic/claude-haiku-4.5",
        })
      )
    })
  })
})
