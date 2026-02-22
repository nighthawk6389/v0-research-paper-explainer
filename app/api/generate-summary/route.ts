import { streamText } from "ai"

export const maxDuration = 300

export async function POST(req: Request) {
  const {
    paperText,
    persona,
    goal,
    tone,
    difficulty,
    model,
  }: {
    paperText: string
    persona?: string
    goal?: string
    tone?: string
    difficulty?: string
    model?: string
  } = await req.json()

  const systemPrompt = `You are an expert at summarizing research papers. Generate a structured summary in markdown.

PAPER CONTENT:
---
${paperText}
---

OUTPUT STRUCTURE:
1. **Big idea** — One paragraph on the main contribution.
2. **Method** — How the authors approach the problem.
3. **Results** — Key findings and outcomes.
4. **Limitations** — Important caveats or limitations.
5. **Key terms** — Definitions of 3–5 important terms.
6. **5 bullet takeaways** — Concise bullet points.

${persona ? `AUDIENCE: Write for "${persona}".\n` : ""}${goal ? `GOAL: ${goal}.\n` : ""}${tone ? `TONE: ${tone}.\n` : ""}${difficulty ? `DIFFICULTY: ${difficulty}.\n` : ""}

Use clear markdown (headers, bullets). Do not use code fences.`

  const selectedModel = model || "anthropic/claude-haiku-4.5"

  const result = streamText({
    model: selectedModel,
    system: systemPrompt,
    messages: [{ role: "user", content: "Generate the summary." }],
    abortSignal: req.signal,
  })

  return new Response(result.textStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
