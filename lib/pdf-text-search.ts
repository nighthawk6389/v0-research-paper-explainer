/**
 * Utilities for searching and highlighting text within PDF pages using PDF.js text content
 */

import type { PDFPageProxy, TextItem } from "pdfjs-dist"

export interface TextMatch {
  pageIndex: number
  matchIndex: number
  items: TextItem[]
  bounds: {
    left: number
    top: number
    width: number
    height: number
  }
}

/**
 * Search for text within a PDF page and return match positions
 * This is a best-effort approach - text extraction from PDFs is inherently fuzzy
 */
export async function findTextInPage(
  page: PDFPageProxy,
  searchText: string,
  fuzzy: boolean = true
): Promise<TextMatch[]> {
  try {
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1.0 })
    
    // Normalize search text (remove extra whitespace, lowercase if fuzzy)
    const normalizedSearch = fuzzy
      ? searchText.replace(/\s+/g, " ").trim().toLowerCase()
      : searchText.trim()
    
    // Build full text from items
    const items = textContent.items as TextItem[]
    const fullText = items.map((item) => item.str).join(" ")
    const normalizedFullText = fuzzy
      ? fullText.replace(/\s+/g, " ").toLowerCase()
      : fullText
    
    const matches: TextMatch[] = []
    let searchIndex = 0
    let matchIndex = 0
    
    // Find all occurrences
    while (searchIndex < normalizedFullText.length) {
      const index = normalizedFullText.indexOf(normalizedSearch, searchIndex)
      if (index === -1) break
      
      // Find which text items contain this match
      let charCount = 0
      let startItemIndex = -1
      let endItemIndex = -1
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        const itemLength = item.str.length + 1 // +1 for space
        
        if (startItemIndex === -1 && charCount + itemLength > index) {
          startItemIndex = i
        }
        
        if (charCount + itemLength >= index + normalizedSearch.length) {
          endItemIndex = i
          break
        }
        
        charCount += itemLength
      }
      
      if (startItemIndex !== -1 && endItemIndex !== -1) {
        // Calculate bounding box
        const matchItems = items.slice(startItemIndex, endItemIndex + 1)
        const bounds = calculateBounds(matchItems, viewport.height)
        
        matches.push({
          pageIndex: page.pageNumber - 1,
          matchIndex: matchIndex++,
          items: matchItems,
          bounds,
        })
      }
      
      searchIndex = index + normalizedSearch.length
    }
    
    return matches
  } catch (error) {
    console.error("[v0] Error finding text in page:", error)
    return []
  }
}

/**
 * Calculate bounding box for a set of text items
 */
function calculateBounds(
  items: TextItem[],
  pageHeight: number
): TextMatch["bounds"] {
  if (items.length === 0) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  for (const item of items) {
    if (!item.transform) continue
    
    const [, , , , x, y] = item.transform
    const width = item.width || 0
    const height = item.height || 10 // fallback height
    
    // PDF coordinates are bottom-left origin, need to flip Y
    const top = pageHeight - y - height
    
    minX = Math.min(minX, x)
    minY = Math.min(minY, top)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, top + height)
  }
  
  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Get a short excerpt from section content for searching
 * Takes the first ~100 chars of text content
 */
export function getSearchableExcerpt(sectionContent: string): string {
  // Remove math blocks ($$...$$)
  const withoutMath = sectionContent.replace(/\$\$.*?\$\$/gs, "")
  // Take first 100 characters
  const excerpt = withoutMath.trim().slice(0, 100)
  return excerpt
}
