"use client"

import { useMemo } from "react"
import katex from "katex"
import { Sigma } from "lucide-react"

interface MathBlockProps {
  latex: string
  displayMode?: boolean
  label?: string | null
  className?: string
  onDeepDive?: (latex: string) => void
  deepDiveLabel?: string
}

export function MathBlock({
  latex,
  displayMode = true,
  label,
  className = "",
  onDeepDive,
  deepDiveLabel,
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
      <div className={`group/math relative my-3 ${className}`}>
        <div
          className="overflow-x-auto py-3 px-4 bg-muted/40 rounded-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {label && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {label}
          </span>
        )}
        {onDeepDive && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeepDive(latex)
            }}
            className="absolute top-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 opacity-0 group-hover/math:opacity-100 transition-opacity hover:bg-orange-200 dark:hover:bg-orange-800"
            title={deepDiveLabel || "Deep dive with Wolfram Alpha"}
          >
            <Sigma className="size-3" />
            {deepDiveLabel || "Deep Dive"}
          </button>
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
