import type { Paper } from "@/lib/paper-schema"

export interface SseEventData {
  paper?: Paper
  fetchFailed?: boolean
  error?: string
  message?: string
  detail?: string
}

export type SseEventCount = { status: number; complete: number; error: number; other: number }

export function parseSseData(rawData: string, event: string, eventCount: SseEventCount): SseEventData | null {
  try {
    return JSON.parse(rawData) as SseEventData
  } catch (parseErr) {
    console.error("[v0] SSE data parse failed", {
      event,
      rawDataSnippet: rawData.slice(0, 120),
      error: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
    if (event === "error") {
      throw new Error("Failed to parse paper")
    }
    eventCount.other++
    return null
  }
}

export function validatePaper(data: SseEventData): Paper {
  if (!data?.paper) {
    console.error("[v0] Complete event has no paper data", { data })
    throw new Error("Parse completed but no paper data received")
  }
  if (!Array.isArray(data.paper.sections)) {
    console.error("[v0] Paper sections is not an array", {
      sectionsType: typeof data.paper.sections,
    })
    throw new Error("Paper sections are not in the expected format")
  }
  return data.paper
}

export interface StreamCallbacks {
  onStatus: (data: SseEventData) => void
  onComplete: (paper: Paper) => Promise<void>
  onFetchError: () => void
}

function parseEventBlock(block: string): { event: string; data: string } | null {
  let event = ""
  let data = ""
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      data = line.slice(5).trim()
    }
  }
  if (!event) return null
  return { event, data }
}

export async function readParseStream(response: Response, callbacks: StreamCallbacks): Promise<void> {
  if (!response.body) {
    throw new Error("Failed to start analysis")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let receivedComplete = false
  const eventCount: SseEventCount = { status: 0, complete: 0, error: 0, other: 0 }
  let chunkIndex = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        // Process any remaining complete event in the buffer
        if (buffer.trim()) {
          const result = processEventBlock(buffer, eventCount, callbacks)
          if (result === "complete") {
            receivedComplete = true
            return
          }
          if (result === "return") return
        }

        console.log("[v0] SSE stream ended", {
          receivedComplete,
          eventCount,
          bufferLength: buffer.length,
          remainingBuffer: buffer.slice(0, 200),
        })
        break
      }

      chunkIndex++
      buffer += decoder.decode(value, { stream: true })

      // SSE events are delimited by double newlines
      const parts = buffer.split("\n\n")
      // Keep the last (potentially incomplete) part in the buffer
      buffer = parts.pop() || ""

      if (parts.length > 0 && chunkIndex <= 3) {
        console.log("[v0] SSE chunk", { chunkIndex, eventCount: parts.length, firstPart: parts[0]?.slice(0, 80) })
      }

      for (const block of parts) {
        const trimmed = block.trim()
        if (!trimmed) continue

        const result = processEventBlock(trimmed, eventCount, callbacks)
        if (result === "complete") {
          receivedComplete = true
          return
        }
        if (result === "return") return
      }
    }

    if (!receivedComplete) {
      console.error("[v0] Stream ended without complete — throwing timeout", { eventCount, receivedComplete })
      throw new Error(
        "Paper analysis timed out. The paper may be too large or complex. Try using a faster model like Claude Haiku 4.5, or try again later."
      )
    }
  } finally {
    reader.releaseLock()
  }
}

type EventResult = "complete" | "return" | "continue"

function processEventBlock(
  block: string,
  eventCount: SseEventCount,
  callbacks: StreamCallbacks
): EventResult {
  const parsed = parseEventBlock(block)
  if (!parsed) return "continue"

  const { event, data: rawData } = parsed

  if (!rawData) {
    if (event === "complete") {
      console.warn("[v0] Complete event with no data", { block: block.slice(0, 100) })
    }
    eventCount.other++
    return "continue"
  }

  const data = parseSseData(rawData, event, eventCount)
  if (!data) {
    if (event === "complete") {
      throw new Error("Parse completed but no paper data received")
    }
    return "continue"
  }

  if (event === "status") {
    eventCount.status++
    if (eventCount.status <= 2 || data.message) {
      console.log("[v0] SSE status", { eventCount: eventCount.status, message: data.message, detail: data.detail })
    }
    callbacks.onStatus(data)
  } else if (event === "complete") {
    eventCount.complete++
    console.log("[v0] SSE complete received", {
      eventCount: eventCount.complete,
      hasPaper: !!data?.paper,
      sectionsLength: data?.paper?.sections?.length,
    })
    const paper = validatePaper(data)
    console.log("[v0] Setting paper state", { title: paper.title, sections: paper.sections.length })
    callbacks.onComplete(paper)
    return "complete"
  } else if (event === "error") {
    eventCount.error++
    console.log("[v0] SSE error received", { eventCount: eventCount.error, fetchFailed: data.fetchFailed, error: data.error })
    if (data.fetchFailed) {
      callbacks.onFetchError()
      return "return"
    }
    throw new Error(data.error || "Failed to parse paper")
  } else {
    eventCount.other++
    console.warn("[v0] SSE unknown event type", { event, keys: Object.keys(data).slice(0, 5) })
  }

  return "continue"
}
