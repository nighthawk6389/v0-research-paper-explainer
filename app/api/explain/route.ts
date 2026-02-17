import { consumeStream, convertToModelMessages, streamText, UIMessage } from "ai"
import { buildExplainSystemPrompt, type DifficultyLevel } from "@/lib/prompts"

export const maxDuration = 30

export async function POST(req: Request) {
  const {
    messages,
    paperTitle,
    sectionHeading,
    sectionContent,
    difficultyLevel,
  }: {
    messages: UIMessage[]
    paperTitle: string
    sectionHeading: string
    sectionContent: string
    difficultyLevel?: DifficultyLevel
  } = await req.json()

  const systemPrompt = buildExplainSystemPrompt(
    paperTitle,
    sectionHeading,
    sectionContent,
    difficultyLevel || "advanced"
  )

  const result = streamText({
    model: "anthropic/claude-sonnet-4-20250514",
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
