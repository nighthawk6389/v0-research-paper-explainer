# PDF Parsing Alternatives

This document explores alternative approaches to PDF parsing beyond using LLMs, comparing speed, accuracy, and implementation complexity.

## Current Approach: LLM Native PDF Reading

**Implementation**: Send entire PDF to Claude/GPT with structured output prompt

**Pros**:
- Native understanding of PDF layout and visual structure
- Excellent at preserving complex math notation
- Semantic understanding of section boundaries
- No preprocessing required

**Cons**:
- Slow: 30-60 seconds for 10-page paper
- Expensive: $0.10-0.30 per paper
- Token limits: Large papers (50+ pages) may exceed context
- Non-deterministic: Small variations in output structure

**Best For**: Complex academic papers with heavy mathematical notation

## Alternative Approaches

### 1. Traditional Text Extraction (pdf-parse, pdfjs-gettext)

**How It Works**:
```typescript
import pdf from "pdf-parse"

const dataBuffer = fs.readFileSync("paper.pdf")
const data = await pdf(dataBuffer)
console.log(data.text) // Raw text extraction
```

**Pros**:
- Fast: < 1 second for most papers
- Cheap: No API costs
- Deterministic: Same input → same output
- Works offline

**Cons**:
- Breaks on complex layouts (multi-column, figures)
- Math notation becomes gibberish: "∇·E = ρ/ε₀" → "r.E = r/e0"
- No semantic understanding of sections
- Page numbers and structure lost
- Equations often rendered as raw LaTeX source or Unicode mess

**Best For**: Simple papers with minimal math, quick keyword extraction

**Example Output**:
```
Before: "The loss function is defined as $$\mathcal{L}(\theta) = -\frac{1}{N}\sum_{i=1}^N \log p(y_i|x_i;\theta)$$"
After:  "The loss function is defined as L(θ) = -1/N Σi=1N log p(yi|xi;θ)"
```

### 2. PDF.js Text Layer Extraction

**How It Works**:
```typescript
import * as pdfjsLib from "pdfjs-dist"

const loadingTask = pdfjsLib.getDocument(pdfUrl)
const pdf = await loadingTask.promise
const page = await pdf.getPage(1)
const textContent = await page.getTextContent()

const text = textContent.items
  .map((item) => item.str)
  .join(" ")
```

**Pros**:
- Faster than pdf-parse (< 1 second)
- Per-page extraction enables granular processing
- Bounding box coordinates available
- Better at preserving reading order than pdf-parse

**Cons**:
- Still breaks on math notation
- Multi-column layouts require manual reordering
- No semantic structure (headings vs body text)
- Equation LaTeX not preserved

**Best For**: Position-aware extraction, building custom layout analysis

**Position-Based Extraction Example**:
```typescript
const items = textContent.items.filter((item) => {
  return item.transform[5] > 500 // Y position > 500
})
```

### 3. OCR (Tesseract, Cloud Vision API)

**How It Works**:
```typescript
import Tesseract from "tesseract.js"

// Convert PDF to images first
const images = await pdfToImages(pdfBuffer)

const results = await Promise.all(
  images.map((img) =>
    Tesseract.recognize(img, "eng", {
      logger: (m) => console.log(m),
    })
  )
)

const text = results.map((r) => r.data.text).join("\n")
```

