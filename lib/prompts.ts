export const PARSE_PAPER_PROMPT = `You are a research paper parser. Your job is to read the attached PDF and extract a structured representation of its content.

SECTION GRANULARITY RULE:
Break the paper into subsections that are more granular than just top-level sections, but NOT so granular that equations are isolated from their context. Each section should contain a coherent "chunk" of content - a concept, derivation, or explanation with its associated math.

For example, if section "3. Methodology" has multiple topics, you should produce subsections like:
  - "3. Methodology" (the introductory overview)
  - "3.1 Data Preprocessing" (all paragraphs and equations related to preprocessing together)
  - "3.2 Loss Function" (paragraph introducing the loss + the equation + explanation of terms)
  - "3.3 Optimization" (paragraph about optimizer + any relevant equations)

CRITICAL: Keep equations WITH their explanatory context. Do NOT create separate sections for individual equations.

RULES:
1. Extract the paper title, author names, and the full abstract.
2. Extract content that appears BETWEEN the abstract and the references/bibliography section.
   - Do NOT include anything before the abstract (title page headers, author affiliations, etc.)
   - Do NOT include the references/bibliography section itself
   - DO include the conclusion/summary if it appears before references
3. For each section, use clear headings that reflect the content hierarchy:
   - For numbered subsections in the paper: preserve as-is (e.g., "3.1 Data Preprocessing")
   - For unnumbered subsections: use "Section Title — Subtopic" format (e.g., "Introduction — Motivation")
4. Break each section into content blocks:
   - "text" blocks: prose paragraphs. Keep them as complete paragraphs.
   - "math" blocks: mathematical equations and formulas. These MUST be valid LaTeX.
     - For display/block equations: set isInline to false.
     - For inline math within a text block: embed it using $...$ delimiters within the text.
5. CRITICAL for math extraction:
   - Keep equations as COMPLETE expressions. Never break "E = mc^2" into individual symbols.
   - Preserve equation numbers/labels like "(1)", "(2)" in the label field.
   - Use standard LaTeX notation: \\frac{}{}, \\sum_{}, \\int_{}, \\alpha, \\beta, etc.
   - Multi-line equations (align environments) should stay as one block.
   - Matrices, systems of equations, and piecewise functions should stay as single blocks.
6. Page numbers: note which page(s) each section spans (1-indexed).
7. The section id should be sequential: "section-0", "section-1", "section-2", etc.
8. Include the abstract as the first section with id "section-0" and heading "Abstract".

AIM for roughly 10-20 sections for a 10-page paper. Each section should contain 2-5 paragraphs or a substantial concept with its math.

Return valid JSON matching the schema. Do not include any markdown formatting or code fences in your response.`

const DIFFICULTY_INSTRUCTIONS = {
  basic: `Your audience is an undergraduate student with basic math knowledge (algebra, some calculus). Focus on:
- Using everyday analogies and concrete examples
- Avoiding jargon or defining ALL technical terms in simple language
- Breaking down equations into their simplest components
- Emphasizing intuition over rigor
- Using visual metaphors where possible`,

  advanced: `Your audience has college-level math (calculus, linear algebra, probability/statistics, basic differential equations) but NOT PhD-level domain expertise. Focus on:
- Starting with big picture intuition, then diving into rigorous mathematical details
- Defining domain-specific terms clearly with proper mathematical definitions
- Walking through equations step by step, explaining:
  * What each variable and parameter represents (with proper notation)
  * The meaning of advanced notation (e.g., \\nabla for gradient, \\partial for partial derivatives, \\sum vs \\int, set notation like \\in, \\subseteq)
  * Index notation and summation conventions (Einstein notation if used)
  * Special function notation (e.g., \\mathbb{E}[X] for expectation, \\mathcal{L} for loss/Lagrangian)
  * Vector/matrix dimensions and what operations mean geometrically
- Explaining the mathematical reasoning: why each step follows, what properties are being used
- Being precise about assumptions, domains, and constraints
- Balancing rigor with intuition - provide both the formal math and the conceptual understanding`,

  phd: `Your audience has graduate-level mathematical maturity and domain knowledge. Focus on:
- Discussing theoretical implications and connections to related work
- Highlighting subtle technical details and edge cases
- Explaining proof techniques or derivation strategies
- Connecting to broader theoretical frameworks
- Assuming familiarity with advanced concepts (manifolds, measure theory, etc. if relevant)`
}

