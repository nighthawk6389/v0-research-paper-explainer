import { describe, it, expect, vi } from "vitest"
import { readParseStream, parseSseData, validatePaper } from "./sse-stream"
import type { SseEventCount, SseEventData, StreamCallbacks } from "./sse-stream"
import type { Paper } from "./paper-schema"

const mockPaper: Paper = {
  title: "Test Paper",
  authors: ["Author 1"],
  abstract: "Test abstract",
  sections: [
    {
      id: "section-0",
      heading: "Introduction",
      type: "text",
      content: [{ type: "text", value: "Content", label: null, isInline: null }],
      pageNumbers: [1],
    },
  ],
}

function makeSSE(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function createMockResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let chunkIndex = 0

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(encoder.encode(chunks[chunkIndex]))
        chunkIndex++
      } else {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  })
}

function createCallbacks() {
  const onStatus = vi.fn()
  const onComplete = vi.fn().mockResolvedValue(undefined)
  const onFetchError = vi.fn()
  return { onStatus, onComplete, onFetchError } satisfies StreamCallbacks
}

// --- parseSseData ---

describe("parseSseData", () => {
  it("should parse valid JSON data", () => {
    const eventCount: SseEventCount = { status: 0, complete: 0, error: 0, other: 0 }
    const result = parseSseData('{"message":"hello"}', "status", eventCount)
    expect(result).toEqual({ message: "hello" })
  })

  it("should return null for invalid JSON on non-error events", () => {
    const eventCount: SseEventCount = { status: 0, complete: 0, error: 0, other: 0 }
    const result = parseSseData("not json", "status", eventCount)
    expect(result).toBeNull()
    expect(eventCount.other).toBe(1)
  })

  it("should throw for invalid JSON on error events", () => {
    const eventCount: SseEventCount = { status: 0, complete: 0, error: 0, other: 0 }
    expect(() => parseSseData("not json", "error", eventCount)).toThrow("Failed to parse paper")
  })
})

// --- validatePaper ---

describe("validatePaper", () => {
  it("should return paper when data contains valid paper", () => {
    const data: SseEventData = { paper: mockPaper }
    const result = validatePaper(data)
    expect(result).toBe(mockPaper)
  })

  it("should throw when data has no paper", () => {
    expect(() => validatePaper({})).toThrow("Parse completed but no paper data received")
  })

  it("should throw when paper sections is not an array", () => {
    const badPaper = { ...mockPaper, sections: "not-array" } as any
    expect(() => validatePaper({ paper: badPaper })).toThrow("Paper sections are not in the expected format")
  })
})

// --- readParseStream ---

describe("readParseStream", () => {
  it("should throw when response has no body", async () => {
    const response = { body: null } as Response
    const callbacks = createCallbacks()
    await expect(readParseStream(response, callbacks)).rejects.toThrow("Failed to start analysis")
  })

  describe("normal single-chunk scenarios", () => {
    it("should handle a complete event with paper data in one chunk", async () => {
      const sseData = makeSSE("complete", { paper: mockPaper })
      const response = createMockResponse([sseData])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
      expect(callbacks.onComplete).toHaveBeenCalledTimes(1)
    })

    it("should handle status events followed by complete", async () => {
      const chunk =
        makeSSE("status", { message: "Starting..." }) +
        makeSSE("status", { message: "Parsing..." }) +
        makeSSE("complete", { paper: mockPaper })

      const response = createMockResponse([chunk])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onStatus).toHaveBeenCalledTimes(2)
      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
    })

    it("should handle error event with fetchFailed", async () => {
      const chunk = makeSSE("error", { fetchFailed: true, error: "Access denied" })
      const response = createMockResponse([chunk])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onFetchError).toHaveBeenCalledTimes(1)
      expect(callbacks.onComplete).not.toHaveBeenCalled()
    })

    it("should throw on error event without fetchFailed", async () => {
      const chunk = makeSSE("error", { error: "Something went wrong" })
      const response = createMockResponse([chunk])
      const callbacks = createCallbacks()

      await expect(readParseStream(response, callbacks)).rejects.toThrow("Something went wrong")
    })
  })

  describe("multi-chunk scenarios", () => {
    it("should handle status and complete in separate chunks", async () => {
      const chunk1 = makeSSE("status", { message: "Starting..." })
      const chunk2 = makeSSE("complete", { paper: mockPaper })

      const response = createMockResponse([chunk1, chunk2])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onStatus).toHaveBeenCalledTimes(1)
      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
    })

    it("should handle each SSE line in a separate chunk", async () => {
      const response = createMockResponse([
        "event: complete\n",
        `data: ${JSON.stringify({ paper: mockPaper })}\n`,
        "\n",
      ])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
    })
  })

  describe("chunk-split edge cases (THE BUG)", () => {
    it("should handle complete event split across chunks: event line in one, data line in next", async () => {
      const response = createMockResponse([
        makeSSE("status", { message: "Parsing..." }) + "event: complete\n",
        `data: ${JSON.stringify({ paper: mockPaper })}\n\n`,
      ])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
    })

    it("should handle complete event where event+data arrive in separate chunks with no other events", async () => {
      const response = createMockResponse([
        "event: complete\n",
        `data: ${JSON.stringify({ paper: mockPaper })}\n\n`,
      ])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
    })

    it("should handle complete event split mid-data JSON", async () => {
      const json = JSON.stringify({ paper: mockPaper })
      const midpoint = Math.floor(json.length / 2)

      const response = createMockResponse([
        `event: complete\ndata: ${json.slice(0, midpoint)}`,
        `${json.slice(midpoint)}\n\n`,
      ])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onComplete).toHaveBeenCalledWith(mockPaper)
    })
  })

  describe("stream termination", () => {
    it("should throw timeout when stream ends without complete event", async () => {
      const chunk = makeSSE("status", { message: "Starting..." })
      const response = createMockResponse([chunk])
      const callbacks = createCallbacks()

      await expect(readParseStream(response, callbacks)).rejects.toThrow("Paper analysis timed out")
    })

    it("should handle empty stream", async () => {
      const response = createMockResponse([])
      const callbacks = createCallbacks()

      await expect(readParseStream(response, callbacks)).rejects.toThrow("Paper analysis timed out")
    })

    it("should not throw when complete event was received (even without data processing)", async () => {
      const chunk = makeSSE("complete", { paper: mockPaper })
      const response = createMockResponse([chunk])
      const callbacks = createCallbacks()

      await readParseStream(response, callbacks)

      expect(callbacks.onComplete).toHaveBeenCalled()
    })
  })
})
