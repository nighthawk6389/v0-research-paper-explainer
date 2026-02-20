# Comprehensive Regeneration Prompt

This document contains a detailed prompt that could be used to regenerate this entire application from scratch using an AI assistant like v0.

---

## Master Prompt for Paper Explainer Application

Build a research paper explanation web application called "Paper Explainer" using Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, and the Vercel AI SDK 6.

### High-Level Requirements

Create an interactive tool that helps readers understand complex academic papers by:
1. Parsing PDFs with AI to extract structured sections at paragraph-level granularity
2. Displaying a dual-panel interface: original PDF on left, structured sections on right
3. Providing streaming AI explanations for any section with adjustable difficulty levels
4. Integrating Wolfram Alpha for deep mathematical analysis via AI tool-calling

### Technical Stack

- **Framework**: Next.js 16 with App Router, React 19, TypeScript 5
- **Styling**: Tailwind CSS v4 (inline theme in globals.css), shadcn/ui components
- **AI**: Vercel AI SDK 6.0 with `streamText` (and `generateText` for non-streaming fallback), `Output.object()`, and tool-calling
- **PDF**: react-pdf with pdfjs-dist for rendering
- **Math**: KaTeX for LaTeX rendering, react-markdown with remark-math/rehype-katex
- **UI Libraries**: Radix UI primitives, lucide-react icons, sonner for toasts
- **Layout**: react-resizable-panels for split view

### Core Features

#### 1. Paper Upload and Parsing

**Upload Interface** (`components/paper-upload-bar.tsx`):
- Top bar with two input methods: URL paste (for arXiv, etc.) or file upload
- Model selection dropdown: Claude Haiku 4.5 (default), Claude Sonnet 4.5, GPT-4o, GPT-4o Mini, Claude Opus 4
- "Analyze" button that triggers parsing
- Loading state with humorous status messages
- Error handling with helpful hints (e.g., "Publisher blocks downloads, try uploading instead")

**Parsing API** (`app/api/parse-paper/route.ts`):
- POST endpoint accepting: `{ pdfBase64?, url?, model }`
- Query param `?stream=true` enables Server-Sent Events (SSE) for progress updates
- If URL provided: fetch with browser-like headers, convert to base64
- Send to LLM with structured output using AI SDK's `streamText()` + `Output.object()` and Zod schema; use `partialOutputStream` to stream progress as sections are extracted
- Stream status events: "Downloading...", "Asking model...", "Model is reading...", "Model is parsing... (N sections)"
- Return complete event with parsed paper object
- Client may check IndexedDB cache first (same PDF/URL) and store result in cache after parse
- Handle fetch failures gracefully (some publishers block server downloads)

**Data Schema** (`lib/paper-schema.ts`):
```typescript
ContentBlock: {
  type: "text" | "math",
  value: string,
  isInline?: boolean,
  label?: string | null // equation numbers like "(1)"
}

Section: {
  id: string,           // "section-0", "section-1", etc.
  heading: string,      // "3. Methodology — Loss Function"
  content: ContentBlock[],
  type: "text" | "math" | "mixed",
  pageNumbers: number[]
}

Paper: {
  title: string,
  authors: string[],
  abstract: string,
  sections: Section[]
}
```

**Parsing Prompt** (`lib/prompts.ts`):
- Instruct LLM to break paper into paragraph-level sections (not just top-level headings)
- Pattern: "Original Section — Sub-topic" (e.g., "3. Methodology — Regularization")
- Aim for 30-60 sections in a 10-page paper (1-3 paragraphs per section)
- Extract only abstract through conclusion (exclude references, headers, affiliations)
- Preserve complete LaTeX equations (never break "E = mc^2" into parts)
- Track page numbers for each section (1-indexed)
- Return valid JSON matching Zod schema

#### 2. Dual-Panel Interface

**Main Page** (`app/page.tsx`):
- Use `ResizablePanelGroup` with two panels (left: PDF, right: sections)
- State management: paper object, PDF data (base64 or URL), selected section, modals
- Hover state: when section hovered on right, highlight corresponding page on left
- Click handler: opens explanation modal for clicked section
- Loading view: animated skeleton with status messages
- Empty state: instructions and example papers

