import { streamObject, generateText, Output } from "ai"
import { paperSchema } from "@/lib/paper-schema"
import { PARSE_PAPER_PROMPT } from "@/lib/prompts"

export const maxDuration = 300

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
      const startTime = Date.now()
      try {
        const { pdfBase64, url: pdfUrl, model } = await req.json()
        console.log("[v0] Parse paper request started", {
          hasBase64: !!pdfBase64,
          hasUrl: !!pdfUrl,
          requestedModel: model,
          timestamp: new Date().toISOString(),
        })
        
        let pdfData: string = pdfBase64
        const selectedModel = model || "anthropic/claude-sonnet-4.5"
        console.log("[v0] Using model:", selectedModel)
        
        const modelDisplayNames: Record<string, string> = {
          "anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5",
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
          console.log("[v0] Fetching PDF from URL:", pdfUrl)
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
          detail: "Preparing the PDF and instructions",
        })

        await new Promise((r) => setTimeout(r, 300))

        send("status", {
          message: `${modelName} is reading...`,
          detail:
            "Scanning every equation, figure caption, and footnote (even the boring ones) • Sent 2000+ word prompt explaining what we need",
          model: `${modelName} (${selectedModel})`,
          prompt: PARSE_PAPER_PROMPT,
        })

        console.log("[v0] Starting LLM parse with streaming structured output:", selectedModel)
        const llmStartTime = Date.now()
        
        const result = streamObject({
          model: selectedModel,
          schema: paperSchema,
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

        let lastSectionCount = 0
        
        // Stream partial results as they arrive
        for await (const partialObject of result.partialObjectStream) {
          const currentSectionCount = partialObject?.sections?.length || 0
          
          // Send progress updates when new sections are parsed
          if (currentSectionCount > lastSectionCount) {
            lastSectionCount = currentSectionCount
            const elapsed = Date.now() - llmStartTime
            send("status", {
              message: `${modelName} is parsing...`,
              detail: `Extracted ${currentSectionCount} section${currentSectionCount !== 1 ? 's' : ''} so far (${Math.round(elapsed / 1000)}s elapsed)`,
              model: `${modelName} (${selectedModel})`,
              prompt: PARSE_PAPER_PROMPT,
            })
          }
        }

        // Wait for final output
        const { object: output } = await result

        const llmDuration = Date.now() - llmStartTime
        console.log("[v0] LLM parse completed", {
          duration: `${llmDuration}ms`,
          hasOutput: !!output,
          outputType: typeof output,
          sectionsFound: output?.sections?.length,
        })

        if (!output) {
          console.log("[v0] Parse failed: No structured output returned")
          send("error", {
            error:
              "Failed to parse the paper. The LLM did not return structured output.",
          })
          close()
          return
        }

        // Validate output structure
        console.log("[v0] Validating output structure", {
          hasTitle: !!output.title,
          hasSections: !!output.sections,
          sectionsType: Array.isArray(output.sections) ? "array" : typeof output.sections,
          sectionsLength: Array.isArray(output.sections) ? output.sections.length : "N/A",
        })

        if (!Array.isArray(output.sections)) {
          console.error("[v0] Parse failed: sections is not an array", {
            sectionsType: typeof output.sections,
            sectionsValue: JSON.stringify(output.sections).substring(0, 100),
          })
          send("error", {
            error: "Failed to parse the paper. Invalid section structure.",
          })
          close()
          return
        }

        const totalDuration = Date.now() - startTime
        console.log("[v0] Parse paper request completed successfully", {
          totalDuration: `${totalDuration}ms`,
          llmDuration: `${llmDuration}ms`,
          sections: output.sections.length,
          title: output.title,
          firstSectionId: output.sections[0]?.id,
        })

        send("complete", { paper: output })
        close()
      } catch (error) {
        const totalDuration = Date.now() - startTime
        console.error("[v0] Parse paper error:", {
          error,
          duration: `${totalDuration}ms`,
          message: error instanceof Error ? error.message : "Unknown error",
        })
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
    const selectedModel = model || "anthropic/claude-sonnet-4.5"

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
