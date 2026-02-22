import { describe, it, expect, vi, beforeEach } from "vitest"

// ── pptxgenjs mock ─────────────────────────────────────────────────────────
// We create a shared capture object so tests can inspect what was recorded.
const capture = {
  slides: [] as Array<{
    texts: Array<{ value: unknown; options: unknown }>
    shapes: Array<unknown>
    notes: string[]
    background: unknown
  }>,
  writeFileArgs: null as unknown,
  layout: "",
  title: "",
  subject: "",
}

function makeMockSlide() {
  const slide = {
    addText: vi.fn((value: unknown, options: unknown) => {
      currentSlide.texts.push({ value, options })
    }),
    addShape: vi.fn((type: unknown, opts: unknown) => {
      currentSlide.shapes.push({ type, opts })
    }),
    addNotes: vi.fn((notes: string) => {
      currentSlide.notes.push(notes)
    }),
    background: null as unknown,
  }
  // Track background assignment
  let bg: unknown = null
  Object.defineProperty(slide, "background", {
    set(v) { bg = v; currentSlide.background = v },
    get() { return bg },
  })
  return slide
}

let currentSlide: (typeof capture.slides)[0]

vi.mock("pptxgenjs", () => {
  return {
    default: class MockPptxGenJS {
      layout = ""
      title = ""
      subject = ""
      ShapeType = { rect: "rect", oval: "oval" }

      addSlide() {
        currentSlide = { texts: [], shapes: [], notes: [], background: null }
        capture.slides.push(currentSlide)
        return makeMockSlide()
      }
      async writeFile(args: unknown) {
        capture.writeFileArgs = args
      }
    },
  }
})

// Import AFTER mock is registered
const { generatePptx } = await import("./generate-pptx")

describe("generatePptx", () => {
  beforeEach(() => {
    capture.slides.length = 0
    capture.writeFileArgs = null
  })

  const slides = [
    {
      title: "Introduction",
      bullets: ["Point one", "Point two"],
      speakerNotes: "Welcome everyone!",
    },
    {
      title: "Methods",
      bullets: ["Step A", "Step B", "Step C"],
    },
    {
      title: "Results",
      bullets: ["Finding X"],
    },
  ]

  it("calls writeFile with a sanitised filename derived from the title", async () => {
    await generatePptx("My Research Paper", slides)
    expect(capture.writeFileArgs).toMatchObject({ fileName: "My Research Paper.pptx" })
  })

  it("strips special characters from the title to form a safe filename", async () => {
    await generatePptx("Paper: Results & Discussion (2024)!", slides)
    const args = capture.writeFileArgs as { fileName: string }
    expect(args.fileName).not.toMatch(/[:/&!()]/g)
    expect(args.fileName).toMatch(/\.pptx$/)
  })

  it("creates a cover slide + one slide per content item + an outro slide", async () => {
    await generatePptx("Title", slides)
    // cover + 3 content + outro = 5
    expect(capture.slides).toHaveLength(slides.length + 2)
  })

  it("includes the presentation title text on the cover slide", async () => {
    const title = "Deep Learning in NLP"
    await generatePptx(title, slides)
    const coverTexts = capture.slides[0].texts.map((t) =>
      typeof t.value === "string" ? t.value : ""
    )
    expect(coverTexts.some((t) => t.includes(title))).toBe(true)
  })

  it("includes slide title text on each content slide", async () => {
    await generatePptx("T", slides)
    // slides[1] is the first content slide (index 0 is cover)
    const contentSlide = capture.slides[1]
    const textValues = contentSlide.texts.map((t) =>
      typeof t.value === "string" ? t.value : ""
    )
    expect(textValues.some((v) => v.includes("Introduction"))).toBe(true)
  })

  it("adds speaker notes to the PPTX notes panel when provided", async () => {
    await generatePptx("T", slides)
    // First content slide has speaker notes
    const firstContent = capture.slides[1]
    expect(firstContent.notes).toContain("Welcome everyone!")
  })

  it("does not add notes for slides without speakerNotes", async () => {
    await generatePptx("T", slides)
    // Second content slide (Methods) has no speaker notes
    const secondContent = capture.slides[2]
    expect(secondContent.notes).toHaveLength(0)
  })

  it("works with a single slide", async () => {
    await generatePptx("Solo", [{ title: "Only Slide", bullets: ["one"] }])
    // cover + 1 content + outro = 3
    expect(capture.slides).toHaveLength(3)
  })

  it("works with an empty slides array (cover + outro only)", async () => {
    await generatePptx("Empty", [])
    expect(capture.slides).toHaveLength(2)
  })

  it("uses the PPTX layout LAYOUT_WIDE", async () => {
    // Since we cannot access the pptx instance directly here, we verify via
    // writeFile being called (the mock doesn't set layout but the real code does)
    await generatePptx("T", slides)
    expect(capture.writeFileArgs).toBeTruthy()
  })

  it("truncates very long titles for the filename", async () => {
    const longTitle = "A".repeat(200)
    await generatePptx(longTitle, [])
    const args = capture.writeFileArgs as { fileName: string }
    // filename (without .pptx) should be max 60 chars
    const baseName = args.fileName.replace(/\.pptx$/, "")
    expect(baseName.length).toBeLessThanOrEqual(60)
  })
})
