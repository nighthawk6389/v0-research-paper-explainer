# PDF Text-Level Highlighting

## Current Implementation

The PDF viewer currently highlights at the **page level** - when you hover over a section in the structured view, the entire page containing that section is highlighted with a blue border and subtle background overlay.

## Why Text-Level Highlighting is Challenging

Implementing precise text-level highlighting (highlighting just the specific paragraph or sentences) is technically complex for several reasons:

### 1. **No Position Data from LLM Extraction**
The LLM extracts text content from the PDF but has no knowledge of:
- Where on the page the text appears (x, y coordinates)
- Text bounding boxes
- Line breaks and text flow
- Column layouts

### 2. **PDF.js Text Layer Limitations**
While PDF.js provides a text layer that could theoretically be searched, this approach has significant challenges:

- **Text extraction inconsistencies**: PDF text extraction is fuzzy - the text from the LLM may not exactly match the text from PDF.js due to:
  - Ligatures (fi, fl, etc.)
  - Hyphenation differences
  - Whitespace handling
  - Special characters and encoding
  - Math symbols may be represented differently

- **Layout complexity**: Academic papers often have:
  - Multi-column layouts
  - Equations that span multiple lines
  - Tables and figures
  - Footnotes and side notes
  - Text that flows around figures

- **Performance**: Searching and matching text on every hover event would be computationally expensive

### 3. **Math Content**
Mathematical equations are particularly problematic:
- They may be rendered as images or special glyphs in the PDF
- LaTeX extracted by the LLM may not match the actual text representation
- Equation positioning is often complex (inline, display, multi-line)

## Possible Solutions

### Option 1: Search-Based Highlighting (Partial Implementation Available)

A text search approach has been partially implemented in `/lib/pdf-text-search.ts`. This approach:

**Pros:**
- Doesn't require changes to the extraction pipeline
- Works with current paragraph-level sections

**Cons:**
- Fuzzy matching is unreliable
- May highlight wrong text if multiple similar paragraphs exist
- Doesn't work well for math-heavy sections
- Performance overhead

**Status:** Utility functions created but not integrated into the UI due to reliability concerns.

### Option 2: Enhanced LLM Extraction with Coordinates

Have the LLM also extract bounding box information during the initial parse.

**Pros:**
- Most accurate approach
- Would enable precise highlighting

**Cons:**
- LLMs cannot extract position data from PDFs - they only see rendered text
- Would require switching to a vision-based extraction approach
- Would significantly increase parsing cost and time
- PDFs would need to be converted to images first

### Option 3: PDF Annotation Layer

Use PDF.js annotation layer to programmatically add highlights.

**Pros:**
- Native PDF feature
- Persistent across sessions

**Cons:**
- Requires modifying the PDF
- Still needs accurate text positions
- Complex to implement

### Option 4: OCR with Position Data

Use OCR (like Tesseract or cloud OCR services) to extract text with bounding boxes.

**Pros:**
- Provides exact position data
- Works for scanned PDFs

**Cons:**
- Requires additional processing step
- Significantly slower
- Additional cost for cloud OCR
- OCR errors, especially for equations

### Option 5: Hybrid Approach

Combine multiple techniques:
1. Use PDF.js text layer for rough position estimates
2. Use the first sentence of each section as a "search anchor"
3. Apply fuzzy matching with generous bounding boxes
4. Cache matches to avoid repeated searches

**Pros:**
- Best balance of accuracy and performance
- Degrades gracefully

**Cons:**
- Still unreliable for complex layouts
- Significant implementation complexity

## Recommendation

**Current recommendation: Keep page-level highlighting** for these reasons:

1. **Reliability**: Page-level highlighting always works correctly
2. **Performance**: No search overhead on every hover
3. **User experience**: With paragraph-level sections, the highlighted page is usually enough context
4. **Simplicity**: Maintainable and robust

**If text-level highlighting is critical**, the best path forward is:

1. Use a specialized PDF parsing service that provides position data (like Adobe PDF Extract, GROBID, or Marker)
2. Store bounding boxes for each section during the initial parse
3. Render highlights using absolutely positioned div overlays
4. This would require significant changes to the architecture but would be reliable

## Alternative UX Solutions

Instead of text highlighting, consider:

1. **Section preview on hover**: Show a tooltip with the section text (already implemented via the collapsible preview)
2. **Smooth scroll-to-page**: Improve the scroll animation to make it more obvious which page is relevant (already implemented)
3. **Mini-map navigation**: Add a thumbnail view showing which page contains which sections
4. **Page badges**: Show small section indicators on page thumbnails

## For Developers

If you want to experiment with text-level highlighting, the utility functions in `/lib/pdf-text-search.ts` provide a starting point. To integrate:

1. Import `findTextInPage` and `getSearchableExcerpt`
2. In the PDF viewer, use the PDF.js page object to search for section text
3. Render overlay divs using the returned bounds
4. Scale the coordinates by the current zoom level
5. Handle edge cases (no matches, multiple matches, etc.)

Be prepared for inconsistent results and significant debugging.
