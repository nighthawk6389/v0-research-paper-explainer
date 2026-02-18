# Paper Explainer

An AI-powered research paper explanation tool that makes complex academic papers accessible to readers with college-level mathematics but not PhD-level domain expertise.

## Overview

Paper Explainer uses large language models to parse academic PDFs and provide interactive, granular explanations of complex concepts, mathematical notation, and technical sections. The tool features a dual-panel interface with the original PDF on the left and structured, paragraph-level sections on the right.

## Key Features

- **AI-Powered PDF Parsing**: Upload or provide URL to academic papers (PDF) and automatically extract structured sections with paragraph-level granularity
- **Dual-Panel Interface**: View the original PDF alongside an interactive breakdown with synchronized highlighting
- **Interactive Explanations**: Click any section to get detailed, streaming AI explanations tailored to your mathematical background
- **Difficulty Levels**: Choose between Basic, Advanced (default), or PhD-level explanations
- **Mathematical Deep Dives**: Hover over equations to access Wolfram Alpha integration for step-by-step derivations, plots, and symbolic manipulation
- **Model Selection**: Choose between Claude Sonnet 4, GPT-4o, GPT-4o Mini, or Claude Opus 4 for paper parsing
- **Progress Tracking**: Real-time streaming status updates during analysis with humorous commentary

## Technology Stack

- **Framework**: Next.js 16 with React 19
- **AI**: Vercel AI SDK 6.0 with tool-calling support
- **PDF Rendering**: react-pdf with pdfjs-dist
- **Math Rendering**: KaTeX with react-markdown
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS v4
- **External APIs**: Wolfram Alpha Full Results API

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Vercel AI Gateway access (or direct LLM API keys)
- Wolfram Alpha App ID (free tier: 2,000 queries/month)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd paper-explainer

# Install dependencies
pnpm install

# Set up environment variables
# WOLFRAM_ALPHA_APP_ID=your_app_id_here

# Run development server
pnpm dev
```

Visit `http://localhost:3000` to use the application.

### Usage

1. **Upload a Paper**: Paste a PDF URL (e.g., arXiv direct PDF link) or upload a PDF file
2. **Select Model**: Choose your preferred LLM (Claude Sonnet 4 recommended)
3. **Analyze**: Click "Analyze" and wait for AI-powered parsing (30-60 seconds)
4. **Explore Sections**: Click any section on the right to open an explanation modal
5. **Adjust Difficulty**: Use the difficulty selector (Basic/Advanced/PhD) in the explanation modal
6. **Deep Dive Math**: Hover over display equations and click "Deep Dive" for Wolfram Alpha analysis
7. **Ask Follow-ups**: Use the chat input in modals to ask clarifying questions

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── parse-paper/route.ts    # PDF parsing with LLM
│   │   ├── explain/route.ts         # Section explanation streaming
│   │   └── deep-dive/route.ts       # Wolfram Alpha integration
│   ├── layout.tsx
│   ├── page.tsx                     # Main application
│   └── globals.css
├── components/
│   ├── paper-upload-bar.tsx         # Upload and model selection
│   ├── pdf-viewer.tsx               # Left panel PDF display
│   ├── structured-view.tsx          # Right panel section list
│   ├── section-block.tsx            # Individual collapsible sections
│   ├── explanation-modal.tsx        # Section explanation + chat
│   ├── deep-dive-modal.tsx          # Wolfram Alpha results
│   ├── math-block.tsx               # KaTeX rendering
│   └── markdown-content.tsx         # Styled prose rendering
├── lib/
│   ├── paper-schema.ts              # Zod schemas for structured output
│   ├── prompts.ts                   # LLM prompt templates
│   ├── wolfram-alpha.ts             # Wolfram API integration
│   └── utils.ts
└── docs/                            # Documentation
```

## Documentation

- [Architecture Overview](docs/architecture.md) - System design and data flow
- [LLM Integration Guide](docs/llm-integration.md) - How AI features are implemented
- [PDF Parsing Alternatives](docs/pdf-parsing-alternatives.md) - Other approaches to PDF extraction
- [Regeneration Prompt](docs/regeneration-prompt.md) - Comprehensive prompt to rebuild this app

## API Routes

### POST /api/parse-paper

Parses a PDF and extracts structured sections.

**Query Parameters:**
- `stream=true` (optional): Enable Server-Sent Events for progress updates

**Request Body:**
```json
{
  "pdfBase64": "base64-encoded-pdf-data",
  "url": "https://arxiv.org/pdf/XXXX.XXXXX",
  "model": "anthropic/claude-sonnet-4-20250514"
}
```

**Response (streaming):**
```
event: status
data: {"message": "Downloading paper...", "detail": "...", "model": "..."}

event: complete
data: {"paper": {...}}
```

### POST /api/explain

Streams explanations for a specific section with difficulty level support.

**Request Body:**
```json
{
  "messages": [...],
  "paperTitle": "Paper Title",
  "sectionHeading": "3. Methodology",
  "sectionContent": "...",
  "difficultyLevel": "advanced"
}
```

### POST /api/deep-dive

AI agent with Wolfram Alpha tool-calling for mathematical analysis.

**Request Body:**
```json
{
  "messages": [...],
  "latex": "E = mc^2",
  "sectionContext": "...",
  "paperTitle": "Paper Title"
}
```

## Environment Variables

```bash
# Required for Wolfram Alpha integration
WOLFRAM_ALPHA_APP_ID=your_app_id

# Optional: Direct LLM API keys (if not using Vercel AI Gateway)
# OPENAI_API_KEY=...
# ANTHROPIC_API_KEY=...
```

## Performance Considerations

- **Parsing Time**: 30-60 seconds for a typical 10-page paper
- **Token Usage**: ~20,000-50,000 tokens per paper parse (depends on model and paper length)
- **Explanation Cost**: ~2,000-5,000 tokens per section explanation
- **Wolfram Queries**: 1-5 queries per deep dive (limited to 2,000/month on free tier)

## Known Limitations

- Some publishers (ACM, IEEE) block server-side PDF downloads (use upload instead)
- LaTeX rendering requires specific syntax (standard notation supported)
- PDF text extraction via LLM is slower than traditional parsers but more accurate for math
- Wolfram Alpha queries may timeout for very complex expressions

## Contributing

Contributions are welcome! Please read the architecture docs before making significant changes.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with Vercel AI SDK 6.0
- PDF rendering powered by Mozilla's pdf.js
- Math rendering by KaTeX
- Mathematical analysis via Wolfram Alpha API
- UI components from shadcn/ui
