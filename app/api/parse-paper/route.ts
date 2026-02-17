import { generateText, Output } from "ai"
import { paperSchema } from "@/lib/paper-schema"
import { PARSE_PAPER_PROMPT } from "@/lib/prompts"

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { pdfBase64, url } = await req.json()

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
      model: "anthropic/claude-sonnet-4-20250514",
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
