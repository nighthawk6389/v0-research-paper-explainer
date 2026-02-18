import {
  consumeStream,
  convertToModelMessages,
  streamText,
  tool,
  UIMessage,
  stepCountIs,
} from "ai"
import { z } from "zod"
import {
  queryWolframAlpha,
  formatWolframResultAsMarkdown,
} from "@/lib/wolfram-alpha"

export const maxDuration = 300

export async function POST(req: Request) {
  const {
    messages,
    latex,
    sectionContext,
    paperTitle,
    model,
  }: {
    messages: UIMessage[]
    latex: string
    sectionContext: string
    paperTitle: string
    model?: string
  } = await req.json()

  const wolframAlphaTool = tool({
    description:
      "Query Wolfram Alpha for mathematical computations, derivations, plots, simplifications, and analysis. You should translate the paper's LaTeX notation into a query Wolfram Alpha understands. Wolfram uses standard math input, NOT LaTeX. For example: 'solve x^2 + 3x - 4 = 0', 'derivative of sin(x)*e^x', 'integrate x^2 from 0 to 1', 'simplify (a+b)^3', 'plot sin(x)/x from -10 to 10', 'eigenvalues {{1,2},{3,4}}'. You can make multiple queries for different aspects of the same equation.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The Wolfram Alpha query in standard math notation (NOT LaTeX). Be specific about what you want: solve, simplify, derive, integrate, plot, etc."
        ),
      purpose: z
        .string()
        .describe(
          "Brief explanation of why you're making this query, e.g. 'Solving for x', 'Finding the derivative', 'Visualizing the function'"
        ),
    }),
    execute: async ({ query, purpose }) => {
      const result = await queryWolframAlpha(query)
      return {
        query,
        purpose,
        success: result.success,
        inputInterpretation: result.inputInterpretation,
        markdown: formatWolframResultAsMarkdown(result),
        error: result.error,
        // Include image URLs for pods that have them
        images: result.pods
          .flatMap((p) => p.subpods)
          .filter((s) => s.img)
          .map((s) => ({
            title: s.title,
            src: s.img!.src,
            alt: s.img!.alt,
          })),
      }
    },
  })

  const systemPrompt = `You are a mathematical deep-dive assistant that helps users understand equations from research papers. You have access to Wolfram Alpha as a computation tool.

CONTEXT:
Paper: "${paperTitle}"
The equation under analysis (in LaTeX): ${latex}
Surrounding context from the paper:
---
${sectionContext}
---

YOUR ROLE:
1. First, explain what this equation represents and what each term means.
2. Use Wolfram Alpha strategically to:
   - Show step-by-step derivations or simplifications
   - Plot functions to build visual intuition
   - Verify mathematical properties (convergence, bounds, etc.)
   - Solve special cases to build understanding
   - Compute examples with concrete numbers
3. When translating LaTeX to Wolfram Alpha queries:
   - Convert \\frac{a}{b} to a/b
   - Convert \\sum_{i=0}^{n} to sum(expression, i, 0, n)
   - Convert \\int_{a}^{b} to integrate(expression, x, a, b)
   - Convert Greek letters: \\alpha to alpha, \\theta to theta, etc.
   - Convert \\partial to partial derivative notation
   - Remove custom notation that Wolfram won't understand
4. You can make MULTIPLE Wolfram Alpha queries to explore different aspects.
5. After getting Wolfram results, synthesize them into a clear explanation.
6. Use LaTeX ($...$ for inline, $$...$$ for display) in your own explanations.
7. If Wolfram Alpha fails for a query, explain the math yourself or try a simpler query.
8. Include any Wolfram Alpha plots/images in your response — they are very helpful for intuition.

Be thorough but accessible. Aim for "aha!" moments where computation illuminates theory.`

  const selectedModel = model || "anthropic/claude-sonnet-4.5"

  const result = streamText({
    model: selectedModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      wolframAlpha: wolframAlphaTool,
    },
    stopWhen: stepCountIs(8),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
