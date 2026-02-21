#!/usr/bin/env node

/**
 * Integration test: sends example PDFs to the running dev server's
 * /api/parse-paper?stream=true endpoint and validates the SSE response
 * produces a well-formed paper object.
 *
 * Prerequisites:
 *   - Dev server running on localhost:3000  (`pnpm dev`)
 *   - Valid AI_GATEWAY_API_KEY in .env.local
 *   - Example PDFs in examples/
 *
 * Usage:
 *   node tests/integration/parse-paper.mjs
 *   node tests/integration/parse-paper.mjs --model anthropic/claude-sonnet-4.5
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "../..")
const EXAMPLES_DIR = path.join(ROOT, "examples")

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5"
const TIMEOUT_MS = 5 * 60 * 1000 // 5 min per PDF

// --- CLI args ---
const args = process.argv.slice(2)
const modelIdx = args.indexOf("--model")
const model = modelIdx !== -1 ? args[modelIdx + 1] : DEFAULT_MODEL

// --- Helpers ---

function parseSseStream(buffer) {
  const events = []
  const parts = buffer.split("\n\n")
  for (const block of parts) {
    const trimmed = block.trim()
    if (!trimmed) continue
    let event = ""
    let data = ""
    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim()
      if (line.startsWith("data:")) data = line.slice(5).trim()
    }
    if (event) {
      events.push({ event, data: data ? JSON.parse(data) : null })
    }
  }
  return events
}

async function readStream(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
  }
  return buffer
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
}

// --- Validation ---

function validatePaper(paper, pdfName) {
  const prefix = `[${pdfName}]`

  assert(typeof paper.title === "string" && paper.title.length > 0, `${prefix} title is non-empty string`)
  assert(Array.isArray(paper.authors) && paper.authors.length > 0, `${prefix} authors is non-empty array`)
  assert(typeof paper.abstract === "string" && paper.abstract.length > 0, `${prefix} abstract is non-empty string`)
  assert(Array.isArray(paper.sections) && paper.sections.length >= 3, `${prefix} has at least 3 sections (got ${paper.sections?.length})`)

  const ids = new Set()
  for (const section of paper.sections) {
    assert(typeof section.id === "string", `${prefix} section.id is string`)
    assert(!ids.has(section.id), `${prefix} duplicate section id: ${section.id}`)
    ids.add(section.id)

    assert(typeof section.heading === "string" && section.heading.length > 0, `${prefix} section.heading is non-empty`)
    assert(["text", "math", "mixed"].includes(section.type), `${prefix} section.type is valid (got ${section.type})`)
    assert(Array.isArray(section.content) && section.content.length > 0, `${prefix} section.content is non-empty array`)
    assert(Array.isArray(section.pageNumbers) && section.pageNumbers.length > 0, `${prefix} section.pageNumbers is non-empty`)

    for (const block of section.content) {
      assert(["text", "math"].includes(block.type), `${prefix} content block type is valid`)
      assert(typeof block.value === "string" && block.value.length > 0, `${prefix} content block value is non-empty`)
    }
  }

  assert(paper.sections[0].heading.toLowerCase().includes("abstract"), `${prefix} first section is Abstract`)
}

// --- Main ---

async function testPdf(pdfPath) {
  const pdfName = path.basename(pdfPath)
  const base64 = fs.readFileSync(pdfPath).toString("base64")

  console.log(`\n--- Testing: ${pdfName} (${Math.round(base64.length / 1024)}KB base64, model: ${model}) ---`)
  const start = Date.now()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const resp = await fetch(`${BASE_URL}/api/parse-paper?stream=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfBase64: base64, model }),
      signal: controller.signal,
    })

    assert(resp.ok, `HTTP ${resp.status} response`)
    assert(resp.headers.get("content-type")?.includes("text/event-stream"), "response is SSE")

    const rawStream = await readStream(resp)
    const events = parseSseStream(rawStream)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    const statusEvents = events.filter((e) => e.event === "status")
    const completeEvents = events.filter((e) => e.event === "complete")
    const errorEvents = events.filter((e) => e.event === "error")

    console.log(`  Time: ${elapsed}s | Events: ${events.length} (${statusEvents.length} status, ${completeEvents.length} complete, ${errorEvents.length} error)`)

    assert(errorEvents.length === 0, `no error events (got: ${JSON.stringify(errorEvents[0]?.data)})`)
    assert(completeEvents.length === 1, `exactly one complete event (got ${completeEvents.length})`)
    assert(statusEvents.length >= 1, `at least one status event`)

    const paper = completeEvents[0].data.paper
    assert(paper, "complete event contains paper data")

    validatePaper(paper, pdfName)

    console.log(`  Title: ${paper.title}`)
    console.log(`  Authors: ${paper.authors.join(", ")}`)
    console.log(`  Sections: ${paper.sections.length}`)
    console.log(`  PASS`)

    return { pdfName, pass: true, elapsed, sections: paper.sections.length, title: paper.title }
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    console.error(`  FAIL (${elapsed}s): ${err.message}`)
    return { pdfName, pass: false, elapsed, error: err.message }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  console.log(`Integration test: parse-paper SSE endpoint`)
  console.log(`Server: ${BASE_URL}`)
  console.log(`Model:  ${model}`)

  // Check server is reachable
  try {
    await fetch(`${BASE_URL}/`, { method: "HEAD" })
  } catch {
    console.error(`\nERROR: Cannot reach dev server at ${BASE_URL}`)
    console.error("Start it with: pnpm dev")
    process.exit(1)
  }

  // Find example PDFs
  if (!fs.existsSync(EXAMPLES_DIR)) {
    console.error(`\nERROR: No examples/ directory found at ${EXAMPLES_DIR}`)
    process.exit(1)
  }

  const pdfs = fs
    .readdirSync(EXAMPLES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(EXAMPLES_DIR, f))

  if (pdfs.length === 0) {
    console.error(`\nERROR: No PDF files found in ${EXAMPLES_DIR}`)
    process.exit(1)
  }

  console.log(`Found ${pdfs.length} example PDF(s)`)

  const results = []
  for (const pdf of pdfs) {
    results.push(await testPdf(pdf))
  }

  // Summary
  console.log("\n=== Summary ===")
  const passed = results.filter((r) => r.pass)
  const failed = results.filter((r) => !r.pass)

  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL"
    const detail = r.pass ? `${r.sections} sections, ${r.elapsed}s` : r.error
    console.log(`  [${status}] ${r.pdfName} — ${detail}`)
  }

  console.log(`\n${passed.length}/${results.length} passed`)

  if (failed.length > 0) {
    process.exit(1)
  }
}

main()
