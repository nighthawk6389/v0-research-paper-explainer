import { generateText, Output } from "ai"
import { z } from "zod"

export const maxDuration = 300

const slideSchema = z.object({
  title: z.string(),
  bullets: z.array(z.string()),
  speakerNotes: z.string().optional(),
})

const slidesOutputSchema = z.object({
  title: z.string(),
  slides: z.array(slideSchema),
})

export async function POST(req: Request) {
  const {
    paperText,
    persona,
    goal,
    tone,
    difficulty,
    model,
    slideCount = 6,
  }: {
    paperText: string
    persona?: string
    goal?: string
    tone?: string
    difficulty?: string
    model?: string
    slideCount?: number
  } = await req.json()

  const systemPrompt = `You are an expert at creating slide outlines for research paper presentations. Create a slide deck outline in JSON.

PAPER CONTENT:
---
${paperText}
---

Create exactly ${Math.min(12, Math.max(5, slideCount))} slides. Each slide has: title (string), bullets (array of strings), speakerNotes (optional string).
Return a JSON object with: title (deck title), slides (array of slide objects).
${persona ? `AUDIENCE: "${persona}".\n` : ""}${goal ? `GOAL: ${goal}.\n` : ""}${tone ? `TONE: ${tone}.\n` : ""}

Output ONLY valid JSON, no markdown or explanation.`

  const selectedModel = model || "anthropic/claude-haiku-4.5"

  const { output } = await generateText({
    model: selectedModel,
    system: systemPrompt,
    messages: [{ role: "user", content: "Generate the slide outline as JSON." }],
    output: Output.object({ schema: slidesOutputSchema }),
    abortSignal: req.signal,
  })

  return Response.json(output)
}
