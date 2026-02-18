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
```

## Test Structure

### Unit Tests

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

The parse API now uses `streamObject` instead of `generateText`, which:
- Streams results as they're generated (not blocking)
- Shows real-time progress (sections extracted)
- Provides better user feedback
- Tests verify progress updates are sent correctly

### Caching

Papers are cached in IndexedDB to avoid re-parsing:
- Content hashed for cache key generation
- Tests verify cache hit/miss behavior
- Logs added for debugging cache operations

## Continuous Testing

Tests should be run:
- Before committing changes
- After adding new features
- When debugging issues
- As part of CI/CD pipeline (future)
