import { consumeStream, convertToModelMessages, streamText, UIMessage } from "ai"
import { buildExplainSystemPrompt, type DifficultyLevel } from "@/lib/prompts"

export const maxDuration = 30

export async function POST(req: Request) {
  const {
    messages,
    paperTitle,
    paperAbstract,
    sectionHeading,
    sectionContent,
    previousSectionsContext,
    difficultyLevel,
    model,
  }: {
    messages: UIMessage[]
    paperTitle: string
    paperAbstract?: string
    sectionHeading: string
    sectionContent: string
    previousSectionsContext?: string
    difficultyLevel?: DifficultyLevel
    model?: string
  } = await req.json()

  const systemPrompt = buildExplainSystemPrompt(
    paperTitle,
    paperAbstract || "",
    sectionHeading,
    sectionContent,
    previousSectionsContext || "",
    difficultyLevel || "advanced"
  )

  const selectedModel = model || "anthropic/claude-sonnet-4.5-20250219"

  const result = streamText({
    model: selectedModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
