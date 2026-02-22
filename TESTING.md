# Testing Guide

## Overview

This project uses Vitest for testing with the following setup:
- **Test Runner**: Vitest
- **Environment**: happy-dom (browser-like environment)
- **Mocking**: fake-indexeddb for IndexedDB operations

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test paper-cache.test.ts

# Integration tests (require dev server on localhost:3000)
npm run test:integration              # parse-paper SSE with example PDFs
npm run test:integration:artifacts    # generate-summary, generate-slides, generate-flashcards
```

## Test Structure

### Unit Tests

#### Hash (`lib/hash.test.ts`)
- SHA-256 for string and ArrayBuffer
- Deterministic and distinct hashes

#### Paper utils (`lib/paper-utils.test.ts`)
- `enrichPaperWithBlockIds`, `extractEquations`, `getPaperStats`, `compressPaperForPrompt`
- Equation extraction excludes inline math; summary/slides/flashcards modes

#### Storage (`lib/storage/db.test.ts`)
- Paper and conversation and artifact CRUD (save, get, list, delete)
- `getPaperIdFromUpload`, `blobToBase64`, `buildPaperRecord`, `buildArtifact`
- Uses fake-indexeddb (vitest setup)

#### Prompts (`lib/prompts.test.ts`)
- `buildExplainSystemPrompt` with difficulty and persona/goal/tone

#### Persona selector (`components/persona-goal-selector.test.tsx`)
- PERSONA_OPTIONS, GOAL_OPTIONS, TONE_OPTIONS match feature plan

#### Artifact API routes
- `app/api/generate-summary/route.test.ts` — stream response, persona in prompt
- `app/api/generate-slides/route.test.ts` — JSON title/slides, slideCount
- `app/api/generate-flashcards/route.test.ts` — JSON cards, flashcardCount

#### Paper Cache (`lib/paper-cache.test.ts`)
Tests for IndexedDB-based paper caching:
- Cache hit/miss scenarios
- Storage and retrieval by PDF base64 and URL
- Cache clearing
- Error handling for missing data

#### Wolfram Alpha (`lib/wolfram-alpha.test.ts`)
Tests for Wolfram Alpha API integration:
- Query construction
- Response parsing
- Image extraction from pods
- Error handling

#### Paper Schema (`lib/paper-schema.test.ts`)
Tests for schema validation:
- Valid paper structure
- Text and math content blocks
- Required fields validation

#### Parse API (`app/api/parse-paper/route.test.ts`)
Tests for paper parsing endpoint:
- Streaming structured output
- Progress updates during parsing
- PDF input handling (base64 and URL)
- Error scenarios
- Model configuration

## Test Coverage

Current test coverage includes:
- ✅ Caching logic (cache hits, misses, storage, retrieval)
- ✅ Wolfram Alpha integration
- ✅ Paper schema validation
- ✅ Parse API streaming and error handling

## Implementation Details

### Streaming Parse Tests

The parse API tests verify:
1. **Streaming Progress**: Tests that progress updates are sent as sections are extracted
2. **Multiple Input Methods**: Tests both PDF base64 and URL inputs
3. **Model Selection**: Tests that the correct model is used
4. **Error Handling**: Tests PDF fetch failures and missing data

### Cache Tests

The cache tests use fake-indexeddb to simulate browser IndexedDB:
1. **Storage**: Papers are stored with hash, content, and metadata
2. **Retrieval**: Papers can be retrieved by matching PDF content
3. **Cache Miss**: Returns null when no matching paper is found
4. **Clearing**: Cache can be cleared completely

## Debugging Tests

To debug a specific test:

```bash
# Run with verbose output
pnpm test --reporter=verbose

# Run a single test file
pnpm test paper-cache.test.ts

# Run tests matching a pattern
pnpm test -t "should cache and retrieve"
```

## Adding New Tests

When adding new features, follow this pattern:

1. Create a test file next to the implementation: `feature.test.ts`
2. Use descriptive test names: `it('should handle edge case when X happens')`
3. Mock external dependencies (AI SDK, fetch, etc.)
4. Test both success and error cases
5. Run tests after each change: `pnpm test`

## Performance Improvements Tested

### Streaming Structured Output

The parse API uses `streamText()` with `Output.object()` and `partialOutputStream` (when `stream=true`), which:
- Streams partial results as they're generated (not blocking)
- Sends real-time progress events (sections extracted)
- Provides better user feedback
- Tests verify progress updates are sent correctly

### Caching

Papers are cached in the browser (IndexedDB via `lib/paper-cache.ts`) to avoid re-parsing:
- Content (base64 or URL) is hashed for cache key generation
- Tests verify cache hit/miss behavior and storage/retrieval
- Logs added for debugging cache operations

## Continuous Testing

Tests should be run:
- Before committing changes
- After adding new features
- When debugging issues
- As part of CI/CD pipeline (future)
