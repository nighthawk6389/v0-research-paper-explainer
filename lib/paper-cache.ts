import type { Paper } from "./paper-schema"

// Simple hash function for PDF content
async function hashPdfContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// IndexedDB wrapper for paper cache
const DB_NAME = "paper-cache"
const STORE_NAME = "papers"
const DB_VERSION = 1

// Check if we're in a browser environment
function isClient(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined"
}

function openDB(): Promise<IDBDatabase> {
  if (!isClient()) {
    return Promise.reject(new Error("IndexedDB not available"))
  }
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "hash" })
      }
    }
  })
}

export interface CachedPaper {
  hash: string
  paper: Paper
  pdfBase64: string
  pdfUrl: string | null
  timestamp: number
  model: string
}

export async function getCachedPaper(
  pdfBase64?: string,
  pdfUrl?: string
): Promise<CachedPaper | null> {
  if (!isClient()) return null
  
  try {
    const content = pdfBase64 || pdfUrl || ""
    if (!content) return null

    const hash = await hashPdfContent(content)
    const db = await openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(hash)

      request.onsuccess = () => {
        const cached = request.result as CachedPaper | undefined
        if (cached) {
          console.log("[v0] ✓ Cache HIT - Found cached paper", {
            title: cached.paper.title,
            age: `${Math.round((Date.now() - cached.timestamp) / 1000 / 60)}min`,
            sections: cached.paper.sections.length,
            model: cached.model,
          })
        } else {
          console.log("[v0] ✗ Cache MISS - No cached paper found for this PDF")
        }
        resolve(cached || null)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("[v0] Cache read error:", error)
    return null
  }
}

export async function setCachedPaper(
  paper: Paper,
  pdfBase64: string,
  pdfUrl: string | null,
  model: string
): Promise<void> {
  if (!isClient()) return
  
  try {
    const content = pdfBase64 || pdfUrl || ""
    if (!content) return

    const hash = await hashPdfContent(content)
    const db = await openDB()

    const cached: CachedPaper = {
      hash,
      paper,
      pdfBase64,
      pdfUrl,
      timestamp: Date.now(),
      model,
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(cached)

      request.onsuccess = () => {
        console.log("[v0] Cached paper", {
          title: paper.title,
          sections: paper.sections.length,
        })
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("[v0] Cache write error:", error)
  }
}

export async function clearPaperCache(): Promise<void> {
  if (!isClient()) return
  
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        console.log("[v0] Cache cleared")
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error("[v0] Cache clear error:", error)
  }
}
