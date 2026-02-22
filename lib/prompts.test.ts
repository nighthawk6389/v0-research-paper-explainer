import { describe, it, expect } from "vitest"
import { buildExplainSystemPrompt } from "./prompts"

describe("buildExplainSystemPrompt", () => {
  it("includes paper title, abstract, section content", () => {
    const out = buildExplainSystemPrompt(
      "My Paper",
      "The abstract here.",
      "Introduction",
      "Section content.",
      "Previous context.",
      "advanced"
    )
    expect(out).toContain("My Paper")
    expect(out).toContain("The abstract here.")
    expect(out).toContain("Introduction")
    expect(out).toContain("Section content.")
    expect(out).toContain("ADVANCED")
    expect(out).toContain("college-level math")
  })

  it("includes persona instructions when personaGoal provided", () => {
    const out = buildExplainSystemPrompt(
      "P",
      "Abs",
      "S",
      "C",
      "",
      "basic",
      { persona: "undergrad CS", goal: "Implement it", tone: "concise" }
    )
    expect(out).toContain("AUDIENCE")
    expect(out).toContain("undergrad CS")
    expect(out).toContain("implement")
    expect(out).toContain("concise")
  })

  it("includes review/critique goal variant", () => {
    const out = buildExplainSystemPrompt(
      "P",
      "Abs",
      "S",
      "C",
      "",
      "advanced",
      { goal: "Review/critique it" }
    )
    expect(out).toContain("review")
    expect(out).toContain("limitations")
  })

  it("includes teach goal variant", () => {
    const out = buildExplainSystemPrompt(
      "P",
      "Abs",
      "S",
      "C",
      "",
      "advanced",
      { goal: "Teach it" }
    )
    expect(out).toContain("teach")
    expect(out).toContain("key takeaways")
  })
})
