"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, Link, Loader2, FileText, X } from "lucide-react"

interface PaperUploadBarProps {
  onAnalyze: (data: {
    pdfBase64?: string
    url?: string
    pdfBlob?: Blob
    model: string
  }) => void
  isLoading: boolean
  showUploadHint?: boolean
}

export function PaperUploadBar({ onAnalyze, isLoading, showUploadHint }: PaperUploadBarProps) {
  const [url, setUrl] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [model, setModel] = useState("anthropic/claude-sonnet-4-20250514")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.type !== "application/pdf") {
        alert("Please upload a PDF file.")
        return
      }
      setFileName(file.name)
      setPdfBlob(file)
      setUrl("")

      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1]
        setPdfBase64(base64)
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const clearFile = useCallback(() => {
    setFileName(null)
    setPdfBase64(null)
    setPdfBlob(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (pdfBase64) {
        onAnalyze({ pdfBase64, pdfBlob: pdfBlob || undefined, model })
      } else if (url.trim()) {
        onAnalyze({ url: url.trim(), model })
      }
    },
    [pdfBase64, pdfBlob, url, model, onAnalyze]
  )

  const hasInput = pdfBase64 || url.trim()

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 px-4 py-3 max-w-screen-2xl mx-auto"
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-foreground" />
            <span className="font-semibold text-sm hidden sm:inline">
              Paper Explainer
            </span>
          </div>
          <Select value={model} onValueChange={setModel} disabled={isLoading}>
            <SelectTrigger className="h-8 text-xs w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic/claude-sonnet-4-20250514">
                Claude Sonnet 4
              </SelectItem>
              <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="openai/gpt-4o-mini">GPT-4o Mini</SelectItem>
              <SelectItem value="anthropic/claude-opus-4-20250514">
                Claude Opus 4
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          {fileName ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm flex-1 min-w-0">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{fileName}</span>
              <button
                type="button"
                onClick={clearFile}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Remove file"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative flex-1 min-w-0">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="Paste a PDF URL (e.g., arxiv.org/pdf/...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-9 h-9"
                disabled={isLoading}
              />
            </div>
          )}

          <span className="text-xs text-muted-foreground shrink-0 hidden md:inline">
            or
          </span>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload PDF file"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className={`shrink-0 ${showUploadHint ? "ring-2 ring-primary ring-offset-2 animate-pulse" : ""}`}
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Upload</span>
          </Button>
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={!hasInput || isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span className="hidden sm:inline">Analyzing...</span>
            </>
          ) : (
            "Analyze"
          )}
        </Button>
      </form>
    </header>
  )
}
