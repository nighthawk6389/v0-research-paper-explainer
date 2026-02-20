# Architecture Overview

## System Design

Paper Explainer is a Next.js 16 application that uses large language models to parse and explain academic research papers. The architecture follows a client-server pattern with streaming AI responses and interactive UI components.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Client                        │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ Upload Bar   │  │  PDF Viewer  │  │ Structured View   │ │
│  │ (Model Select)│  │ (Left Panel) │  │ (Right Panel)     │ │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘ │
│         │                   │                    │           │
│         └───────────────────┴────────────────────┘           │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │   Main Page     │                       │
│                    │   (State Mgmt)  │                       │
│                    └────────┬────────┘                       │
│                             │                                │
│              ┌──────────────┼──────────────┐                │
│              │              │              │                │
│    ┌─────────▼────────┐ ┌──▼───────┐ ┌───▼──────────┐     │
│    │Explanation Modal │ │Deep Dive │ │Loading State │     │
│    │(Section Chat)    │ │Modal     │ │              │     │
│    └──────────────────┘ └──────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                             │
                 ┌───────────┼───────────┐
                 │           │           │           │
        ┌────────▼───┐  ┌───▼────┐  ┌──▼────────────┐  ┌──▼────────┐
        │ /api/      │  │ /api/  │  │ /api/         │  │ /api/     │
        │ parse-paper│  │ explain│  │ formula-explain│  │ deep-dive │
        └────────┬───┘  └───┬────┘  └──┬────────────┘  └──┬────────┘
                 │          │           │                  │
                 │          │           │                  │
         ┌───────▼──────────▼───────────▼──────────────────▼────────┐
         │      Vercel AI Gateway / LLMs          │
         │  (Claude Haiku/Sonnet 4.5, GPT-4o, etc.) │
         └────────────────┬────────────────────────┘
                          │
              ┌───────────▼──────────┐
              │  Wolfram Alpha API   │
              │  (Tool called by LLM)│
              └──────────────────────┘
```

## Data Flow

### 1. PDF Upload & Parsing

```
User Action → Upload Bar Component
              │
              ├─ File Upload: Convert to base64
              └─ URL Input: Pass through
              │
              ▼
        POST /api/parse-paper?stream=true
              │
              ├─ Download PDF (if URL)
              ├─ Convert to base64
              └─ Send to LLM with prompt
              │
              ▼
        LLM (Claude/GPT) with Output.object()
              │
              ├─ Parse PDF natively
              ├─ Extract title, authors, sections
              ├─ Break into paragraph-level chunks
              └─ Return structured JSON (Zod schema)
              │
              ▼
        Stream progress via SSE
              │
              ├─ event: status (progress updates)
              └─ event: complete (final data)
              │
              ▼
        Client receives Paper object
              │
              ├─ Check IndexedDB cache (same PDF/URL) → use cached paper if found
              ├─ Store in state
              ├─ Display in dual-panel view
              ├─ Cache result in IndexedDB for next time
              └─ Enable section interactions
```

### 2. Section Explanation

```
User clicks section → Explanation Modal opens
                           │
                           ▼
                  POST /api/explain
                           │
                           ├─ Build system prompt with:
                           │  - Paper title
                           │  - Section heading/content
                           │  - Difficulty level
                           │
                           ▼
                  streamText() with messages
                           │
                           ├─ LLM generates explanation
                           └─ Stream response as SSE
                           │
                           ▼
                  useChat() hook receives stream
                           │
                           ├─ Display streaming text
                           ├─ Render math with KaTeX
                           └─ Enable follow-up questions
```

### 3. Wolfram Alpha Deep Dive

```
User clicks "Deep Dive" on equation → Deep Dive Modal
                                           │
                                           ▼
                                  POST /api/deep-dive
                                           │
                                           ├─ Create tool-calling agent
                                           ├─ Define wolframAlpha tool
                                           │
                                           ▼
                          streamText() with tools + stopWhen(8 steps)
                                           │
                                           ├─ LLM analyzes equation
                                           ├─ Decides what to query
                                           │  (solve, plot, simplify, etc.)
                                           │
                                           ▼
                          LLM calls wolframAlpha tool
                                           │
                                           ├─ Convert LaTeX to Wolfram syntax
                                           ├─ Call Wolfram API
                                           ├─ Parse XML/JSON response
                                           └─ Extract pods (text + images)
                                           │
                                           ▼
                          Tool returns results to LLM
                                           │
                                           ├─ LLM synthesizes findings
                                           └─ Stream response with tool calls
                                           │
                                           ▼
                          Client renders pods visually
                                           │
                                           ├─ Display query cards
                                           ├─ Show images in grid
                                           └─ Format text results