**PDF Viewer** (`components/pdf-viewer.tsx`):
- Accept `pdfData` (base64) or `pdfUrl` and `highlightedPage` props
- Use `react-pdf` Document and Page components
- Render all pages with lazy loading (only visible pages load fully)
- Highlight effect on `highlightedPage`: blue ring, overlay, shadow, page label
- Zoom controls (optional enhancement)

**Structured View** (`components/structured-view.tsx`):
- Header: paper title, authors, section count
- Table of contents: extract unique top-level section names (before "—"), clickable scroll-to
- Scrollable section list with `SectionBlock` components
- Pass hover and click handlers to each section
- Pass `onDeepDive` callback for math blocks

**Section Block** (`components/section-block.tsx`):
- Collapsible card with chevron toggle
- Compact header: heading (truncated), page number, math badge, "Explain" hint on hover
- Preview line when collapsed (first text block, truncated)
- Full content when expanded: text paragraphs and math blocks
- Hover triggers highlighting in PDF viewer
- Click anywhere opens explanation modal

#### 3. Interactive Explanations

**Explanation Modal** (`components/explanation-modal.tsx`):
- Sheet/dialog that slides in from right
- Header: section heading, difficulty selector (Basic/Advanced/PhD), close button
- Scrollable content area for streaming explanations
- Chat input at bottom for follow-up questions
- Auto-initiates explanation on open with default difficulty
- Re-generates if difficulty level changes

**Explanation API** (`app/api/explain/route.ts`):
- POST endpoint accepting: `{ messages, paperTitle, sectionHeading, sectionContent, difficultyLevel }`
- Build system prompt with difficulty-specific instructions
- Use AI SDK's `streamText()` with selected model
- Return `toUIMessageStreamResponse()` for streaming to client
- Client uses `useChat()` hook with `DefaultChatTransport`

**Inline Formula Explain** (`app/api/formula-explain/route.ts` and `components/inline-formula-explain.tsx`):
- POST endpoint accepting: `{ messages, latex, paperTitle, sectionContext }`
- Concise 2–4 paragraph explanation of a single formula; no tools
- Used when user clicks inline math in explanations (popover/sheet)
- Stream response; fixed model (e.g. Claude Haiku 4.5) for speed

**Difficulty Levels**:
- **Basic**: Undergraduate level, everyday analogies, simple language, intuition over rigor
- **Advanced** (default): College-level math, rigorous details, explain notation (∇, ∂, Σ, etc.), balance rigor with intuition
- **PhD**: Graduate-level, theoretical implications, proof techniques, assume domain maturity

**Markdown Rendering** (`components/markdown-content.tsx`):
- Use `react-markdown` with `remark-math` and `rehype-katex`
- Integrate `InlineFormulaExplain` so clicking inline math opens a popover with formula explanation (calls `/api/formula-explain`)
- Custom prose styling class `.explanation-content` with:
  - Smaller font (13px) for readability
  - H2 with gradient background and left border
  - Inline math with subtle tinted background
  - Display math with padding and border box
  - Code styling with monospace and background

#### 4. Wolfram Alpha Deep Dive

**Math Block Component** (`components/math-block.tsx`):
- Render LaTeX with KaTeX (`katex.renderToString`)
- Display mode vs inline mode
- Show equation labels (numbers) if provided
- "Deep Dive" button appears on hover (display equations only)
- Button triggers `onDeepDive` callback with LaTeX string

**Deep Dive Modal** (`components/deep-dive-modal.tsx`):
- Dialog showing equation at top
- Streaming AI analysis with Wolfram Alpha integration
- Visual pod-based layout (like actual Wolfram Alpha site):
  - Tool call cards with query, purpose, status badge
  - Result pods with title, content (text or images)
  - Image grids for plots and visualizations
  - Expandable sections for detailed results
- Chat input for follow-up queries ("derive step by step", "plot this function")

**Deep Dive API** (`app/api/deep-dive/route.ts`):
- POST endpoint accepting: `{ messages, latex, sectionContext, paperTitle }`
- Create tool-calling agent with `streamText()`
- Define `wolframAlpha` tool:
  - Input: `{ query: string, purpose: string }`
  - Execute: calls Wolfram Alpha API, returns pods
- System prompt explains equation context and asks LLM to analyze
- Use `stopWhen: stepCountIs(8)` to limit tool call loops
- LLM decides what to query (solve, plot, simplify, expand, etc.)
- Stream response with tool calls embedded

