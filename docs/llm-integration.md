# LLM and External Tool Integration

This document details how Paper Explainer leverages large language models and external APIs to parse and explain research papers.

## Overview

The application uses four primary integration points:

1. **PDF Parsing**: LLM with structured output (AI SDK `streamText()` + `Output.object()`, streaming partial results)
2. **Section Explanation**: Streaming chat with difficulty-aware prompting (AI SDK `streamText()`)
3. **Inline Formula Explain**: Short streaming explanations for inline math (AI SDK `streamText()`)
4. **Mathematical Analysis**: Tool-calling agent with Wolfram Alpha (AI SDK tools + external API)

## 1. PDF Parsing with Structured Output

### Implementation: `/app/api/parse-paper/route.ts`

**Core Technology**: AI SDK 6's `Output.object()` with Zod schema

**Why This Approach?**
- Traditional PDF parsers (pdf-parse, pdfjs-gettext) break on complex math notation
- LLMs can read PDFs natively and understand semantic structure
- Structured output ensures consistent JSON response format
- Multi-modal models handle equations better than text extraction

### Flow

When streaming is enabled (`?stream=true`), the parse API uses `streamText()` with `Output.object()` so partial results can be sent as the LLM produces them:

```typescript
import { streamText, Output } from "ai"
import { paperSchema } from "@/lib/paper-schema"

const result = streamText({
  model: selectedModel, // e.g. anthropic/claude-haiku-4.5
  output: Output.object({
    schema: paperSchema, // Zod schema
  }),
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: PARSE_PAPER_PROMPT },
        {
          type: "file",
          data: pdfBase64,
          mediaType: "application/pdf",
          filename: "paper.pdf",
        },
      ],
    },
  ],
})

// Stream progress: send status events when section count increases
for await (const partialObject of result.partialOutputStream) {
  const sectionCount = partialObject?.sections?.length || 0
  if (sectionCount > lastSectionCount) {
    send("status", { message: "Parsing...", detail: `Extracted ${sectionCount} sections` })
    lastSectionCount = sectionCount
  }
}

const output = await result.output
```

The non-streaming fallback uses `generateText()` with the same `Output.object()` and schema.

### Key Features

**1. Native PDF Understanding**
- Send PDF directly as file attachment
- No intermediate text extraction step
- Preserves visual layout context

**2. Zod Schema Validation**
```typescript
const paperSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      content: z.array(
        z.object({
          type: z.enum(["text", "math"]),
          value: z.string(),
          isInline: z.boolean().optional(),
        })
      ),
      pageNumbers: z.array(z.number()),
    })
  ),
})
```

**3. Granular Section Extraction**
The prompt instructs the LLM to break papers into paragraph-level chunks:
```
"3. Methodology" → [
  "3. Methodology" (intro),
  "3. Methodology — Data Preprocessing",
  "3. Methodology — Eq. (4): Loss Function",
  "3. Methodology — Optimization"
]
```

Aim: 30-60 sections for a 10-page paper (vs 5-10 with traditional section headers)

### Prompt Engineering

**Critical Prompt Elements** (`lib/prompts.ts`):

1. **Output Format Specification**
   - Explicit JSON structure expectations
   - Field-by-field requirements
   - Examples of desired output

2. **Math Preservation Rules**
   - "Keep equations as COMPLETE expressions"
   - "Never break E = mc^2 into individual symbols"
   - "Use standard LaTeX notation"

3. **Section Boundaries**
   - Extract only abstract to references
   - Exclude headers, affiliations, bibliography
   - Include conclusion before references

4. **Page Number Tracking**
   - 1-indexed page numbers
   - Track which pages each section spans

### Streaming Progress Updates

Challenge: Parsing takes 30-60 seconds with no feedback

Solution: Server-Sent Events (SSE) for progress

```typescript
// Create SSE stream
const { stream, send, close } = createSSEStream()

send("status", {
  message: "Asking Claude very nicely...",
  detail: "Sending PDF with a 2000+ word prompt",
  model: "Claude Sonnet 4",
})

// Execute parsing (async)
const result = await generateText(...)

send("complete", { paper: result.output })
close()
```

