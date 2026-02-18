"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
// TODO: Re-enable after remark-gfm is installed
// import remarkGfm from "remark-gfm"

interface MarkdownContentProps {
  content: string
}

/**
 * Pre-process markdown content to fix common LLM output issues:
 * - Fix LaTeX alignment environments that break markdown parsing
 * - Ensure proper spacing around display math
 * - Fix escaped dollar signs
 */
function preprocessContent(content: string): string {
  let processed = content

  // Fix \begin{align} and similar environments that aren't wrapped in $$ 
  processed = processed.replace(
    /(?<!\$)\s*(\\begin\{(?:align|aligned|equation|gather|gathered|cases|pmatrix|bmatrix|vmatrix|array|matrix|split)\*?\}[\s\S]*?\\end\{(?:align|aligned|equation|gather|gathered|cases|pmatrix|bmatrix|vmatrix|array|matrix|split)\*?\})\s*(?!\$)/g,
    (match, env) => `\n\n$$\n${env.trim()}\n$$\n\n`
  )

  // Ensure display math blocks have newlines around them for proper parsing
  processed = processed.replace(/([^\n])\$\$/g, "$1\n$$")
  processed = processed.replace(/\$\$([^\n])/g, "$$\n$1")

  return processed
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const processed = useMemo(() => preprocessContent(content), [content])

  return (
    <div className="explanation-content prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeKatex, {
            trust: true,
            strict: false,
            macros: {
              "\\R": "\\mathbb{R}",
              "\\N": "\\mathbb{N}",
              "\\Z": "\\mathbb{Z}",
              "\\E": "\\mathbb{E}",
              "\\P": "\\mathbb{P}",
              "\\argmin": "\\operatorname{argmin}",
              "\\argmax": "\\operatorname{argmax}",
              "\\text": "\\mathrm",
            },
          }],
        ]}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
