/**
 * Wolfram Alpha Full Results API utility.
 * Converts queries to Wolfram Alpha and returns structured results.
 */

export interface WolframPod {
  title: string
  subpods: {
    title: string
    plaintext: string | null
    img: {
      src: string
      alt: string
      width: number
      height: number
    } | null
  }[]
}

export interface WolframResult {
  success: boolean
  inputInterpretation: string | null
  pods: WolframPod[]
  error: string | null
}

/**
 * Query Wolfram Alpha Full Results API.
 * Returns structured pods with text and images.
 */
export async function queryWolframAlpha(
  input: string
): Promise<WolframResult> {
  const appId = process.env.WOLFRAM_ALPHA_APP_ID
  if (!appId) {
    return {
      success: false,
      inputInterpretation: null,
      pods: [],
      error: "WOLFRAM_ALPHA_APP_ID is not configured",
    }
  }

  const params = new URLSearchParams({
    input,
    appid: appId,
    format: "plaintext,image",
    output: "json",
    // Increased timeouts so plots have time to render
    podtimeout: "15",
    scantimeout: "10",
    parsetimeout: "10",
    totaltimeout: "30",
    // Request image dimensions
    width: "600",
    maxwidth: "800",
    plotwidth: "600",
  })

  const apiUrl = `https://api.wolframalpha.com/v2/query?${params.toString()}`
  const startTime = Date.now()
  console.log("[wolfram] Querying Wolfram Alpha:", { input: input.substring(0, 80) })

  try {
    const response = await fetch(apiUrl, {
      // Server-side fetch — no CORS concerns here
      headers: {
        "User-Agent": "PaperExplainer/1.0",
      },
    })

    if (!response.ok) {
      console.error("[wolfram] API HTTP error:", response.status, response.statusText)
      return {
        success: false,
        inputInterpretation: null,
        pods: [],
        error: `Wolfram Alpha API error: ${response.status}`,
      }
    }

    const data = await response.json()
    const queryResult = data.queryresult
    console.log("[wolfram] Raw response summary:", {
      success: queryResult?.success,
      numpods: queryResult?.numpods,
      duration: `${Date.now() - startTime}ms`,
    })

    if (!queryResult || queryResult.success === false) {
      // Try to get didyoumeans
      const suggestion = queryResult?.didyoumeans?.val || null
      return {
        success: false,
        inputInterpretation: null,
        pods: [],
        error: suggestion
          ? `Wolfram Alpha couldn't understand the query. Did you mean: "${suggestion}"?`
          : "Wolfram Alpha couldn't interpret this query. Try rephrasing.",
      }
    }

    const pods: WolframPod[] = (queryResult.pods || []).map((pod: any) => ({
      title: pod.title,
      subpods: (pod.subpods || []).map((sub: any) => {
        const hasImg = !!sub.img?.src
        if (hasImg) {
          console.log("[wolfram] Pod image found:", {
            podTitle: pod.title,
            imgSrc: sub.img.src?.substring(0, 80),
            width: sub.img.width,
            height: sub.img.height,
          })
        }
        return {
          title: sub.title || "",
          plaintext: sub.plaintext || null,
          img: sub.img?.src
            ? {
                src: sub.img.src,
                alt: sub.img.alt || pod.title || "",
                width: parseInt(sub.img.width) || 400,
                height: parseInt(sub.img.height) || 200,
              }
            : null,
        }
      }),
    }))

    // Find input interpretation
    const inputPod = pods.find(
      (p) => p.title === "Input" || p.title === "Input interpretation"
    )
    const inputInterpretation =
      inputPod?.subpods[0]?.plaintext || null

    const imageCount = pods.flatMap(p => p.subpods).filter(s => s.img).length
    console.log("[wolfram] Result processed:", {
      podCount: pods.length,
      imageCount,
      duration: `${Date.now() - startTime}ms`,
    })

    return {
      success: true,
      inputInterpretation,
      pods,
      error: null,
    }
  } catch (err) {
    return {
      success: false,
      inputInterpretation: null,
      pods: [],
      error:
        err instanceof Error
          ? err.message
          : "Failed to query Wolfram Alpha",
    }
  }
}

/**
 * Format Wolfram Alpha results as readable markdown.
 */
export function formatWolframResultAsMarkdown(
  result: WolframResult
): string {
  if (!result.success) {
    return `**Wolfram Alpha Error:** ${result.error}`
  }

  const lines: string[] = []

  for (const pod of result.pods) {
    // Skip input interpretation pod
    if (
      pod.title === "Input" ||
      pod.title === "Input interpretation"
    )
      continue

    lines.push(`### ${pod.title}`)
    for (const subpod of pod.subpods) {
      if (subpod.plaintext) {
        lines.push(subpod.plaintext)
      }
      if (subpod.img) {
        lines.push(`![${subpod.img.alt}](${subpod.img.src})`)
      }
    }
    lines.push("")
  }

  return lines.join("\n")
}