Client receives updates:
```typescript
event: status
data: {"message": "Claude is reading...", "detail": "..."}

event: complete
data: {"paper": {...}}
```

### Model Selection

Users can choose between:
- **Claude Haiku 4.5** (default, fast and cost-effective)
- **Claude Sonnet 4.5** (best balance of speed and quality)
- **GPT-4o** (fast, good for many papers)
- **GPT-4o Mini** (cheapest, good for simple papers)
- **Claude Opus 4** (highest quality, most expensive)

Model name dynamically updates in status messages:
```typescript
const modelName = modelDisplayNames[selectedModel]
send("status", { message: `${modelName} is reading...`, detail: "...", model: "..." })
```

### Cost Analysis

Typical 10-page paper:
- Input tokens: 40,000-80,000 (entire PDF)
- Output tokens: 5,000-15,000 (structured sections)
- Cost: $0.10-0.30 per paper (Claude Sonnet 4)

## 2. Section Explanation with Streaming

### Implementation: `/app/api/explain/route.ts`

**Core Technology**: AI SDK 6's `streamText()` with difficulty-aware prompts

**Why This Approach?**
- Explanations can be 1000+ tokens (slow to wait for full response)
- Streaming provides immediate feedback
- `useChat` hook handles streaming automatically
- Difficulty levels tailor complexity to user background

### Flow

```typescript
import { streamText, convertToModelMessages } from "ai"
import { buildExplainSystemPrompt } from "@/lib/prompts"

const systemPrompt = buildExplainSystemPrompt(
  paperTitle,
  sectionHeading,
  sectionContent,
  difficultyLevel // "basic" | "advanced" | "phd"
)

const result = streamText({
  model: "anthropic/claude-sonnet-4-20250514",
  system: systemPrompt,
  messages: await convertToModelMessages(messages),
})

return result.toUIMessageStreamResponse()
```

### Difficulty Levels

**Basic (Undergraduate)**
```
- Use everyday analogies and concrete examples
- Define ALL technical terms in simple language
- Break equations into simplest components
- Emphasize intuition over rigor
```

**Advanced (College-level, default)**
```
- Rigorous mathematical details
- Explain advanced notation (∇, ∂, Σ, ∫)
- Walk through each step with intuition
- Balance rigor with conceptual understanding
```

**PhD Level**
```
- Theoretical implications
- Connections to related work
- Proof techniques and derivations
- Assume graduate-level maturity
```

### Dynamic Regeneration

When user changes difficulty level:
```typescript
useEffect(() => {
  if (difficultyLevel !== currentDifficultyRef.current) {
    currentDifficultyRef.current = difficultyLevel
    setMessages([]) // Clear chat
    hasInitiatedRef.current = false // Trigger new explanation
  }
}, [difficultyLevel])
```

### Client-Side Chat Integration

```typescript
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"

const { messages, sendMessage, isStreaming } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/explain",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: {
        messages,
        paperTitle,
        sectionHeading,
        sectionContent,
        difficultyLevel,
      },
    }),
  }),
})
```

### Follow-up Questions

After initial explanation, users can ask:
- "Can you explain equation (3) more slowly?"
- "How does this relate to the previous section?"
- "What are the assumptions here?"

The LLM maintains context from the system prompt and section content.

### Cost Analysis

Per explanation:
- Input: 2,000-4,000 tokens (system + section + history)
- Output: 1,000-3,000 tokens (explanation)
- Cost: $0.02-0.08 per explanation

## 3. Inline Formula Explain

### Implementation: `/app/api/formula-explain/route.ts`

**Core Technology**: AI SDK's `streamText()` with a concise, non-tool system prompt.

Used when the user clicks an inline equation inside an explanation. The modal/section explain flow uses **InlineFormulaExplain** (e.g. popover) which calls this API with the LaTeX, paper title, and section context. The prompt instructs the model to give 2–4 short paragraphs, define symbols, and not use tools. Responses are streamed like the main explain endpoint.

**Request body**: `{ messages, latex, paperTitle, sectionContext }`. Model is fixed (e.g. Claude Haiku 4.5) for speed and cost.

## 4. Wolfram Alpha Deep Dive (Tool-Calling Agent)

