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
    podtimeout: "8",
    scantimeout: "5",
  })

  try {
    const response = await fetch(
      `https://api.wolframalpha.com/v2/query?${params.toString()}`
    )

    if (!response.ok) {
      return {
        success: false,
        inputInterpretation: null,
        pods: [],
        error: `Wolfram Alpha API error: ${response.status}`,
      }
    }

    const data = await response.json()
    const queryResult = data.queryresult

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
      subpods: (pod.subpods || []).map((sub: any) => ({
        title: sub.title || "",
        plaintext: sub.plaintext || null,
        img: sub.img
          ? {
              src: sub.img.src,
              alt: sub.img.alt || "",
              width: parseInt(sub.img.width) || 300,
              height: parseInt(sub.img.height) || 100,
            }
          : null,
      })),
    }))

    // Find input interpretation
    const inputPod = pods.find(
      (p) => p.title === "Input" || p.title === "Input interpretation"
    )
    const inputInterpretation =
      inputPod?.subpods[0]?.plaintext || null

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
