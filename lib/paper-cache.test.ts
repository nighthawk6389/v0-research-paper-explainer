import { describe, it, expect, beforeEach } from 'vitest'
import { getCachedPaper, setCachedPaper, clearPaperCache } from './paper-cache'
import type { Paper } from './paper-schema'

describe('Paper Cache', () => {
  const mockPaper: Paper = {
    title: 'Test Paper',
    authors: ['Author 1', 'Author 2'],
    abstract: 'Test abstract',
    sections: [
      {
        id: 'section-0',
        heading: 'Abstract',
        content: [
          { type: 'text' as const, text: 'Test abstract content' },
        ],
        pageNumbers: [1],
      },
      {
        id: 'section-1',
        heading: 'Introduction',
        content: [
          { type: 'text' as const, text: 'Test introduction content' },
        ],
        pageNumbers: [1, 2],
      },
    ],
  }

  const testPdfBase64 = 'base64encodedpdfdata'
  const testModel = 'anthropic/claude-sonnet-4.5'

  beforeEach(async () => {
    // Clear the cache before each test
    await clearPaperCache()
  })

  it('should return null when cache is empty', async () => {
    const cached = await getCachedPaper(testPdfBase64)
    expect(cached).toBeNull()
  })

  it('should cache and retrieve a paper by PDF base64', async () => {
    await setCachedPaper(mockPaper, testPdfBase64, null, testModel)
    
    const cached = await getCachedPaper(testPdfBase64)
    
    expect(cached).not.toBeNull()
    expect(cached?.paper.title).toBe(mockPaper.title)
    expect(cached?.paper.sections.length).toBe(mockPaper.sections.length)
    expect(cached?.model).toBe(testModel)
  })

  it('should cache and retrieve a paper by URL', async () => {
    const testUrl = 'https://example.com/paper.pdf'
    
    await setCachedPaper(mockPaper, '', testUrl, testModel)
    
    const cached = await getCachedPaper('', testUrl)
    
    expect(cached).not.toBeNull()
    expect(cached?.paper.title).toBe(mockPaper.title)
    expect(cached?.pdfUrl).toBe(testUrl)
  })

  it('should return the same paper for the same PDF content', async () => {
    await setCachedPaper(mockPaper, testPdfBase64, null, testModel)
    
    const cached1 = await getCachedPaper(testPdfBase64)
    const cached2 = await getCachedPaper(testPdfBase64)
    
    expect(cached1).not.toBeNull()
    expect(cached2).not.toBeNull()
    expect(cached1?.paper.title).toBe(cached2?.paper.title)
  })

  it('should clear all cached papers', async () => {
    await setCachedPaper(mockPaper, testPdfBase64, null, testModel)
    
    let cached = await getCachedPaper(testPdfBase64)
    expect(cached).not.toBeNull()
    
    await clearPaperCache()
    
    cached = await getCachedPaper(testPdfBase64)
    expect(cached).toBeNull()
  })

  it('should handle empty content gracefully', async () => {
    const cached = await getCachedPaper('', '')
    expect(cached).toBeNull()
  })

  it('should store timestamp with cached paper', async () => {
    const beforeCache = Date.now()
    
    await setCachedPaper(mockPaper, testPdfBase64, null, testModel)
    
    const afterCache = Date.now()
    const cached = await getCachedPaper(testPdfBase64)
    
    expect(cached).not.toBeNull()
    expect(cached!.timestamp).toBeGreaterThanOrEqual(beforeCache)
    expect(cached!.timestamp).toBeLessThanOrEqual(afterCache)
  })

  it('should overwrite existing cache for same PDF', async () => {
    const updatedPaper: Paper = {
      ...mockPaper,
      title: 'Updated Paper Title',
    }
    
    await setCachedPaper(mockPaper, testPdfBase64, null, testModel)
    await setCachedPaper(updatedPaper, testPdfBase64, null, testModel)
    
    const cached = await getCachedPaper(testPdfBase64)
    
    expect(cached?.paper.title).toBe('Updated Paper Title')
  })
})