### Implementation: `/app/api/deep-dive/route.ts`

**Core Technology**: AI SDK 6 tools + Wolfram Alpha Full Results API

**Why This Approach?**
- Direct LaTeX → Wolfram conversion is brittle (notation ambiguity)
- LLM handles context translation ("what does this symbol mean in this paper?")
- Tool-calling lets LLM decide WHAT to query and HOW to interpret results
- Multiple queries possible (solve, plot, simplify, expand, etc.)

### Tool Definition

```typescript
import { tool } from "ai"
import { z } from "zod"
import { queryWolframAlpha } from "@/lib/wolfram-alpha"

const wolframAlpha = tool({
  description: `Query Wolfram Alpha for mathematical analysis, step-by-step solutions, plots, and symbolic manipulation.`,
  inputSchema: z.object({
    query: z.string().describe("Natural language or mathematical query"),
    purpose: z.string().describe("What you're trying to find out"),
  }),
  execute: async ({ query, purpose }) => {
    const result = await queryWolframAlpha(query)
    return {
      success: result.success,
      pods: result.pods,
      purpose,
    }
  },
})
```

### Agent Setup

```typescript
const result = streamText({
  model: "anthropic/claude-sonnet-4-20250514",
  system: DEEP_DIVE_SYSTEM_PROMPT,
  messages: await convertToModelMessages(messages),
  tools: { wolframAlpha },
  stopWhen: stepCountIs(8), // Limit tool loops
})
```

### LLM Decision Making

Given equation: `$$\nabla \cdot \mathbf{E} = \frac{\rho}{\epsilon_0}$$`

LLM might call tool 3 times:
1. `wolframAlpha("explain Gauss's law in differential form", "Understand physical meaning")`
2. `wolframAlpha("solve nabla dot E = rho/epsilon_0 for E", "Find electric field")`
3. `wolframAlpha("plot electric field point charge", "Visualize")`

### Wolfram Alpha API Integration

**lib/wolfram-alpha.ts**

```typescript
export async function queryWolframAlpha(query: string) {
  const url = new URL("https://api.wolframalpha.com/v2/query")
  url.searchParams.append("appid", process.env.WOLFRAM_ALPHA_APP_ID!)
  url.searchParams.append("input", query)
  url.searchParams.append("format", "plaintext,image")
  url.searchParams.append("output", "json")

  const response = await fetch(url.toString())
  const data = await response.json()

  // Parse pods (result sections)
  const pods = data.queryresult?.pods?.map((pod: any) => ({
    title: pod.title,
    content: pod.subpods.map((sub: any) => ({
      type: sub.img ? "image" : "text",
      value: sub.img?.src || sub.plaintext,
    })),
  }))

  return { success: true, pods }
}
```

### LaTeX to Wolfram Conversion

The LLM handles most translation, but helper function cleans up:

```typescript
function latexToWolframInput(latex: string): string {
  return latex
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\beta/g, "beta")
    .replace(/\\nabla/g, "del")
    .replace(/\^/g, "^")
    // ... more replacements
}
```

### Response Rendering

**Pod-Based Visual Layout** (`components/deep-dive-modal.tsx`):

```typescript
{toolCall.result.pods?.map((pod, i) => (
  <div key={i} className="wolfram-pod rounded-lg border p-4">
    <h4 className="font-medium text-sm">{pod.title}</h4>
    <div className="grid grid-cols-2 gap-2">
      {pod.content.map((item, j) =>
        item.type === "image" ? (
          <img src={item.value} alt={pod.title} />
        ) : (
          <p className="text-xs">{item.value}</p>
        )
      )}
    </div>
  </div>
))}
```

### Cost Analysis

Per deep dive:
- Wolfram API calls: 1-5 queries (free tier: 2,000/month)
- LLM tokens: 5,000-10,000 (with tool calls)
- Cost: $0.05-0.15 per deep dive

### Known Limitations

1. **Query Timeouts**: Complex symbolic math can timeout (30s limit)
2. **Notation Ambiguity**: Context-dependent symbols require careful prompting
3. **Rate Limits**: Free tier limited to 2,000 queries/month
4. **Image-Only Results**: Some results only available as images (not parseable text)

