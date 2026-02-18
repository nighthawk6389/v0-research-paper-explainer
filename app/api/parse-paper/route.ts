import { generateText, Output } from "ai"
import { paperSchema } from "@/lib/paper-schema"
import { PARSE_PAPER_PROMPT } from "@/lib/prompts"

export const maxDuration = 60

// Helper to create SSE encoder
function createSSEStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    start(c) {
      controller = c
    },
  })

  const send = (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    controller.enqueue(encoder.encode(message))
  }

  const close = () => controller.close()

  return { stream, send, close }
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const stream = url.searchParams.get("stream") === "true"

  // If streaming is requested, use SSE
  if (stream) {
    const { stream: sseStream, send, close } = createSSEStream()

    // Process in background
    ;(async () => {
      try {
        const { pdfBase64, url: pdfUrl, model } = await req.json()
        let pdfData: string = pdfBase64
        const selectedModel = model || "anthropic/claude-sonnet-4.5-20250219"
        
        const modelDisplayNames: Record<string, string> = {
          "anthropic/claude-sonnet-4.5-20250219": "Claude Sonnet 4.5",
          "anthropic/claude-haiku-4.5": "Claude Haiku 4.5",
          "openai/gpt-4o": "GPT-4o",
          "openai/gpt-4o-mini": "GPT-4o Mini",
          "anthropic/claude-opus-4-20250514": "Claude Opus 4",
        }

        send("status", {
          message: "Downloading paper...",
          detail: "Fetching PDF from the academic archives",
        })

        // If URL provided, fetch the PDF
        if (pdfUrl && !pdfBase64) {
          try {
            const response = await fetch(pdfUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                Accept: "application/pdf,application/octet-stream,*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                Referer: new URL(pdfUrl).origin + "/",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-origin",
              },
              redirect: "follow",
            })

            if (!response.ok) {
              const isAuthError =
                response.status === 403 || response.status === 401
              const hint = isAuthError
                ? " This publisher blocks automated downloads. Please download the PDF in your browser, then upload it here using the Upload button."
                : ""
              send("error", {
                error: `Failed to fetch PDF from URL (${response.status}).${hint}`,
                fetchFailed: isAuthError,
              })
              close()
              return
            }

            const contentType = response.headers.get("content-type") || ""

            if (
              contentType.includes("text/html") &&
              !contentType.includes("application/pdf")
            ) {
              send("error", {
                error:
                  "The URL returned an HTML page instead of a PDF. For arXiv papers, use the direct PDF link (e.g., https://arxiv.org/pdf/XXXX.XXXXX). For other publishers, download the PDF and upload it directly.",
                fetchFailed: true,
              })
              close()
              return
            }

            const arrayBuffer = await response.arrayBuffer()
            pdfData = Buffer.from(arrayBuffer).toString("base64")
          } catch (fetchError) {
            send("error", {
              error:
                "Could not download the PDF from this URL. Please download it in your browser and upload the file directly.",
              fetchFailed: true,
            })
            close()
            return
          }
        }

        if (!pdfData) {
          send("error", {
            error:
              "No PDF data provided. Please upload a PDF or provide a URL.",
          })
          close()
          return
        }

        const modelName = modelDisplayNames[selectedModel] || selectedModel
        
        send("status", {
          message: `Preparing to meet ${modelName}...`,
          detail: `Waking up ${modelName} from its digital slumber`,
        })

        await new Promise((r) => setTimeout(r, 500))

        send("status", {
          message: `Asking ${modelName} very nicely...`,
          detail:
            "Sending PDF with a 2000+ word prompt explaining what we need",
          model: `${modelName} (${selectedModel})`,
        })

        await new Promise((r) => setTimeout(r, 300))

        send("status", {
          message: `${modelName} is reading...`,
          detail:
            "Scanning every equation, figure caption, and footnote (even the boring ones)",
        })

        const { output } = await generateText({
          model: selectedModel,
          output: Output.object({
            schema: paperSchema,
          }),
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: PARSE_PAPER_PROMPT,
                },
                {
                  type: "file",
                  data: pdfData,
                  mediaType: "application/pdf",
                  filename: "paper.pdf",
                },
              ],
            },
          ],
        })

        if (!output) {
          send("error", {
            error:
              "Failed to parse the paper. The LLM did not return structured output.",
          })
          close()
          return
        }

        send("complete", { paper: output })
        close()
      } catch (error) {
        console.error("Parse paper error:", error)
        const message =
          error instanceof Error ? error.message : "Unknown error occurred"
        send("error", { error: message })
        close()
      }
    })()

    return new Response(sseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  // Non-streaming fallback (original behavior)
  try {
    const { pdfBase64, url, model } = await req.json()
    const selectedModel = model || "anthropic/claude-sonnet-4.5-20250219"

    let pdfData: string = pdfBase64

    // If URL provided, fetch the PDF
    if (url && !pdfBase64) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept:
              "application/pdf,application/octet-stream,*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            Referer: new URL(url).origin + "/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
          },
          redirect: "follow",
        })

        if (!response.ok) {
          const isAuthError = response.status === 403 || response.status === 401
          const hint = isAuthError
            ? " This publisher blocks automated downloads. Please download the PDF in your browser, then upload it here using the Upload button."
            : ""
          return Response.json(
            {
              error: `Failed to fetch PDF from URL (${response.status}).${hint}`,
              fetchFailed: isAuthError,
            },
            { status: 400 }
          )
        }

        const contentType = response.headers.get("content-type") || ""

        // Handle arXiv and similar services that may redirect to HTML
        if (
          contentType.includes("text/html") &&
          !contentType.includes("application/pdf")
        ) {
          return Response.json(
            {
              error:
                "The URL returned an HTML page instead of a PDF. For arXiv papers, use the direct PDF link (e.g., https://arxiv.org/pdf/XXXX.XXXXX). For other publishers, download the PDF and upload it directly.",
              fetchFailed: true,
            },
            { status: 400 }
          )
        }

        const arrayBuffer = await response.arrayBuffer()
        pdfData = Buffer.from(arrayBuffer).toString("base64")
      } catch (fetchError) {
        return Response.json(
          {
            error:
              "Could not download the PDF from this URL. Please download it in your browser and upload the file directly.",
            fetchFailed: true,
          },
          { status: 400 }
        )
      }
    }

    if (!pdfData) {
      return Response.json(
        { error: "No PDF data provided. Please upload a PDF or provide a URL." },
        { status: 400 }
      )
    }

    const { output } = await generateText({
      model: selectedModel,
      output: Output.object({
        schema: paperSchema,
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: PARSE_PAPER_PROMPT,
            },
            {
              type: "file",
              data: pdfData,
              mediaType: "application/pdf",
              filename: "paper.pdf",
            },
          ],
        },
      ],
    })

    if (!output) {
      return Response.json(
        { error: "Failed to parse the paper. The LLM did not return structured output." },
        { status: 500 }
      )
    }

    return Response.json({ paper: output })
  } catch (error) {
    console.error("Parse paper error:", error)
    const message = error instanceof Error ? error.message : "Unknown error occurred"
    return Response.json({ error: message }, { status: 500 })
  }
}
