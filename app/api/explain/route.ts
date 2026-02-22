import { consumeStream, convertToModelMessages, streamText, UIMessage } from "ai"
import { buildExplainSystemPrompt, type DifficultyLevel } from "@/lib/prompts"

export const maxDuration = 300

export async function POST(req: Request) {
  const startTime = Date.now()
  
  const {
    messages,
    paperTitle,
    paperAbstract,
    sectionHeading,
    sectionContent,
    previousSectionsContext,
    difficultyLevel,
    model,
    persona,
    goal,
    tone,
  }: {
    messages: UIMessage[]
    paperTitle: string
    paperAbstract?: string
    sectionHeading: string
    sectionContent: string
    previousSectionsContext?: string
    difficultyLevel?: DifficultyLevel
    model?: string
    persona?: string
    goal?: string
    tone?: string
  } = await req.json()

  console.log("[v0] Explain request started", {
    paperTitle,
    sectionHeading,
    contentLength: sectionContent?.length || 0,
    difficultyLevel: difficultyLevel || "advanced",
    messageCount: messages.length,
    hasPreviousContext: !!previousSectionsContext,
    requestedModel: model,
    timestamp: new Date().toISOString(),
  })

  const systemPrompt = buildExplainSystemPrompt(
    paperTitle,
    paperAbstract || "",
    sectionHeading,
    sectionContent,
    previousSectionsContext || "",
    difficultyLevel || "advanced",
    persona != null || goal != null || tone != null ? { persona, goal, tone } : undefined
  )

  const selectedModel = model || "anthropic/claude-haiku-4.5"
  console.log("[v0] Using model:", selectedModel)

  try {
    const result = streamText({
      model: selectedModel,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
    })

    console.log("[v0] Explain stream started", {
      duration: `${Date.now() - startTime}ms`,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      consumeSseStream: consumeStream,
    })
  } catch (error) {
    console.error("[v0] Explain error:", {
      error,
      duration: `${Date.now() - startTime}ms`,
      message: error instanceof Error ? error.message : "Unknown error",
    })
    throw error
  }
}
