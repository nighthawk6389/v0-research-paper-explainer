import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { queryWolframAlpha, formatWolframResultAsMarkdown } from './wolfram-alpha'
import type { WolframResult } from './wolfram-alpha'

const originalFetch = global.fetch

describe('Wolfram Alpha', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    process.env.WOLFRAM_ALPHA_APP_ID = 'test-app-id'
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env.WOLFRAM_ALPHA_APP_ID
  })

  it('should successfully query Wolfram Alpha API', async () => {
    const mockResponse = {
      queryresult: {
        success: true,
        pods: [
          {
            title: 'Result',
            subpods: [
              {
                plaintext: '42',
                img: {
                  src: 'https://example.com/image.png',
                  alt: 'Result image',
                },
              },
            ],
          },
        ],
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await queryWolframAlpha('integrate x^2')

    expect(result.success).toBe(true)
    expect(result.pods).toHaveLength(1)
    expect(result.pods[0].title).toBe('Result')
    expect(result.pods[0].subpods[0].plaintext).toBe('42')
  })

  it('should handle API errors gracefully', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const result = await queryWolframAlpha('invalid query')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.pods).toHaveLength(0)
  })

  it('should handle network errors', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const result = await queryWolframAlpha('test query')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network error')
  })

  it('should handle unsuccessful Wolfram Alpha queries', async () => {
    const mockResponse = {
      queryresult: {
        success: false,
        error: {
          msg: 'Invalid input',
        },
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await queryWolframAlpha('bad input')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('should extract images from subpods', async () => {
    const mockResponse = {
      queryresult: {
        success: true,
        pods: [
          {
            title: 'Plot',
            subpods: [
              {
                plaintext: '',
                img: {
                  src: 'https://example.com/plot.png',
                  alt: 'Plot of function',
                  width: 500,
                  height: 400,
                },
              },
            ],
          },
        ],
      },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const result = await queryWolframAlpha('plot sin(x)')

    expect(result.success).toBe(true)
    expect(result.pods[0].subpods[0].img).toBeDefined()
    expect(result.pods[0].subpods[0].img?.src).toBe('https://example.com/plot.png')
  })

  it('should handle missing WOLFRAM_ALPHA_APP_ID', async () => {
    delete process.env.WOLFRAM_ALPHA_APP_ID

    const result = await queryWolframAlpha('test query')

    expect(result.success).toBe(false)
    expect(result.error).toContain('WOLFRAM_ALPHA_APP_ID')
  })

  it('should include increased timeouts in the query params', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        queryresult: { success: true, pods: [] },
      }),
    })

    await queryWolframAlpha('derivative of x^3')

    const calledUrl: string = (global.fetch as any).mock.calls[0][0]
    const params = new URL(calledUrl).searchParams
    // Verify the larger timeouts are sent
    expect(Number(params.get('podtimeout'))).toBeGreaterThanOrEqual(10)
    expect(Number(params.get('scantimeout'))).toBeGreaterThanOrEqual(8)
    expect(Number(params.get('totaltimeout'))).toBeGreaterThanOrEqual(20)
  })

  it('should request image format in query params', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ queryresult: { success: true, pods: [] } }),
    })

    await queryWolframAlpha('plot sin(x)')

    const calledUrl: string = (global.fetch as any).mock.calls[0][0]
    const params = new URL(calledUrl).searchParams
    expect(params.get('format')).toContain('image')
    expect(params.get('output')).toBe('json')
  })

  it('should return image width/height from the response', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        queryresult: {
          success: true,
          pods: [{
            title: 'Plot',
            subpods: [{
              plaintext: '',
              img: { src: 'https://api.wolframalpha.com/v2/Media.jsp?s=1', alt: 'Plot', width: 600, height: 300 },
            }],
          }],
        },
      }),
    })

    const result = await queryWolframAlpha('plot x^2')

    expect(result.pods[0].subpods[0].img?.width).toBe(600)
    expect(result.pods[0].subpods[0].img?.height).toBe(300)
  })

  it('should return inputInterpretation when Input pod is present', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        queryresult: {
          success: true,
          pods: [
            {
              title: 'Input interpretation',
              subpods: [{ plaintext: 'integral x^2 dx', img: null }],
            },
            {
              title: 'Result',
              subpods: [{ plaintext: 'x^3/3 + C', img: null }],
            },
          ],
        },
      }),
    })

    const result = await queryWolframAlpha('integrate x^2')

    expect(result.inputInterpretation).toBe('integral x^2 dx')
  })

  it('should surface didyoumeans suggestion in the error message', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        queryresult: {
          success: false,
          didyoumeans: { val: 'integrate x^2' },
        },
      }),
    })

    const result = await queryWolframAlpha('integarte x^2')

    expect(result.success).toBe(false)
    expect(result.error).toContain('integrate x^2')
  })
})

// ── formatWolframResultAsMarkdown ────────────────────────────────────────────

describe('formatWolframResultAsMarkdown', () => {
  it('returns an error string when result is unsuccessful', () => {
    const result: WolframResult = {
      success: false,
      inputInterpretation: null,
      pods: [],
      error: 'Query not understood',
    }
    const md = formatWolframResultAsMarkdown(result)
    expect(md).toContain('Wolfram Alpha Error')
    expect(md).toContain('Query not understood')
  })

  it('returns markdown with pod titles as ### headers', () => {
    const result: WolframResult = {
      success: true,
      inputInterpretation: 'x^3/3',
      pods: [
        { title: 'Indefinite integral', subpods: [{ title: '', plaintext: 'x^3/3 + C', img: null }] },
      ],
      error: null,
    }
    const md = formatWolframResultAsMarkdown(result)
    expect(md).toContain('### Indefinite integral')
    expect(md).toContain('x^3/3 + C')
  })

  it('includes image markdown when a pod has an img', () => {
    const result: WolframResult = {
      success: true,
      inputInterpretation: null,
      pods: [
        {
          title: 'Plot',
          subpods: [{
            title: '',
            plaintext: null,
            img: { src: 'https://api.wolframalpha.com/v2/Media.jsp?s=x', alt: 'Plot of sin', width: 300, height: 200 },
          }],
        },
      ],
      error: null,
    }
    const md = formatWolframResultAsMarkdown(result)
    expect(md).toMatch(/!\[.*\]\(https:\/\/api\.wolframalpha\.com/)
  })

  it('skips Input and Input interpretation pods', () => {
    const result: WolframResult = {
      success: true,
      inputInterpretation: 'x^2',
      pods: [
        { title: 'Input', subpods: [{ title: '', plaintext: 'x^2', img: null }] },
        { title: 'Input interpretation', subpods: [{ title: '', plaintext: 'x squared', img: null }] },
        { title: 'Result', subpods: [{ title: '', plaintext: 'x^2 (already simplified)', img: null }] },
      ],
      error: null,
    }
    const md = formatWolframResultAsMarkdown(result)
    expect(md).not.toContain('### Input')
    expect(md).toContain('### Result')
  })

  it('returns empty-ish string for successful but pod-less results', () => {
    const result: WolframResult = {
      success: true,
      inputInterpretation: null,
      pods: [],
      error: null,
    }
    const md = formatWolframResultAsMarkdown(result)
    expect(md.trim()).toBe('')
  })
})