## Vercel AI Gateway

All LLM calls route through Vercel AI Gateway by default:

**Benefits**:
- Zero-config for supported providers (OpenAI, Anthropic, AWS Bedrock)
- Automatic API key management
- Built-in rate limiting and monitoring
- Model switching without code changes

**Configuration**:
```typescript
const model = "anthropic/claude-sonnet-4-20250514"
// Gateway handles routing to Anthropic API
```

**Direct API Keys** (alternative):
```typescript
// If not using Gateway, set keys:
// OPENAI_API_KEY=...
// ANTHROPIC_API_KEY=...
```

## Prompt Engineering Best Practices

### 1. Structured Output Prompts

**Do**:
- Provide explicit JSON schema examples
- Use numbered rules for clarity
- Specify edge cases (e.g., "DO include conclusion before references")
- Give concrete examples of desired output

**Don't**:
- Assume LLM knows implicit conventions
- Use vague terms like "extract relevant sections"
- Omit data type specifications

### 2. Explanation Prompts

**Do**:
- Tailor language to audience level
- Provide format guidelines (markdown, math delimiters)
- Encourage step-by-step reasoning
- Specify desired depth (intuition vs rigor)

**Don't**:
- Mix multiple difficulty levels in one prompt
- Forget to mention LaTeX syntax requirements
- Omit paper context (title, surrounding sections)

### 3. Tool-Calling Prompts

**Do**:
- Clearly describe tool capabilities and limitations
- Provide usage examples
- Explain when to use vs not use tools
- Specify expected output format from tools

**Don't**:
- Over-constrain tool usage (let LLM decide strategy)
- Forget to handle tool errors gracefully
- Assume LLM knows Wolfram Alpha syntax

## Error Handling Strategies

### Parsing Errors
```typescript
try {
  const result = streamText(...) // or generateText for non-streaming
  const output = await result.output
} catch (error) {
  if (error.message.includes("output schema")) {
    return Response.json(
      { error: "Failed to parse paper. The LLM did not return valid structure." },
      { status: 500 }
    )
  }
}
```

### Token Limits
```typescript
// Claude Sonnet 4: 200k context window
// PDF typically uses 40k-80k tokens
// Remaining for output: ~120k tokens (more than enough)
```

### Timeout Handling
```typescript
export const maxDuration = 60 // seconds
// Vercel function timeout
```

## Performance Optimization

### 1. Caching
- **Parsed papers**: Cached in IndexedDB (`lib/paper-cache.ts`) by PDF content/URL; repeat analyses load instantly
- Explanations for common sections could be pre-generated (not implemented)
- Wolfram queries could be memoized (not implemented)

### 2. Parallel Processing
- Multiple sections could be explained in parallel
- Deep dive tool calls happen concurrently (LLM decides)

### 3. Model Selection
- Use cheaper models (GPT-4o Mini) for simple papers
- Reserve expensive models (Claude Opus) for complex math

## Security Considerations

1. **API Keys**: All keys stored server-side as env vars
2. **Input Validation**: Zod schemas validate all inputs
3. **Rate Limiting**: Vercel AI Gateway provides built-in limits
4. **Content Filtering**: LLM safety built into models (no user-generated prompts)
5. **PDF Scanning**: Content-type validation before processing

## Monitoring and Debugging

### Logging
```typescript
console.log("[v0] Starting parse-paper request")
console.log("[v0] Model selected:", selectedModel)
console.log("[v0] Tool call completed:", toolCall.toolName)
```

### Error Tracking
- Toast notifications for user-facing errors
- Error boundaries for React component crashes
- Detailed error messages from API routes

### Performance Metrics
- Parsing time: 30-60 seconds
- Explanation time: 3-8 seconds (streaming starts immediately)
- Deep dive time: 5-15 seconds (depends on tool calls)

## Future Enhancements

1. **Function Calling for Figures**: Extract and explain paper figures
2. **Citation Resolution**: Link to referenced papers and explain connections
3. **Multi-Document Context**: Compare multiple papers
4. **Custom Tools**: Add tools for domain-specific analysis (e.g., ML model architecture visualization)
5. **Voice Explanations**: Text-to-speech for audio learning
