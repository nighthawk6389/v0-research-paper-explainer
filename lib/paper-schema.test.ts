import { describe, it, expect } from 'vitest'
import { paperSchema } from './paper-schema'

describe('Paper Schema', () => {
  it('should validate a valid paper structure', () => {
    const validPaper = {
      title: 'Test Paper',
      authors: ['Author 1', 'Author 2'],
      abstract: 'This is a test abstract',
      sections: [
        {
          id: 'section-0',
          heading: 'Introduction',
          type: 'text',
          content: [
            { type: 'text', value: 'Introduction text', label: null, isInline: null },
          ],
          pageNumbers: [1],
        },
      ],
    }

    const result = paperSchema.safeParse(validPaper)
    expect(result.success).toBe(true)
  })

  it('should validate paper with math content', () => {
    const paperWithMath = {
      title: 'Math Paper',
      authors: ['Mathematician'],
      abstract: 'Paper about equations',
      sections: [
        {
          id: 'section-1',
          heading: 'Equations',
          type: 'math',
          content: [
            { type: 'text', value: 'Consider the equation:', label: null, isInline: null },
            { type: 'math', value: 'E = mc^2', isInline: false, label: null },
            { type: 'text', value: 'This is famous.', label: null, isInline: null },
          ],
          pageNumbers: [2],
        },
      ],
    }

    const result = paperSchema.safeParse(paperWithMath)
    expect(result.success).toBe(true)
  })

  it('should reject paper without title', () => {
    const invalidPaper = {
      authors: ['Author'],
      abstract: 'Abstract',
      sections: [],
    }

    const result = paperSchema.safeParse(invalidPaper)
    expect(result.success).toBe(false)
  })

  it('should reject paper without sections', () => {
    const invalidPaper = {
      title: 'Title',
      authors: ['Author'],
      abstract: 'Abstract',
    }

    const result = paperSchema.safeParse(invalidPaper)
    expect(result.success).toBe(false)
  })

  it('should validate inline math', () => {
    const paperWithInlineMath = {
      title: 'Test',
      authors: ['Author'],
      abstract: 'Abstract',
      sections: [
        {
          id: 'section-1',
          heading: 'Math',
          type: 'math',
          content: [
            { type: 'math', value: 'x^2', isInline: true, label: null },
          ],
          pageNumbers: [1],
        },
      ],
    }

    const result = paperSchema.safeParse(paperWithInlineMath)
    expect(result.success).toBe(true)
  })

  it('should validate optional math label', () => {
    const paperWithLabeledMath = {
      title: 'Test',
      authors: ['Author'],
      abstract: 'Abstract',
      sections: [
        {
          id: 'section-1',
          heading: 'Equations',
          type: 'math',
          content: [
            { type: 'math', value: 'E = mc^2', isInline: false, label: '(1)' },
          ],
          pageNumbers: [1],
        },
      ],
    }

    const result = paperSchema.safeParse(paperWithLabeledMath)
    expect(result.success).toBe(true)
    
    if (result.success) {
      const mathBlock = result.data.sections[0].content[0]
      if (mathBlock.type === 'math') {
        expect(mathBlock.label).toBe('(1)')
      }
    }
  })

  it('should handle multiple page numbers', () => {
    const paper = {
      title: 'Test',
      authors: ['Author'],
      abstract: 'Abstract',
      sections: [
        {
          id: 'section-1',
          heading: 'Long Section',
          type: 'text',
          content: [{ type: 'text', value: 'Content', label: null, isInline: null }],
          pageNumbers: [1, 2, 3],
        },
      ],
    }

    const result = paperSchema.safeParse(paper)
    expect(result.success).toBe(true)
    
    if (result.success) {
      expect(result.data.sections[0].pageNumbers).toEqual([1, 2, 3])
    }
  })
})
