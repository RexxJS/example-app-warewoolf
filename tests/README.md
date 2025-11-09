# WareWoolf RexxJS Test Suite

This directory contains the test suite for WareWoolf's RexxJS integration.

## Test Structure

```
tests/
├── unit/                          # Unit tests (Jest)
│   ├── woolf-rexx-handler.test.js    # Command handler tests
│   └── woolf-controlbus.test.js      # Control bus tests
├── playwright/                    # Integration tests (Playwright)
│   ├── rexxjs-integration.electron.test.js  # Electron app tests
│   └── controlbus.controlbus.test.js        # Control bus UI tests
├── helpers/                       # Test utilities
│   └── test-utils.js                 # Helper functions
└── README.md                      # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Playwright Tests Only
```bash
npm run test:playwright
```

### Playwright UI Mode (Interactive)
```bash
npm run test:playwright:ui
```

### Playwright Debug Mode
```bash
npm run test:playwright:debug
```

## Test Coverage

### Unit Tests (Jest)

**woolf-rexx-handler.test.js** - 40+ tests covering:
- Document operations: get-content, set-content, append, insert
- Chapter management: list, add, delete, get, set-title, navigate
- Search & replace: find, replace
- Formatting: bold, italic, underline, strike
- Statistics: word count (total and per-chapter)
- File operations: save, open, new, export
- Editor operations: undo, redo
- Debug operations: get-log, clear-log
- Error handling
- Utility functions

**woolf-controlbus.test.js** - 20+ tests covering:
- WoolfWorkerBridge: message handling, command execution, error responses
- WoolfDirectorBridge: command sending, response handling, timeouts, cleanup
- postMessage communication
- Request/response pairing
- Error propagation

### Integration Tests (Playwright)

**rexxjs-integration.electron.test.js** - 30+ tests covering:
- ADDRESS_WOOLF interface availability
- Document operations in real app
- Chapter management workflows
- Search and replace in editor
- Statistics generation
- Editor undo/redo
- Debug log functionality
- Error handling
- Complex multi-step workflows

**controlbus.controlbus.test.js** - 25+ tests covering:
- Demo page UI
- Example script loading
- Script editing
- Control bus bridges
- Command parsing
- Output display
- Status updates
- Error styling

## Test Requirements

### Prerequisites
```bash
# Install dependencies
npm install

# For Playwright tests on first run
npx playwright install
```

### Environment Setup

Tests expect:
- RexxJS bundle downloaded to `src/lib/rexxjs.bundle.js`
- Electron app buildable from source
- HTTP server available for control bus tests (port 8888)

## Writing New Tests

### Unit Test Example

```javascript
const { WoolfRexxHandler } = require('../../src/components/controllers/woolf-rexx-handler');
const { createMockContext } = require('../helpers/test-utils');

test('my new command works', async () => {
  const context = createMockContext();
  const handler = new WoolfRexxHandler(context);

  const result = await handler.run('my-command', { param: 'value' });

  expect(result.success).toBe(true);
});
```

### Playwright Test Example

```javascript
const { test, expect } = require('@playwright/test');

test('my integration test', async ({ page }) => {
  // Navigate to app or demo
  await page.goto('http://localhost:8888/woolf-controlbus-demo.html');

  // Interact with page
  await page.click('button:has-text("Run")');

  // Assert results
  await expect(page.locator('#output')).toContainText('Success');
});
```

## Test Helpers

The `test-utils.js` file provides helpful utilities:

- `createMockQuill()` - Mock Quill editor
- `createMockProject()` - Mock project with chapters
- `createMockContext()` - Complete mock context for handler
- `createMockMessageEvent()` - Mock postMessage event
- `waitFor()` - Wait for async conditions
- `executeRexxCommand()` - Execute commands in Electron app
- `assertCommandSucceeds()` - Assert command success
- `assertCommandFails()` - Assert expected failures

## Coverage Reports

After running tests, coverage reports are generated in:
- `test-results/coverage/` - Unit test coverage (Jest)
- `test-results/html/` - Playwright test results

View coverage:
```bash
open test-results/coverage/lcov-report/index.html
```

View Playwright results:
```bash
npx playwright show-report test-results/html
```

## Continuous Integration

Tests are designed to run in CI environments:
- Set `CI=true` environment variable
- Tests will run in headless mode
- Retries enabled for flaky tests
- Results exported to standard formats

## Debugging Tests

### Jest Tests
```bash
# Run specific test file
npm run test:unit -- woolf-rexx-handler.test.js

# Run tests matching pattern
npm run test:unit -- --testNamePattern="document operations"

# Watch mode
npm run test:unit -- --watch
```

### Playwright Tests
```bash
# Run specific test file
npm run test:playwright -- rexxjs-integration.electron.test.js

# Run in headed mode
npm run test:playwright -- --headed

# Run with debug
npm run test:playwright:debug

# Interactive UI mode
npm run test:playwright:ui
```

## Known Issues

1. **Electron tests may be slow** - First launch downloads Electron binaries
2. **Port 8888 conflicts** - Ensure port is available for web server
3. **Timing issues** - Some tests may need longer timeouts on slower systems

## Contributing

When adding new features:

1. Write unit tests first (TDD approach)
2. Ensure >70% code coverage
3. Add integration tests for user workflows
4. Update this README if adding new test categories
5. Run full test suite before committing

## Test Statistics

Current test count:
- **Unit tests**: 60+ tests
- **Playwright tests**: 55+ tests
- **Total**: 115+ tests

Coverage targets:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%