**Wolfram Alpha Integration** (`lib/wolfram-alpha.ts`):
- `queryWolframAlpha(query: string)` function
- Call `https://api.wolframalpha.com/v2/query` with:
  - `appid`: from `WOLFRAM_ALPHA_APP_ID` env var
  - `input`: query string
  - `format`: "plaintext,image"
  - `output`: "json"
- Parse response into pods: `{ title, content: [{ type: "text"|"image", value }] }`
- Helper function to convert LaTeX to Wolfram syntax (\\frac{a}{b} → (a)/(b), etc.)

### Styling and Design

**Color System**:
- Use Modern Minimal design system (existing in project)
- 3-5 colors total: primary, neutrals, accents
- Avoid purple unless explicitly needed
- Blue accents for highlights and interactive elements

**Typography**:
- Use existing font setup (Geist Sans, Geist Mono)
- Explanation text: 13px (0.8125rem), line-height 1.6
- Section headings: 13px, medium weight, truncate
- Math: proportional sizing with KaTeX defaults

**Layout**:
- Flexbox for most layouts
- ResizablePanelGroup for split view (50/50 default, min 30% each)
- Collapsible sections to handle large number of granular chunks
- Sticky headers for upload bar and modal headers

**Responsive Design**:
- Desktop-first (academic papers typically read on larger screens)
- Resizable panels for user preference
- Mobile: could stack panels vertically (optional enhancement)

### Data Flow Summary

1. **Upload**: User pastes URL or uploads file → convert to base64 → check IndexedDB cache (same PDF/URL) → if miss, POST /api/parse-paper?stream=true
2. **Parse**: API fetches PDF (if URL) → sends to LLM with streamText + Output.object() → streams progress via partialOutputStream → returns Paper object → client stores in cache
3. **Display**: Client stores paper → renders dual-panel view → enables interactions
4. **Explain**: User clicks section → modal opens → POST /api/explain → streams explanation → renders markdown + math (inline math clickable for formula-explain)
5. **Formula Explain**: User clicks inline math in explanation → popover → POST /api/formula-explain → streams short explanation
6. **Deep Dive**: User clicks equation → modal opens → POST /api/deep-dive → LLM calls Wolfram tool → streams results → renders pods

### File Structure

```
app/
  api/
    parse-paper/route.ts       # PDF parsing with LLM + streaming (+ cache check on client)
    explain/route.ts           # Section explanation streaming
    formula-explain/route.ts  # Inline formula quick explanations
    deep-dive/route.ts         # Wolfram Alpha tool-calling agent
  layout.tsx                   # Root layout with fonts
  page.tsx                     # Main application (uses paper-cache for cache check/store)
  globals.css                  # Tailwind config + custom prose styles
components/
  paper-upload-bar.tsx         # Upload interface + model selection
  pdf-viewer.tsx               # Left panel PDF rendering
  structured-view.tsx          # Right panel section list + TOC
  section-block.tsx            # Collapsible section cards
  explanation-modal.tsx        # Section explanation dialog
  inline-formula-explain.tsx   # Inline formula popover (calls formula-explain API)
  deep-dive-modal.tsx          # Wolfram Alpha results dialog
  math-block.tsx               # KaTeX rendering + deep dive button
  markdown-content.tsx         # Styled prose rendering (+ InlineFormulaExplain)
  paper-loading.tsx            # Loading state with status
  paper-empty-state.tsx        # Initial empty state
  theme-provider.tsx           # Theme context
  ui/                          # shadcn/ui components (use existing)
lib/
  paper-schema.ts              # Zod schemas for structured output
  paper-cache.ts               # IndexedDB cache for parsed papers (getCachedPaper, setCachedPaper)
  prompts.ts                   # LLM prompt templates
  wolfram-alpha.ts             # Wolfram API integration
  config.ts                    # API config (e.g. maxDuration)
  utils.ts                     # cn() and helpers
```

### Environment Variables

```bash
WOLFRAM_ALPHA_APP_ID=your_app_id_here
```

AI SDK uses Vercel AI Gateway by default (zero-config for OpenAI, Anthropic).

### Implementation Details

**SSE Streaming for Progress**:
```typescript
// In API route
function createSSEStream() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      const close = () => controller.close()
      return { send, close }
    }
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
  })
}
```