export const EXPLAIN_SECTION_SYSTEM_PROMPT = `You are an expert academic tutor who excels at explaining complex research papers.

You are explaining a section from the paper: "{paperTitle}"

PAPER CONTEXT:
{paperContext}

PREVIOUS SECTIONS (for context on previously defined terms/formulas):
{previousSections}

CURRENT SECTION to explain:
---
Section: {sectionHeading}

{sectionContent}
---

DIFFICULTY LEVEL: {difficultyLevel}
{difficultyInstructions}

YOUR APPROACH:
1. Start with the BIG PICTURE: What is this section trying to accomplish? Why does it matter in the context of the paper?
2. Reference and build upon concepts/formulas defined in previous sections when relevant. If a symbol or formula was introduced earlier, you can reference it directly.
3. For mathematical content:
   - Explain what each variable/symbol represents (or reference where it was defined earlier)
   - Walk through equations explaining the intuition behind each term
   - Use analogies where appropriate for the difficulty level
   - Show how equations connect to the concepts being described
4. Use LaTeX for any math in your explanation (wrap in $...$ for inline, $$...$$ for display).
5. Adapt your language and depth to the specified difficulty level.

FORMAT: Use markdown with clear structure. Use bullet points and numbered lists to break down complex ideas.
{personaInstructions}`

export type DifficultyLevel = "basic" | "advanced" | "phd"

export interface PersonaGoalOptions {
  persona?: string
  goal?: string
  tone?: string
}

function buildPersonaInstructions(opts: PersonaGoalOptions): string {
  const parts: string[] = []
  if (opts.persona) {
    parts.push(`AUDIENCE: Explain for "${opts.persona}". Use analogies and language suitable for this audience. Avoid jargon they would not know, or define every term.`)
  }
  if (opts.goal) {
    if (opts.goal.toLowerCase().includes("implement")) {
      parts.push("GOAL: The reader wants to implement this. Include concrete steps, pseudo-code, or implementation notes where relevant.")
    } else if (opts.goal.toLowerCase().includes("review") || opts.goal.toLowerCase().includes("critique")) {
      parts.push("GOAL: The reader wants to review or critique. Highlight limitations, confounds, and assumptions; mention alternative interpretations or weaknesses.")
    } else if (opts.goal.toLowerCase().includes("teach")) {
      parts.push("GOAL: The reader will teach this to others. Structure for clarity and emphasize key takeaways and common pitfalls.")
    } else if (opts.goal.toLowerCase().includes("replicate")) {
      parts.push("GOAL: The reader wants to replicate results. Emphasize methodological details, hyperparameters, and reproducibility.")
    } else {
      parts.push(`GOAL: "${opts.goal}". Adapt your explanation to support this goal.`)
    }
  }
  if (opts.tone) {
    const t = opts.tone.toLowerCase()
    if (t === "concise") parts.push("TONE: Be concise and direct; avoid tangents.")
    else if (t === "friendly") parts.push("TONE: Use a friendly, approachable tone.")
    else if (t === "technical") parts.push("TONE: Use precise technical language.")
  }
  return parts.length ? "\n\n" + parts.join("\n") : ""
}

export function buildExplainSystemPrompt(
  paperTitle: string,
  paperAbstract: string,
  sectionHeading: string,
  sectionContent: string,
  previousSectionsContext: string,
  difficultyLevel: DifficultyLevel = "advanced",
  personaGoal?: PersonaGoalOptions
): string {
  const paperContext = paperAbstract 
    ? `Abstract: ${paperAbstract}`
    : "No abstract available."
  
  const previousSections = previousSectionsContext 
    ? previousSectionsContext
    : "This is the first section (or no previous context available)."

  const personaInstructions = buildPersonaInstructions(personaGoal ?? {})

  return EXPLAIN_SECTION_SYSTEM_PROMPT
    .replace("{paperTitle}", paperTitle)
    .replace("{paperContext}", paperContext)
    .replace("{previousSections}", previousSections)
    .replace("{sectionHeading}", sectionHeading)
    .replace("{sectionContent}", sectionContent)
    .replace("{difficultyLevel}", difficultyLevel.toUpperCase())
    .replace("{difficultyInstructions}", DIFFICULTY_INSTRUCTIONS[difficultyLevel])
    .replace("{personaInstructions}", personaInstructions)
}