**Pros**:
- Works on scanned PDFs (where text layer doesn't exist)
- Can handle handwritten notes (with training)
- Multiple languages supported

**Cons**:
- Very slow: 5-10 seconds per page
- Math notation accuracy poor (< 50% for complex equations)
- Requires PDF → image conversion (adds latency)
- Error-prone on low-quality scans
- Expensive (Cloud Vision API charges per page)

**Best For**: Scanned papers with no text layer, legacy documents

**Math OCR Challenges**:
```
Actual: ∫₀^∞ e^(-x²) dx = √π/2
OCR:    ∫₀^∞ e^(-x²) dx = √π/2  ← (might get lucky)
        10 e^(xz) dx = wn/Z     ← (more likely)
```

### 4. Specialized Math OCR (Mathpix, InftyReader)

**How It Works**:
```typescript
import axios from "axios"

const response = await axios.post(
  "https://api.mathpix.com/v3/text",
  {
    src: imageBase64,
    formats: ["latex_styled"],
  },
  {
    headers: {
      app_id: process.env.MATHPIX_APP_ID,
      app_key: process.env.MATHPIX_APP_KEY,
    },
  }
)

const latex = response.data.latex_styled
```

**Pros**:
- Excellent math notation accuracy (90%+ for clean equations)
- Returns LaTeX directly
- Handles complex layouts (matrices, aligned equations)
- Fast: 1-2 seconds per page

**Cons**:
- Expensive: $0.004-0.01 per page (Mathpix)
- Requires PDF → image conversion
- Still struggles with multi-column layouts
- API rate limits
- No semantic section understanding

**Best For**: Math-heavy papers where cost is acceptable, hybrid approach

**Cost Comparison** (10-page paper):
- Mathpix: $0.04-0.10
- LLM (Claude): $0.10-0.30
- Traditional: Free

### 5. Hybrid: Text Extraction + LLM for Structure

**How It Works**:
```typescript
// Step 1: Fast text extraction
const rawText = await pdf(pdfBuffer).then((data) => data.text)

// Step 2: LLM for structure only (much smaller input)
const { output } = await generateText({
  model: "gpt-4o-mini", // Cheaper model
  output: Output.object({ schema: paperSchema }),
  messages: [
    {
      role: "user",
      content: `Here is the raw text from a paper. Extract structured sections:\n\n${rawText}`,
    },
  ],
})
```

**Pros**:
- Much faster: 5-10 seconds total
- Cheaper: $0.01-0.05 per paper (smaller LLM input)
- LLM handles semantic structure
- No PDF context window limits

**Cons**:
- Math notation still degraded (garbage in → garbage out)
- LLM must infer structure from messy text
- Two-step process adds complexity

**Best For**: Papers with minimal math, cost-sensitive applications

**Token Reduction**:
- PDF file: 40,000-80,000 tokens
- Text extraction: 10,000-20,000 tokens
- Savings: 50-75% token reduction

### 6. Layout Analysis (LayoutParser, PDF Miner)

**How It Works**:
```typescript
import { PDFDocument } from "pdf-lib"
import { LayoutParser } from "layout-parser"

// Analyze visual structure
const layout = await LayoutParser.parse(pdfBuffer)

// Extract by layout elements
const sections = layout.blocks
  .filter((block) => block.type === "heading")
  .map((heading) => ({
    title: heading.text,
    content: getBlocksBetween(heading, nextHeading),
  }))
```

**Pros**:
- Detects visual hierarchy (headings vs body)
- Handles multi-column layouts correctly
- Preserves spatial relationships
- Can identify figures, tables, equations

**Cons**:
- Requires ML models (heavyweight dependencies)
- Still poor at math notation
- Complex to implement correctly
- Slower than simple text extraction

**Best For**: Complex layouts, need to separate figures from text

### 7. GROBID (Open-Source Scientific PDF Parser)

**How It Works**:
```bash
# Run GROBID service
docker run -p 8070:8070 lfoppiano/grobid:0.8.0

# POST PDF to API
curl -X POST \
  -F "input=@paper.pdf" \
  http://localhost:8070/api/processFulltextDocument
```

**Output**: TEI XML (Text Encoding Initiative)

```xml
<teiHeader>
  <titleStmt>
    <title>Paper Title</title>
  </titleStmt>
</teiHeader>
<text>
  <body>
    <div type="section" n="1">
      <head>Introduction</head>
      <p>...</p>
    </div>
  </body>
</text>
```

**Pros**:
- Purpose-built for scientific papers
- Extracts metadata (authors, citations, references)
- Section structure preserved
- Free and open-source
- Fast: 2-5 seconds per paper

**Cons**:
- Math notation still problematic
- Requires running a separate service (Docker)
- TEI XML parsing adds complexity
- Best for papers in standard formats (ArXiv, ACM, IEEE)

**Best For**: Large-scale academic paper processing, citation networks

### 8. Adobe PDF Extract API

**How It Works**:
```typescript
import PDFServicesSdk from "@adobe/pdfservices-node-sdk"

const executionContext =
  PDFServicesSdk.ExecutionContext.create(credentials)
const extractPdfOperation =
  PDFServicesSdk.ExtractPDF.Operation.createNew()

extractPdfOperation.setInput(
  PDFServicesSdk.FileRef.createFromLocalFile("paper.pdf")
)

const result = await extractPdfOperation.execute(executionContext)
```

**Output**: JSON with structured elements

```json
{
  "elements": [
    { "type": "H1", "text": "Introduction" },
    { "type": "P", "text": "..." },
    { "type": "Formula", "text": "E = mc^2" }
  ]
}
```

**Pros**:
- Best-in-class layout analysis
- Detects tables, figures, equations
- Preserves reading order
- Handles complex multi-column layouts

**Cons**:
- Expensive: $0.05-0.10 per document
- Requires Adobe account and API key
- Math notation still approximate (not true LaTeX)
- Rate limits on free tier

**Best For**: Production applications with budget, complex document structures

## Comparative Analysis

| Approach                  | Speed       | Cost/Paper | Math Accuracy | Structure | Best Use Case                      |
| ------------------------- | ----------- | ---------- | ------------- | --------- | ---------------------------------- |
| LLM Native (Current)      | 30-60s      | $0.10-0.30 | 95%           | Excellent | Complex math papers                |
| pdf-parse                 | <1s         | Free       | 20%           | Poor      | Simple text, keyword search        |
| PDF.js Text Layer         | <1s         | Free       | 20%           | Poor      | Position-aware extraction          |
| Tesseract OCR             | 5-10s/page  | Free       | 30%           | Poor      | Scanned documents                  |
| Mathpix                   | 1-2s/page   | $0.04-0.10 | 90%           | Fair      | Math-heavy, budget available       |
| Text + LLM Hybrid         | 5-10s       | $0.01-0.05 | 30%           | Good      | Cost optimization, simple math     |
| LayoutParser              | 2-5s        | Free       | 30%           | Good      | Complex layouts, spatial analysis  |
| GROBID                    | 2-5s        | Free       | 40%           | Good      | Metadata extraction, citations     |
| Adobe PDF Extract         | 3-8s        | $0.05-0.10 | 60%           | Excellent | Production apps, complex structure |

## Recommendation by Use Case

### Research Paper Explainer (Current App)
**Best**: LLM Native
- Math accuracy is critical
- Semantic understanding required
- Cost acceptable for user-uploaded papers
- Speed acceptable with progress updates

### Large-Scale Paper Database
**Best**: GROBID + Mathpix (for equations only)
- Process thousands of papers
- Extract metadata and citations
- Use Mathpix only on detected equation blocks
- Cost: ~$0.04-0.08 per paper

### Real-Time Search/Preview
**Best**: pdf-parse + Keyword Highlighting
- Speed is critical (< 1 second)
- Only need keyword matches, not full understanding
- Math accuracy not important for search

### Mobile App (Offline)
**Best**: PDF.js Text Layer + Local Processing
- No API calls (works offline)
- Fast enough for mobile
- Accept lower accuracy on math

### Citation Network Analysis
**Best**: GROBID
- Extract references and citations
- Structure papers for network analysis
- Free and fast for bulk processing

## Implementation Recommendations

### Quick Win: Hybrid Approach for Speed

```typescript
// Fast path: Try text extraction first
const rawText = await pdf(pdfBuffer).then((data) => data.text)

// Check if math-heavy (count LaTeX-like patterns)
const mathDensity = (rawText.match(/[∫∑∏∇∂]/g) || []).length / rawText.length

if (mathDensity < 0.01) {
  // Low math: use text + cheap LLM
  return await structureWithLLM(rawText, "gpt-4o-mini")
} else {
  // High math: use full LLM native parsing
  return await parseWithLLMNative(pdfBuffer, "claude-sonnet-4")
}
```

### Cost Optimization: Caching Layer

```typescript
import { createHash } from "crypto"

// Generate PDF fingerprint
const pdfHash = createHash("sha256").update(pdfBuffer).digest("hex")

// Check cache first
const cached = await redis.get(`paper:${pdfHash}`)
if (cached) return JSON.parse(cached)

// Parse and cache
const parsed = await parseWithLLM(pdfBuffer)
await redis.set(`paper:${pdfHash}`, JSON.stringify(parsed), "EX", 86400) // 24hr TTL
```

### Accuracy Improvement: Multi-Model Consensus

```typescript
// Parse with multiple models
const [claudeResult, gptResult] = await Promise.all([
  parseWithLLM(pdfBuffer, "claude-sonnet-4"),
  parseWithLLM(pdfBuffer, "gpt-4o"),
])

// Compare outputs and flag discrepancies
const discrepancies = findDifferences(claudeResult, gptResult)
if (discrepancies.length > 3) {
  // High disagreement: use more expensive model
  return await parseWithLLM(pdfBuffer, "claude-opus-4")
}

return claudeResult // Default to Claude
```

## Future Research Directions

1. **Multi-Modal Layout Understanding**: Train models that combine visual PDF layout with text
2. **Equation Detection + Specialized Parsing**: Use CV to detect equations, then OCR them separately
3. **Incremental Parsing**: Parse one section at a time to reduce token usage
4. **Transfer Learning**: Fine-tune smaller models on parsed academic papers to reduce cost
5. **Crowdsourced Corrections**: Allow users to fix parsing errors and feed back to system

## Conclusion

For Paper Explainer's use case (interactive explanation of complex academic papers), **LLM native parsing remains the best choice** despite higher cost and latency. The semantic understanding and math accuracy are irreplaceable for the explanation use case.

However, for scaling or cost-sensitive scenarios, a **hybrid approach** (GROBID for structure + Mathpix for equations) could reduce costs by 50-70% while maintaining acceptable accuracy.

The key insight: **There is no free lunch**. Fast and cheap approaches sacrifice the semantic understanding that makes this application valuable.
