import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"

// Mock the AI SDK
vi.mock("ai", () => ({
  streamObject: vi.fn(),
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

describe("parse-paper API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("streaming endpoint", () => {
    it("should return a streaming response for valid PDF input", async () => {
      const { streamObject } = await import("ai")
      
      const mockPartialStream = (async function* () {
        yield { sections: [{ id: "section-0", heading: "Abstract" }] }
        yield { sections: [{ id: "section-0", heading: "Abstract" }, { id: "section-1", heading: "Introduction" }] }
      })()

      const mockFinalObject = {
        title: "Test Paper",
        authors: ["Author 1"],
        abstract: "Test abstract",
        sections: [
          { id: "section-0", heading: "Abstract" },
          { id: "section-1", heading: "Introduction" },
        ],
      }

      vi.mocked(streamObject).mockReturnValue({
        partialObjectStream: mockPartialStream,
        object: Promise.resolve(mockFinalObject),
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
      const { streamObject } = await import("ai")
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100),
      })

      vi.mocked(streamObject).mockReturnValue({
        partialObjectStream: (async function* () {})(),
        object: Promise.resolve({
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
      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/paper.pdf",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/pdf",
          }),
        })
      )
    })

    it("should send progress updates as sections are parsed", async () => {
      const { streamObject } = await import("ai")
      
      const mockPartialStream = (async function* () {
        yield { sections: Array(3).fill({}) }
        yield { sections: Array(7).fill({}) }
        yield { sections: Array(12).fill({}) }
      })()

      vi.mocked(streamObject).mockReturnValue({
        partialObjectStream: mockPartialStream,
        object: Promise.resolve({
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
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      let hasProgressUpdate = false
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        if (text.includes("parsing") || text.includes("section")) {
          hasProgressUpdate = true
        }
      }
      
      expect(hasProgressUpdate).toBe(true)
    })
  })

  describe("error handling", () => {
    it("should handle missing PDF data", async () => {
      const request = new Request("http://localhost/api/parse-paper", {
        method: "POST",
        body: JSON.stringify({ model: "test-model" }),
      })

      const response = await POST(request)
      const text = await response.text()
      
      expect(text).toContain("error")
    })

    it("should handle PDF fetch errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Fetch failed"))

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/invalid.pdf",
          model: "test-model",
        }),
      })

      const response = await POST(request)
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      let errorFound = false
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        if (text.includes("error")) {
          errorFound = true
        }
      }
      
      expect(errorFound).toBe(true)
    })
  })

  describe("model configuration", () => {
    it("should use the specified model", async () => {
      const { streamObject } = await import("ai")
      
      vi.mocked(streamObject).mockReturnValue({
        partialObjectStream: (async function* () {})(),
        object: Promise.resolve({ title: "", authors: [], abstract: "", sections: [] }),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({
          pdfBase64: "data",
          model: "anthropic/claude-haiku-4.5",
        }),
      })

      await POST(request)
      
      expect(streamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "anthropic/claude-haiku-4.5",
        })
      )
    })

    it("should default to Claude Sonnet 4.5 if no model specified", async () => {
      const { streamObject } = await import("ai")
      
      vi.mocked(streamObject).mockReturnValue({
        partialObjectStream: (async function* () {})(),
        object: Promise.resolve({ title: "", authors: [], abstract: "", sections: [] }),
      } as any)

      const request = new Request("http://localhost/api/parse-paper?stream=true", {
        method: "POST",
        body: JSON.stringify({ pdfBase64: "data" }),
      })

      await POST(request)
      
      expect(streamObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "anthropic/claude-sonnet-4.5",
        })
      )
    })
  })
})
