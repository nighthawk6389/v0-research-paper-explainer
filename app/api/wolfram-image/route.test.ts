import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { GET } from "./route"

const WOLFRAM_IMAGE_URL =
  "https://api.wolframalpha.com/v2/Media.jsp?MSPStoreType=image%2Fgif&s=abc123"

const originalFetch = global.fetch

describe("/api/wolfram-image proxy route", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  describe("input validation", () => {
    it("returns 400 when url query param is missing", async () => {
      const req = new Request("http://localhost/api/wolfram-image")
      const res = await GET(req)
      expect(res.status).toBe(400)
    })

    it("returns 400 for an invalid (non-URL) value", async () => {
      const req = new Request("http://localhost/api/wolfram-image?url=not-a-url")
      const res = await GET(req)
      expect(res.status).toBe(400)
    })

    it("returns 403 for URLs from hosts other than api.wolframalpha.com", async () => {
      const evil = encodeURIComponent("https://evil.example.com/image.png")
      const req = new Request(`http://localhost/api/wolfram-image?url=${evil}`)
      const res = await GET(req)
      expect(res.status).toBe(403)
    })

    it("returns 403 for a Wolfram URL with a tampered hostname", async () => {
      const tricky = encodeURIComponent("https://api.wolframalpha.com.evil.com/img.gif")
      const req = new Request(`http://localhost/api/wolfram-image?url=${tricky}`)
      const res = await GET(req)
      expect(res.status).toBe(403)
    })
  })

  describe("successful proxy", () => {
    it("fetches and returns the image with correct content-type and CORS headers", async () => {
      const fakeBuffer = new Uint8Array([0x47, 0x49, 0x46]).buffer
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: { get: (h: string) => (h === "content-type" ? "image/gif" : null) },
        arrayBuffer: async () => fakeBuffer,
      })

      const req = new Request(
        `http://localhost/api/wolfram-image?url=${encodeURIComponent(WOLFRAM_IMAGE_URL)}`
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toBe("image/gif")
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
      expect(res.headers.get("Cache-Control")).toContain("max-age=600")
    })

    it("uses image/gif as fallback when upstream content-type is missing", async () => {
      const fakeBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => fakeBuffer,
      })

      const req = new Request(
        `http://localhost/api/wolfram-image?url=${encodeURIComponent(WOLFRAM_IMAGE_URL)}`
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toBe("image/gif")
    })

    it("forwards the Wolfram URL with a proper Referer and User-Agent", async () => {
      const fakeBuffer = new ArrayBuffer(4)
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "image/gif" },
        arrayBuffer: async () => fakeBuffer,
      })

      const req = new Request(
        `http://localhost/api/wolfram-image?url=${encodeURIComponent(WOLFRAM_IMAGE_URL)}`
      )
      await GET(req)

      const [calledUrl, calledInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(calledUrl).toBe(WOLFRAM_IMAGE_URL)
      expect(calledInit.headers["Referer"]).toContain("wolframalpha.com")
      expect(calledInit.headers["User-Agent"]).toBeTruthy()
    })
  })

  describe("upstream error handling", () => {
    it("returns upstream status code on non-2xx response", async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      })

      const req = new Request(
        `http://localhost/api/wolfram-image?url=${encodeURIComponent(WOLFRAM_IMAGE_URL)}`
      )
      const res = await GET(req)
      expect(res.status).toBe(404)
    })

    it("returns 502 when the upstream fetch throws a network error", async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("ECONNREFUSED")
      )

      const req = new Request(
        `http://localhost/api/wolfram-image?url=${encodeURIComponent(WOLFRAM_IMAGE_URL)}`
      )
      const res = await GET(req)
      expect(res.status).toBe(502)
    })
  })
})
