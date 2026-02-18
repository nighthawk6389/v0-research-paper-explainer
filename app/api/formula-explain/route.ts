import { consumeStream, convertToModelMessages, streamText, UIMessage } from "ai"

export const maxDuration = 300

export async function POST(req: Request) {
  const {
    messages,
    latex,
    paperTitle,
    sectionContext,
  }: {
    messages: UIMessage[]
    latex: string
    paperTitle: string
    sectionContext: string
  } = await req.json()

  console.log("[v0] Formula explain request", {
    paperTitle,
    latexLength: latex?.length || 0,
    messageCount: messages.length,
    timestamp: new Date().toISOString(),
  })

  const systemPrompt = `You are a concise math tutor. Your job is to briefly explain a mathematical formula from the paper "${paperTitle}".

THE FORMULA (LaTeX):
${latex}

SURROUNDING CONTEXT:
${sectionContext}

INSTRUCTIONS:
- Be concise and direct. Keep your explanation to 2-4 short paragraphs.
- Start by stating what the equation computes or represents in plain language.
- Then list each symbol/variable and what it means, using inline LaTeX ($...$) for the symbols.
- If there's a key insight or intuition, mention it in one sentence.
- Do NOT use Wolfram Alpha or any tools. Just explain clearly.
- Use LaTeX ($...$) for inline math and ($$...$$) for display math where needed.
- Do NOT restate the full equation unless necessary.`

  const selectedModel = "anthropic/claude-haiku-4.5"

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
