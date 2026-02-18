# Tests

This directory contains the test suite for the Research Paper Explainer application.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch
```

## Test Structure

- **lib/paper-cache.test.ts** - Tests for IndexedDB caching functionality
  - Cache storage and retrieval
  - Hash-based cache keys
  - Cache clearing
  - Timestamp tracking

- **lib/wolfram-alpha.test.ts** - Tests for Wolfram Alpha integration
  - API query handling
  - Error handling
  - Image extraction from results
  - Network error handling

- **lib/paper-schema.test.ts** - Tests for paper data schema validation
  - Valid paper structure
  - Math content validation
  - Required fields
  - Optional fields

## Testing Framework

We use [Vitest](https://vitest.dev/) as our testing framework, which provides:
- Fast test execution
- TypeScript support out of the box
- Compatible with Jest API
- Great developer experience

## Browser Environment

Tests that require browser APIs (like IndexedDB) use:
- **fake-indexeddb** - Mock implementation of IndexedDB for testing
- **happy-dom** - Lightweight DOM implementation for browser environment simulation

## Coverage

To generate a coverage report:

```bash
npm run test:coverage
```

This will create a coverage report in the `coverage/` directory.