```

## Component Architecture

### Core Components

**app/page.tsx** - Main application controller
- Manages global state (paper, sections, modals)
- Coordinates communication between panels
- Handles section hover/click interactions
- Maintains PDF data for viewer

**components/paper-upload-bar.tsx** - Upload interface
- File upload with base64 conversion
- URL input validation
- Model selection dropdown
- Loading states and error hints

**components/pdf-viewer.tsx** - Left panel PDF display
- Uses react-pdf and pdfjs-dist
- Page-by-page rendering with virtualization
- Synchronized highlight on hover
- Zoom controls and navigation

**components/structured-view.tsx** - Right panel section list
- Displays table of contents (TOC)
- Renders collapsible section blocks
- Manages section hover state
- Scrolls to sections on TOC click

**components/section-block.tsx** - Individual section card
- Collapsible with preview
- Hover highlight trigger
- Click to explain
- Math block with "Deep Dive" button

**components/explanation-modal.tsx** - Section explanation sheet
- Streaming AI explanations
- Difficulty level selector
- Follow-up chat interface
- Markdown + math rendering

**components/deep-dive-modal.tsx** - Wolfram Alpha dialog
- Displays equation at top
- Shows streaming analysis
- Renders Wolfram pods visually
- Follow-up query input

### UI Component Hierarchy

```
page.tsx
├── PaperUploadBar
├── ResizablePanelGroup
│   ├── PdfViewer
│   │   └── react-pdf Pages
│   └── StructuredView
│       ├── TOC navigation
│       └── SectionBlock[]
│           └── MathBlock (with onDeepDive)
├── ExplanationModal
│   ├── useChat hook
│   ├── MarkdownContent (with InlineFormulaExplain for clickable math)
│   └── Chat input
├── InlineFormulaExplain (popover for inline formula explanations via /api/formula-explain)
└── DeepDiveModal
    ├── useChat hook
    ├── Tool call rendering
    └── Wolfram pods display
```

## State Management

The application uses React's built-in state management with hooks:

```typescript
// Main state
const [paper, setPaper] = useState<Paper | null>(null)
const [pdfBase64, setPdfBase64] = useState<string | null>(null)
const [pdfUrl, setPdfUrl] = useState<string | null>(null)

// UI state
const [isLoading, setIsLoading] = useState(false)
const [hoveredSection, setHoveredSection] = useState<string | null>(null)
const [selectedSection, setSelectedSection] = useState<Section | null>(null)
const [isModalOpen, setIsModalOpen] = useState(false)

// Deep dive state
const [deepDiveLatex, setDeepDiveLatex] = useState<string | null>(null)
const [deepDiveSection, setDeepDiveSection] = useState<Section | null>(null)
const [isDeepDiveOpen, setIsDeepDiveOpen] = useState(false)

// Loading feedback
const [loadingStatus, setLoadingStatus] = useState<StatusMessage | null>(null)
```

State is passed down via props and callbacks flow up through the component tree.

## API Route Design

### /api/parse-paper

**Approach**: Server-Sent Events (SSE) streaming for progress updates

**Flow**:
1. Accept PDF (base64 or URL) and model selection
2. Download PDF if URL provided (with browser-like headers)
3. Send progress events: "Downloading...", "Asking Claude...", "Claude is reading..."
4. Call `streamText()` with `Output.object()` for structured extraction; stream progress via `partialOutputStream` as sections are parsed
5. Stream complete event with Paper object

**Why SSE?**: Parsing takes 30-60 seconds, so user needs feedback on progress

### /api/explain

**Approach**: Standard AI SDK streaming with `streamText()`

**Flow**:
1. Accept messages, paper context, and difficulty level
2. Build system prompt with difficulty-specific instructions
3. Stream explanation using `toUIMessageStreamResponse()`
4. Client uses `useChat()` with `DefaultChatTransport`

**Why streaming?**: Explanations can be long (1000+ tokens), streaming improves perceived performance

### /api/deep-dive

**Approach**: Tool-calling agent with `streamText()` and `stopWhen`

**Flow**:
1. Accept LaTeX, section context, and messages
2. Create agent with `wolframAlpha` tool definition
3. Use `stopWhen: stepCountIs(8)` to limit tool loops
4. LLM decides what queries to run (solve, plot, etc.)
5. Tool executes Wolfram API calls
6. Stream results back with tool call metadata

**Why tool-calling?**: LLM handles the hard part of translating notation to Wolfram syntax

## Data Schemas

### Paper Schema (Zod)

```typescript
const ContentBlock = z.object({
  type: z.enum(["text", "math"]),
  value: z.string(),
  isInline: z.boolean().optional(),
  label: z.string().nullable().optional(),
})

