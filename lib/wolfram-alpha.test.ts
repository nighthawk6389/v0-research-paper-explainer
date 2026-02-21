import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { queryWolframAlpha } from './wolfram-alpha'

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
})