**AI SDK Tool-Calling**:
```typescript
import { streamText, tool } from "ai"
import { z } from "zod"

const wolframAlpha = tool({
  description: "Query Wolfram Alpha for mathematical analysis",
  inputSchema: z.object({
    query: z.string(),
    purpose: z.string()
  }),
  execute: async ({ query, purpose }) => {
    const result = await queryWolframAlpha(query)
    return { success: true, pods: result.pods, purpose }
  }
})

const result = streamText({
  model: "anthropic/claude-sonnet-4-20250514",
  system: "...",
  messages: convertToModelMessages(messages),
  tools: { wolframAlpha },
  stopWhen: stepCountIs(8)
})
```

**useChat Hook**:
```typescript
const { messages, sendMessage, isStreaming } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/explain",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages, paperTitle, sectionHeading, sectionContent, difficultyLevel }
    })
  })
})
```

### Error Handling

- Toast notifications for user-facing errors (sonner)
- Specific error for blocked publishers: suggest file upload instead
- Loading states with humorous messages to set expectations
- Graceful degradation if Wolfram API fails
- Validation errors on malformed PDFs

### Performance Considerations

- Parsing: 30-60 seconds (show progress)
- Explanations: streaming starts immediately (3-8 seconds total)
- Deep dive: 5-15 seconds (depends on tool calls)
- PDF rendering: virtualized (only visible pages)
- Section blocks: collapsed by default to reduce DOM size

### Accessibility

- Semantic HTML (header, main, section)
- ARIA roles for interactive elements
- Keyboard navigation (tab through sections, Enter to open)
- Focus management in modals
- Screen reader text for icons

### Testing the Application

After implementation:
1. Upload a sample arXiv paper (paste direct PDF URL)
2. Verify paragraph-level section extraction
3. Hover sections to see PDF highlight
4. Click section to get explanation
5. Change difficulty level and verify regeneration
6. Find an equation, click "Deep Dive"
7. Ask follow-up question in modal
8. Test with different models (GPT vs Claude)

### Known Limitations to Document

- Some publishers (ACM, IEEE) block server-side downloads
- Parsing takes 30-60 seconds (inherent to LLM approach)
- Wolfram free tier: 2,000 queries/month
- Very large papers (50+ pages) may need chunking
- Math OCR not perfect for hand-drawn equations

### Future Enhancements (Optional)

- Save parsed papers to database
- User authentication and history
- Share paper explanations via URL
- Figure and table extraction
- Citation linking and reference lookup
- Export explanations to markdown/PDF
- Voice narration of explanations
- Multi-language support

---

## Implementation Checklist

Use this checklist to ensure all features are implemented:

- [ ] Paper upload bar with URL and file inputs
- [ ] Model selection dropdown (5 models: Haiku 4.5 default, Sonnet 4.5, GPT-4o, GPT-4o Mini, Opus 4)
- [ ] PDF parsing API with SSE streaming
- [ ] Zod schemas for structured output
- [ ] Paragraph-level section extraction prompt
- [ ] Dual-panel resizable interface
- [ ] PDF viewer with page highlighting
- [ ] Structured view with TOC and sections
- [ ] Collapsible section blocks
- [ ] Explanation modal with streaming
- [ ] Difficulty level selector
- [ ] useChat integration for follow-up questions
- [ ] Inline formula explain (formula-explain API + InlineFormulaExplain component)
- [ ] Math block rendering with KaTeX
- [ ] Deep dive button on equations
- [ ] Wolfram Alpha API integration
- [ ] Tool-calling agent for deep dive
- [ ] Visual pod-based results display
- [ ] Custom prose styling (13px, gradient headers, math backgrounds)
- [ ] Loading states with status messages
- [ ] Error handling and toasts
- [ ] IndexedDB paper cache (getCachedPaper, setCachedPaper) for repeat analyses
- [ ] Environment variable setup
- [ ] README and documentation

---

## Expected Outcome

A production-ready research paper explanation tool that:
- Parses academic PDFs into 30-60 granular sections
- Displays dual-panel interface with synchronized highlighting
- Provides streaming AI explanations at 3 difficulty levels
- Integrates Wolfram Alpha for mathematical deep dives
- Handles errors gracefully with user-friendly messages
- Works with major academic paper sources (arXiv, etc.)
- Costs ~$0.10-0.30 per paper parse, ~$0.02-0.08 per explanation

The application should be immediately usable for understanding complex research papers in mathematics, physics, computer science, and other quantitative fields.
