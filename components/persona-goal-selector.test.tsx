import { describe, it, expect } from "vitest"
import {
  PERSONA_OPTIONS,
  GOAL_OPTIONS,
  TONE_OPTIONS,
  type PersonaGoalValue,
} from "./persona-goal-selector"

describe("PersonaGoalSelector options (UI consistency)", () => {
  it("exposes persona options per plan", () => {
    expect(PERSONA_OPTIONS).toContain("High-school student")
    expect(PERSONA_OPTIONS).toContain("Undergraduate CS")
    expect(PERSONA_OPTIONS).toContain("Software engineer")
    expect(PERSONA_OPTIONS).toContain("Product manager")
    expect(PERSONA_OPTIONS).toContain("PhD researcher (adjacent field)")
    expect(PERSONA_OPTIONS).toContain("Clinician")
    expect(PERSONA_OPTIONS).toContain("Investor")
    expect(PERSONA_OPTIONS.length).toBe(7)
  })

  it("exposes goal options per plan", () => {
    expect(GOAL_OPTIONS).toContain("Understand the big idea")
    expect(GOAL_OPTIONS).toContain("Implement it")
    expect(GOAL_OPTIONS).toContain("Review/critique it")
    expect(GOAL_OPTIONS).toContain("Teach it")
    expect(GOAL_OPTIONS).toContain("Replicate the results")
    expect(GOAL_OPTIONS.length).toBe(5)
  })

  it("exposes tone options", () => {
    expect(TONE_OPTIONS).toContain("Concise")
    expect(TONE_OPTIONS).toContain("Friendly")
    expect(TONE_OPTIONS).toContain("Technical")
    expect(TONE_OPTIONS.length).toBe(3)
  })

  it("PersonaGoalValue type allows optional persona, goal, tone", () => {
    const v: PersonaGoalValue = {}
    expect(v).toBeDefined()
    const v2: PersonaGoalValue = { persona: "Engineer", goal: "Implement it", tone: "Concise" }
    expect(v2.persona).toBe("Engineer")
  })
})
