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
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PaperExplainer/1.0)",
          Accept: "application/pdf",
        },
      })

      if (!response.ok) {
        return Response.json(
          { error: `Failed to fetch PDF from URL: ${response.status} ${response.statusText}` },
          { status: 400 }
        )
      }

      const contentType = response.headers.get("content-type") || ""
      
      // Handle arXiv and similar services that may redirect to HTML
      if (contentType.includes("text/html")) {
        return Response.json(
          { error: "The URL returned an HTML page instead of a PDF. For arXiv papers, use the direct PDF link (e.g., https://arxiv.org/pdf/XXXX.XXXXX)" },
          { status: 400 }
        )
      }

      const arrayBuffer = await response.arrayBuffer()
      pdfData = Buffer.from(arrayBuffer).toString("base64")
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
