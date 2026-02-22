"use client"

import { openDB, type IDBPDatabase } from "./idb-shim"
import { sha256 } from "@/lib/hash"
import {
  enrichPaperWithBlockIds,
  getPaperStats,
} from "@/lib/paper-utils"
import type { Paper } from "@/lib/paper-schema"
import type {
  PaperRecord,
  Conversation,
  Artifact,
  ArtifactContent,
  ListConversationsFilters,
} from "./types"
import { PARSE_VERSION } from "./types"

const DB_NAME = "paper-explainer"
const DB_VERSION = 1
const OLD_DB_NAME = "paper-cache"
const OLD_STORE_NAME = "papers"

export interface PaperDbSchema {
  papers: { key: string; value: PaperRecord; indexes: "byCreatedAt" | "byTitle" }
  conversations: {
    key: string
    value: Conversation
    indexes: "byPaperId" | "byCreatedAt"
  }
  artifacts: {
    key: string
    value: Artifact
    indexes: "byPaperId" | "byType" | "byCreatedAt"
  }
}

let dbPromise: Promise<IDBPDatabase<PaperDbSchema>> | null = null

function getDb(): Promise<IDBPDatabase<PaperDbSchema>> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"))
  }
  if (!dbPromise) {
    dbPromise = openDB<PaperDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("papers")) {
          const ps = db.createObjectStore("papers", { keyPath: "paperId" })
          ps.createIndex("byCreatedAt", "createdAt")
          ps.createIndex("byTitle", "title")
        }
        if (!db.objectStoreNames.contains("conversations")) {
          const cs = db.createObjectStore("conversations", { keyPath: "conversationId" })
          cs.createIndex("byPaperId", "paperId")
          cs.createIndex("byCreatedAt", "createdAt")
        }
        if (!db.objectStoreNames.contains("artifacts")) {
          const as = db.createObjectStore("artifacts", { keyPath: "artifactId" })
          as.createIndex("byPaperId", "paperId")
          as.createIndex("byType", "artifactType")
          as.createIndex("byCreatedAt", "createdAt")
        }
      },
    }).then(async (db) => {
        try {
          await migrateFromOldCacheIfExists(db)
        } catch (e) {
          console.warn("[storage] Migration from old cache failed:", e)
        }
        return db
      })
  }
  return dbPromise
}

/** Convert base64 (raw, no data URL prefix) to ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** One-time migration from legacy paper-cache DB. Receives our db so it doesn't call getDb() (deadlock). */
async function migrateFromOldCacheIfExists(
  db: IDBPDatabase<PaperDbSchema>
): Promise<void> {
  try {
    const dbs = await (indexedDB as unknown as { databases?: () => Promise<{ name: string }[]> }).databases?.()
    if (dbs && !dbs.some((d) => d.name === OLD_DB_NAME)) return
  } catch {
    // databases() not available, try opening
  }
  let oldDb: IDBDatabase | null = null
  try {
    oldDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(OLD_DB_NAME, 1)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve(req.result)
    })
  } catch {
    return
  }
  const tx = oldDb.transaction(OLD_STORE_NAME, "readonly")
  const store = tx.objectStore(OLD_STORE_NAME)
  const all = await new Promise<unknown[]>((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
  oldDb.close()
  if (all.length === 0) {
    indexedDB.deleteDatabase(OLD_DB_NAME)
    return
  }
  const writeTx = db.transaction("papers", "readwrite")
  const papersStore = writeTx.objectStore("papers")
  for (const row of all as Array<{ hash: string; paper: Paper; pdfBase64: string; pdfUrl: string | null; timestamp: number; model: string }>) {
    try {
      const pdfBytes = row.pdfBase64 ? base64ToArrayBuffer(row.pdfBase64) : null
      const paperId = pdfBytes
        ? await sha256(pdfBytes)
        : await sha256(row.pdfUrl || row.hash)
      const pdfBlob = pdfBytes ? new Blob([pdfBytes], { type: "application/pdf" }) : undefined
      const blockIds = enrichPaperWithBlockIds(row.paper)
      const stats = getPaperStats(row.paper)
      const record: PaperRecord = {
        paperId,
        createdAt: row.timestamp,
        updatedAt: row.timestamp,
        title: row.paper.title,
        authors: row.paper.authors,
        source: row.pdfUrl ? { type: "url", value: row.pdfUrl } : { type: "upload" },
        pdfBlob,
        pdfUrl: row.pdfUrl ?? undefined,
        parseVersion: PARSE_VERSION,
        paperData: row.paper,
        blockIds,
        stats,
      }
      papersStore.put(record)
    } catch (e) {
      console.warn("[storage] Skip migrating one entry:", e)
    }
  }
  await writeTx.done
  indexedDB.deleteDatabase(OLD_DB_NAME)
}

/** Blob to base64 data URL chunk (for PDF viewer) */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Compute stable paper ID: sha256 of PDF bytes, or of URL if no bytes. */
export async function computePaperId(
  pdfArrayBuffer?: ArrayBuffer,
  url?: string
): Promise<string> {
  if (pdfArrayBuffer) return sha256(pdfArrayBuffer)
  if (url) return sha256(url)
  throw new Error("Need pdfArrayBuffer or url to compute paperId")
}

/** Compute paperId from upload: from Blob (arrayBuffer) or from URL. */
export async function getPaperIdFromUpload(
  pdfBlob?: Blob,
  url?: string
): Promise<string> {
  if (pdfBlob) {
    const buf = await pdfBlob.arrayBuffer()
    return sha256(buf)
  }
  if (url) return sha256(url)
  throw new Error("Need pdfBlob or url")
}

// --- Paper APIs ---

export async function savePaper(record: PaperRecord): Promise<void> {
  const db = await getDb()
  await db.put("papers", record)
}

export async function listPapers(): Promise<PaperRecord[]> {
  const db = await getDb()
  return db.getAll("papers")
}

export async function getPaper(paperId: string): Promise<PaperRecord | undefined> {
  const db = await getDb()
  return db.get("papers", paperId)
}

export async function deletePaper(paperId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(["papers", "conversations", "artifacts"], "readwrite")
  const convos = await tx.objectStore("conversations").index("byPaperId").getAll(paperId)
  for (const c of convos) await tx.objectStore("conversations").delete(c.conversationId)
  const arts = await tx.objectStore("artifacts").index("byPaperId").getAll(paperId)
  for (const a of arts) await tx.objectStore("artifacts").delete(a.artifactId)
  await tx.objectStore("papers").delete(paperId)
  await tx.done
}

// --- Conversation APIs ---

export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await getDb()
  await db.put("conversations", conversation)
}

