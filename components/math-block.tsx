"use client"

import { useMemo } from "react"
import katex from "katex"

interface MathBlockProps {
  latex: string
  displayMode?: boolean
  label?: string | null
  className?: string
}

export function MathBlock({
  latex,
  displayMode = true,
  label,
  className = "",
}: MathBlockProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
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
        },
      })
    } catch {
      return null
    }
  }, [latex, displayMode])

  if (!html) {
    return (
      <code
        className={`block bg-muted px-3 py-2 rounded text-sm font-mono overflow-x-auto ${className}`}
      >
        {latex}
      </code>
    )
  }

  if (displayMode) {
    return (
      <div className={`relative my-3 ${className}`}>
        <div
          className="overflow-x-auto py-3 px-4 bg-muted/40 rounded-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {label && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    )
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
