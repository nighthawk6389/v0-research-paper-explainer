/**
 * Utilities for proxying Wolfram Alpha image URLs through our server-side
 * proxy (/api/wolfram-image) to avoid CORS issues in the browser.
 */

const WOLFRAM_HOST = "api.wolframalpha.com"

/**
 * Rewrite a Wolfram Alpha image URL to go through the local proxy.
 * Non-Wolfram URLs are returned unchanged.
 */
export function proxyWolframUrl(src: string): string {
  if (!src) return src
  try {
    const u = new URL(src)
    if (u.hostname === WOLFRAM_HOST) {
      return `/api/wolfram-image?url=${encodeURIComponent(src)}`
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return src
}

/**
 * Returns true when the URL looks like a Wolfram Alpha image.
 */
export function isWolframImageUrl(src: string): boolean {
  try {
    return new URL(src).hostname === WOLFRAM_HOST
  } catch {
    return false
  }
}
