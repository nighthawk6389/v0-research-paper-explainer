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
  const startTime = Date.now()
  
  const {
    messages,
    latex,
    sectionContext,
    paperTitle,
    model,
    persona,
    goal,
    tone,
  }: {
    messages: UIMessage[]
    latex: string
    sectionContext: string
    paperTitle: string
    model?: string
    persona?: string
    goal?: string
    tone?: string
  } = await req.json()

  console.log("[v0] Deep-dive request started", {
    paperTitle,
    latexLength: latex?.length || 0,
    latexPreview: latex ? latex.substring(0, 50) + (latex.length > 50 ? "..." : "") : "EMPTY",
    messageCount: messages.length,
    requestedModel: model,
    timestamp: new Date().toISOString(),
  })

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
      console.log("[v0] Wolfram Alpha query:", { query, purpose })
      const wolframStartTime = Date.now()
      
      const result = await queryWolframAlpha(query)
      
      console.log("[v0] Wolfram Alpha result:", {
        query,
        success: result.success,
        duration: `${Date.now() - wolframStartTime}ms`,
        podCount: result.pods.length,
        hasError: !!result.error,
      })
      
      const images = result.pods
        .flatMap((p) => p.subpods)
        .filter((s) => s.img)
        .map((s) => ({
          title: s.title,
          src: s.img!.src,
          alt: s.img!.alt,
          width: s.img!.width,
          height: s.img!.height,
        }))

      console.log("[v0] Wolfram tool returning:", {
        success: result.success,
        podCount: result.pods.length,
        imageCount: images.length,
        imageSrcs: images.map(i => i.src.substring(0, 60)),
      })

      return {
        query,
        purpose,
        success: result.success,
        inputInterpretation: result.inputInterpretation,
        markdown: formatWolframResultAsMarkdown(result),
        error: result.error,
        images,
        // Also include raw pods for richer display
        pods: result.pods,
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

IMPORTANT FORMATTING RULES:
- DO NOT output your thinking or planning (e.g., "Let me explore...", "Now let me...", "Great!"). Just make tool calls silently.
- Start your response directly with the explanation, not with meta-commentary about what you're about to do.
- Use proper markdown formatting with blank lines between sections.
- Use ## for section headers, and ensure there's a blank line before and after headers.
- When transitioning between topics, use clear section breaks with headers.

Be thorough but accessible. Aim for "aha!" moments where computation illuminates theory.${[persona, goal, tone].filter(Boolean).length ? `\n\nAUDIENCE/GOAL: ${persona ? `Explain for "${persona}". ` : ""}${goal ? `Goal: ${goal}. ` : ""}${tone ? `Tone: ${tone}.` : ""}` : ""}`

  const selectedModel = model || "anthropic/claude-haiku-4.5"
  console.log("[v0] Using model:", selectedModel)

  try {
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

    console.log("[v0] Deep-dive stream started", {
      duration: `${Date.now() - startTime}ms`,
    })

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      consumeSseStream: consumeStream,
    })
  } catch (error) {
    console.error("[v0] Deep-dive error:", {
      error,
      duration: `${Date.now() - startTime}ms`,
      message: error instanceof Error ? error.message : "Unknown error",
    })
    throw error
  }
}
