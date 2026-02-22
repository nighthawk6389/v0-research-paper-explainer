import { describe, it, expect } from "vitest"
import { sha256 } from "./hash"

describe("sha256", () => {
  it("returns hex string for string input", async () => {
    const out = await sha256("hello")
    expect(out).toMatch(/^[a-f0-9]{64}$/)
    expect(out).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
  })

  it("returns hex string for ArrayBuffer input", async () => {
    const buf = new TextEncoder().encode("hello").buffer
    const out = await sha256(buf)
    expect(out).toMatch(/^[a-f0-9]{64}$/)
    expect(out).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )
  })

  it("produces different hashes for different inputs", async () => {
    const a = await sha256("a")
    const b = await sha256("b")
    expect(a).not.toBe(b)
  })

  it("produces same hash for same input", async () => {
    const a = await sha256("same")
    const b = await sha256("same")
    expect(a).toBe(b)
  })
})