const Section = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.array(ContentBlock),
  type: z.enum(["text", "math", "mixed"]),
  pageNumbers: z.array(z.number()),
})

const Paper = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  sections: z.array(Section),
})
```

### Wolfram Alpha Response

```typescript
interface WolframPod {
  title: string
  content: Array<{
    type: "text" | "image"
    value: string
  }>
  subpods?: WolframPod[]
}
```

## Styling Architecture

### Tailwind CSS v4

- Uses inline theme configuration in `globals.css`
- Custom prose styling for explanation content
- Dark mode support via `next-themes`
- Responsive design with mobile-first approach

### Key Style Classes

```css
/* Explanation modal prose */
.explanation-content {
  font-size: 0.8125rem; /* 13px */
  line-height: 1.6;
}

/* Math highlighting */
.explanation-content .katex {
  background: oklch(0.98 0.02 250 / 0.3);
  padding: 0.125em 0.25em;
  border-radius: 0.25em;
}

/* Wolfram pods */
.wolfram-pod:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}
```

## Performance Optimizations

1. **PDF Rendering**: Virtualized page rendering (only visible pages loaded)
2. **Section Collapsing**: Collapsed by default to reduce DOM nodes
3. **Streaming Responses**: Progressive rendering of AI output
4. **Memoization**: `useMemo` for computed values (highlighted page, TOC entries)
5. **Lazy Loading**: PDF worker loaded on-demand

## Error Handling

### Client-Side
- Toast notifications for user-facing errors
- Inline error banners for persistent issues
- Loading states with progress feedback
- Retry mechanisms for network failures

### Server-Side
- Try-catch blocks around API calls
- Graceful degradation (non-streaming fallback)
- Informative error messages (e.g., "Publisher blocks downloads")
- Timeout handling for long-running operations

## Security Considerations

1. **API Keys**: Stored as environment variables (never client-side)
2. **PDF Validation**: Content-type checking before processing
3. **Input Sanitization**: Zod schema validation for all inputs
4. **Rate Limiting**: Relies on Vercel AI Gateway rate limits
5. **CORS**: Server-side PDF fetching avoids browser CORS issues

## Deployment

The application is designed for deployment on Vercel:

- **Edge Runtime**: Not used (AI SDK requires Node.js runtime)
- **Serverless Functions**: All API routes are serverless
- **Environment Variables**: Managed via Vercel dashboard
- **Build Output**: Static assets + API routes
- **CDN**: PDF worker and KaTeX styles served from CDN

## Caching

Parsed papers are cached in the browser using **IndexedDB** (`lib/paper-cache.ts`). When the user analyzes a PDF (by URL or upload), the app hashes the input and checks for an existing cached result. On cache hit, the paper loads immediately without calling the parse API. After a successful parse, the result is stored with the PDF data and model. Cache is keyed by content (base64 or URL) so the same paper re-analyzed returns the cached copy.

## Future Architecture Considerations

1. **Database Integration**: Store parsed papers server-side for reuse across users
2. **User Authentication**: Save papers and preferences per user
3. **Server-Side Caching**: Redis or similar for frequently accessed papers (client-side IndexedDB caching is already implemented)
4. **Vector Search**: Semantic search across paper sections
5. **Batch Processing**: Queue system for multiple papers
6. **Real-time Collaboration**: Share annotations and explanations
