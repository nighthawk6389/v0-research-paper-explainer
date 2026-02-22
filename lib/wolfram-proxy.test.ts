import { describe, it, expect } from "vitest"
import { proxyWolframUrl, isWolframImageUrl } from "./wolfram-proxy"

describe("proxyWolframUrl", () => {
  it("rewrites Wolfram Alpha image URLs through the local proxy", () => {
    const wolframUrl =
      "https://api.wolframalpha.com/v2/Media.jsp?MSPStoreType=image%2Fgif&s=abc"
    const result = proxyWolframUrl(wolframUrl)
    expect(result).toMatch(/^\/api\/wolfram-image\?url=/)
    expect(result).toContain(encodeURIComponent(wolframUrl))
  })

  it("leaves non-Wolfram URLs unchanged", () => {
    const url = "https://example.com/image.png"
    expect(proxyWolframUrl(url)).toBe(url)
  })

  it("leaves relative paths unchanged", () => {
    expect(proxyWolframUrl("/static/image.png")).toBe("/static/image.png")
  })

  it("returns empty string unchanged", () => {
    expect(proxyWolframUrl("")).toBe("")
  })

  it("does not rewrite partial matches like api.wolframalpha.com.evil.com", () => {
    const tricky = "https://api.wolframalpha.com.evil.com/img.gif"
    expect(proxyWolframUrl(tricky)).toBe(tricky)
  })

  it("encodes the full Wolfram URL including query string", () => {
    const wolframUrl =
      "https://api.wolframalpha.com/v2/Media.jsp?s=123&q=sin(x)&type=image/gif"
    const result = proxyWolframUrl(wolframUrl)
    expect(decodeURIComponent(result.split("?url=")[1])).toBe(wolframUrl)
  })
})

describe("isWolframImageUrl", () => {
  it("returns true for api.wolframalpha.com URLs", () => {
    expect(
      isWolframImageUrl("https://api.wolframalpha.com/v2/Media.jsp?s=abc")
    ).toBe(true)
  })

  it("returns false for other domains", () => {
    expect(isWolframImageUrl("https://example.com/img.png")).toBe(false)
  })

  it("returns false for invalid strings", () => {
    expect(isWolframImageUrl("not-a-url")).toBe(false)
    expect(isWolframImageUrl("")).toBe(false)
  })

  it("returns false for wolframalpha.com subdomain-spoofing attempts", () => {
    expect(isWolframImageUrl("https://api.wolframalpha.com.evil.com/x")).toBe(false)
  })
})