export async function getConversation(conversationId: string): Promise<Conversation | undefined> {
  const db = await getDb()
  return db.get("conversations", conversationId)
}

export async function listConversations(
  paperId: string,
  filters?: ListConversationsFilters
): Promise<Conversation[]> {
  const db = await getDb()
  let list = await db.getAllFromIndex("conversations", "byPaperId", paperId)
  if (filters?.difficulty) list = list.filter((c) => c.difficulty === filters.difficulty)
  if (filters?.anchorType) list = list.filter((c) => c.anchor.type === filters.anchorType)
  list.sort((a, b) => b.updatedAt - a.updatedAt)
  return list
}

// --- Artifact APIs ---

export async function saveArtifact(artifact: Artifact): Promise<void> {
  const db = await getDb()
  await db.put("artifacts", artifact)
}

export async function getArtifact(artifactId: string): Promise<Artifact | undefined> {
  const db = await getDb()
  return db.get("artifacts", artifactId)
}

export async function listArtifacts(
  paperId: string,
  typeFilter?: "summary" | "slides" | "flashcards"
): Promise<Artifact[]> {
  const db = await getDb()
  let list = await db.getAllFromIndex("artifacts", "byPaperId", paperId)
  if (typeFilter) list = list.filter((a) => a.artifactType === typeFilter)
  list.sort((a, b) => b.updatedAt - a.updatedAt)
  return list
}

export async function deleteArtifact(artifactId: string): Promise<void> {
  const db = await getDb()
  await db.delete("artifacts", artifactId)
}

// --- Helpers for building records (used by app) ---

export function buildPaperRecord(
  paperId: string,
  paper: Paper,
  opts: {
    pdfBlob?: Blob
    pdfUrl?: string | null
    source?: { type: "upload" | "url"; value?: string }
  }
): PaperRecord {
  const now = Date.now()
  const blockIds = enrichPaperWithBlockIds(paper)
  const stats = getPaperStats(paper)
  return {
    paperId,
    createdAt: now,
    updatedAt: now,
    title: paper.title,
    authors: paper.authors,
    source: opts.source,
    pdfBlob: opts.pdfBlob,
    pdfUrl: opts.pdfUrl ?? undefined,
    parseVersion: PARSE_VERSION,
    paperData: paper,
    blockIds,
    stats,
  }
}

export function buildArtifact(
  paperId: string,
  artifactType: Artifact["artifactType"],
  params: Artifact["params"],
  content: ArtifactContent
): Artifact {
  const now = Date.now()
  return {
    artifactId: crypto.randomUUID(),
    paperId,
    artifactType,
    params,
    content,
    createdAt: now,
    updatedAt: now,
  }
}
