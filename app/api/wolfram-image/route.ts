/**
 * Server-side proxy for Wolfram Alpha image URLs.
 * This avoids CORS and referrer issues when displaying Wolfram images in the browser.
 * Usage: /api/wolfram-image?url=<encoded-wolfram-image-url>
 */
export const runtime = "nodejs"

const ALLOWED_HOST = "api.wolframalpha.com"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const imageUrl = searchParams.get("url")

  if (!imageUrl) {
    return new Response("Missing url parameter", { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return new Response("Invalid URL", { status: 400 })
  }

  // Only proxy Wolfram Alpha image URLs to prevent abuse
  if (parsed.hostname !== ALLOWED_HOST) {
    console.warn("[wolfram-proxy] Rejected non-Wolfram URL:", parsed.hostname)
    return new Response("Only Wolfram Alpha URLs are allowed", { status: 403 })
  }

  const startTime = Date.now()
  console.log("[wolfram-proxy] Fetching image:", imageUrl.substring(0, 100))

  try {
    const response = await fetch(imageUrl, {
      headers: {
        // Avoid sending a referrer that could be blocked
        Referer: "https://www.wolframalpha.com/",
        "User-Agent":
          "Mozilla/5.0 (compatible; PaperExplainer/1.0; +https://wolframalpha.com)",
      },
    })

    if (!response.ok) {
      console.error("[wolfram-proxy] Upstream error:", response.status, response.statusText)
      return new Response(`Upstream error: ${response.status}`, { status: response.status })
    }

    const contentType = response.headers.get("content-type") || "image/gif"
    const buffer = await response.arrayBuffer()

    console.log("[wolfram-proxy] Served image", {
      contentType,
      bytes: buffer.byteLength,
      duration: `${Date.now() - startTime}ms`,
    })

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache for 10 minutes - Wolfram URLs have a session component but are stable
        "Cache-Control": "public, max-age=600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    console.error("[wolfram-proxy] Fetch error:", err)
    return new Response("Failed to fetch image", { status: 502 })
  }
}
