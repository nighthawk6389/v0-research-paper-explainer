#!/usr/bin/env node

/**
 * Integration test: calls the artifact generation APIs (summary, slides, flashcards)
 * on the running dev server. Validates response shape and status.
 *
 * Prerequisites:
 *   - Dev server running on localhost:3000 (npm run dev)
 *   - Valid AI provider config in .env.local (for real LLM calls)
 *
 * Usage:
 *   node tests/integration/artifact-apis.mjs
 *   BASE_URL=http://localhost:3010 node tests/integration/artifact-apis.mjs
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const TIMEOUT_MS = 2 * 60 * 1000 // 2 min per request

const minimalPaperText = `# Test Paper
Authors: Alice, Bob

## Abstract
This is a minimal abstract for integration testing.

## Table of contents
- Abstract
- Introduction
- Method

## Introduction
Short intro paragraph.

## Method
Short method paragraph.`

async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal })
    clearTimeout(t)
    return res
  } catch (e) {
    clearTimeout(t)
    throw e
  }
}

async function testGenerateSummary() {
  console.log("\n--- POST /api/generate-summary ---")
  const res = await fetchWithTimeout(`${BASE_URL}/api/generate-summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paperText: minimalPaperText,
      persona: "Software engineer",
    }),
  })
  if (!res.ok) {
    throw new Error(`generate-summary HTTP ${res.status}: ${await res.text()}`)
  }
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("text/plain") && !contentType.includes("text/html")) {
    throw new Error(`generate-summary unexpected content-type: ${contentType}`)
  }
  const text = await res.text()
  if (text.length < 50) {
    throw new Error(`generate-summary response too short: ${text.length} chars`)
  }
  console.log(`  Status: ${res.status}, body length: ${text.length}`)
  return { pass: true, name: "generate-summary" }
}

async function testGenerateSlides() {
  console.log("\n--- POST /api/generate-slides ---")
  const res = await fetchWithTimeout(`${BASE_URL}/api/generate-slides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paperText: minimalPaperText,
      slideCount: 5,
    }),
  })
  if (!res.ok) {
    throw new Error(`generate-slides HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  if (typeof data.title !== "string") {
    throw new Error(`generate-slides missing title: ${JSON.stringify(data).slice(0, 100)}`)
  }
  if (!Array.isArray(data.slides)) {
    throw new Error(`generate-slides missing slides array`)
  }
  if (data.slides.length < 3) {
    throw new Error(`generate-slides expected at least 3 slides, got ${data.slides.length}`)
  }
  const first = data.slides[0]
  if (typeof first.title !== "string" || !Array.isArray(first.bullets)) {
    throw new Error(`generate-slides slide shape invalid`)
  }
  console.log(`  Status: ${res.status}, title: ${data.title}, slides: ${data.slides.length}`)
  return { pass: true, name: "generate-slides" }
}

async function testGenerateFlashcards() {
  console.log("\n--- POST /api/generate-flashcards ---")
  const res = await fetchWithTimeout(`${BASE_URL}/api/generate-flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paperText: minimalPaperText,
      flashcardCount: 6,
    }),
  })
  if (!res.ok) {
    throw new Error(`generate-flashcards HTTP ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  if (!Array.isArray(data.cards)) {
    throw new Error(`generate-flashcards missing cards array`)
  }
  if (data.cards.length < 3) {
    throw new Error(`generate-flashcards expected at least 3 cards, got ${data.cards.length}`)
  }
  const first = data.cards[0]
  if (typeof first.front !== "string" || typeof first.back !== "string") {
    throw new Error(`generate-flashcards card shape invalid`)
  }
  console.log(`  Status: ${res.status}, cards: ${data.cards.length}`)
  return { pass: true, name: "generate-flashcards" }
}

async function main() {
  console.log("Integration test: artifact APIs (summary, slides, flashcards)")
  console.log(`Server: ${BASE_URL}`)

  try {
    const head = await fetch(`${BASE_URL}/`, { method: "HEAD" })
    if (!head.ok && head.status !== 404) {
      throw new Error(`Cannot reach server: ${head.status}`)
    }
  } catch (e) {
    console.error(`\nERROR: Cannot reach dev server at ${BASE_URL}`)
    console.error("Start it with: npm run dev")
    process.exit(1)
  }

  const results = []
  for (const fn of [testGenerateSummary, testGenerateSlides, testGenerateFlashcards]) {
    try {
      results.push(await fn())
    } catch (e) {
      console.error(`  FAIL: ${e.message}`)
      results.push({ pass: false, name: fn.name.replace("test", ""), error: e.message })
    }
  }

  console.log("\n=== Summary ===")
  const passed = results.filter((r) => r.pass)
  const failed = results.filter((r) => !r.pass)
  for (const r of results) {
    console.log(`  [${r.pass ? "PASS" : "FAIL"}] ${r.name}${r.error ? ` — ${r.error}` : ""}`)
  }
  console.log(`\n${passed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

main()
