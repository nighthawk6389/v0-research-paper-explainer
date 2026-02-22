import { generateText, Output } from "ai"
import { z } from "zod"

export const maxDuration = 300

const cardSchema = z.object({
  front: z.string(),
  back: z.string(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
})

const flashcardsOutputSchema = z.object({
  cards: z.array(cardSchema),
})

export async function POST(req: Request) {
  const {
    paperText,
    persona,
    goal,
    tone,
    difficulty,
    model,
    flashcardCount = 12,
  }: {
    paperText: string
    persona?: string
    goal?: string
    tone?: string
    difficulty?: string
    model?: string
    flashcardCount?: number
  } = await req.json()

  const count = Math.min(30, Math.max(5, flashcardCount))

  const systemPrompt = `You are an expert at creating study flashcards from research papers. Create flashcards in JSON.

PAPER CONTENT:
---
${paperText}
---

Create exactly ${count} flashcards. Each card has: front (question or term), back (answer or definition), tags (optional array of strings), difficulty (optional: "easy"|"medium"|"hard").
Return a JSON object with: cards (array of card objects).
${persona ? `AUDIENCE: "${persona}".\n` : ""}${goal ? `GOAL: ${goal}.\n` : ""}${tone ? `TONE: ${tone}.\n` : ""}

Output ONLY valid JSON, no markdown or explanation.`

  const selectedModel = model || "anthropic/claude-haiku-4.5"

  const { output } = await generateText({
    model: selectedModel,
    system: systemPrompt,
    messages: [{ role: "user", content: "Generate the flashcards as JSON." }],
    output: Output.object({ schema: flashcardsOutputSchema }),
    abortSignal: req.signal,
  })

  return Response.json(output)
}
