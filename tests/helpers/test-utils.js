/**
 * Test helper utilities for WareWoolf RexxJS tests
 */

/**
 * Create a mock Quill editor instance
 */
function createMockQuill(initialContent = 'Test content\n') {
  const contents = { ops: [{ insert: initialContent }] };

  return {
    contents,
    getContents: jest.fn(() => contents),
    getText: jest.fn(() => initialContent),
    setText: jest.fn((text) => {
      contents.ops = [{ insert: text }];
    }),
    insertText: jest.fn((position, text) => {
      const currentText = initialContent;
      const newText = currentText.slice(0, position) + text + currentText.slice(position);
      contents.ops = [{ insert: newText }];
    }),
    getLength: jest.fn(() => initialContent.length),
    getSelection: jest.fn(() => ({ index: 0, length: 4 })),
    formatText: jest.fn(),
    setSelection: jest.fn(),
    focus: jest.fn(),
    history: {
      undo: jest.fn(),
      redo: jest.fn()
    }
  };
}

/**
 * Create a mock project with chapters
 */
function createMockProject(numChapters = 2) {
  const chapters = [];

  for (let i = 0; i < numChapters; i++) {
    chapters.push({
      title: `Chapter ${i + 1}`,
      filename: `chapter${i + 1}.txt`,
      summary: `Summary ${i + 1}`,
      contents: null,
      getContentsOrFile: jest.fn(() => ({
        ops: [{ insert: `Content ${i + 1}` }]
      })),
      getFile: jest.fn(),
      saveFile: jest.fn(),
      deleteFile: jest.fn()
    });
  }

  return {
    title: 'Test Project',
    directory: '/test/path',
    chapters,
    activeChapterIndex: 0,
    loadFile: jest.fn(),
    saveFile: jest.fn()
  };
}

/**
 * Create a mock context for WoolfRexxHandler
 */
function createMockContext(options = {}) {
  const quill = options.quill || createMockQuill();
  const project = options.project || createMockProject();

  return {
    editorQuill: quill,
    notesQuill: createMockQuill('Notes content\n'),
    project,
    userSettings: options.userSettings || {},

    // Event handlers
    onAddChapter: jest.fn(),
    onDeleteChapter: jest.fn(),
    onGoToChapter: jest.fn(),
    onUpdateChapterList: jest.fn(),
    onSave: jest.fn(),
    onOpen: jest.fn(),
    onNewProject: jest.fn(),
    onExportDocx: jest.fn(),
    onCompile: jest.fn()
  };
}

/**
 * Create a mock postMessage event
 */
function createMockMessageEvent(data, origin = 'http://localhost') {
  return {
    data,
    origin,
    source: {
      postMessage: jest.fn()
    }
  };
}

/**
 * Wait for a condition to be true
 */
async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}

/**
 * Create a simple test server for integration tests
 */
function createTestServer(port = 8888) {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');

  const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, '..', '..', req.url === '/' ? 'woolf-controlbus-demo.html' : req.url);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
      };

      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(data);
    });
  });

  return {
    start: () => new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`Test server running on http://localhost:${port}`);
        resolve();
      });
    }),
    stop: () => new Promise((resolve) => {
      server.close(() => {
        console.log('Test server stopped');
        resolve();
      });
    })
  };
}

/**
 * Simulate Electron app initialization
 */
async function initElectronApp(electronPath) {
  const { _electron: electron } = require('playwright');
  const path = require('path');

  const app = await electron.launch({
    args: [electronPath],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(2000); // Give time for initialization

  return { app, window };
}

/**
 * Execute RexxJS commands in Electron app
 */
async function executeRexxCommand(window, command, params = {}) {
  return await window.evaluate(
    async ({ cmd, prms }) => {
      return await window.ADDRESS_WOOLF.run(cmd, prms);
    },
    { cmd: command, prms: params }
  );
}

/**
 * Get current document content from Electron app
 */
async function getDocumentContent(window, format = 'text') {
  return await executeRexxCommand(window, 'get-content', { format });
}

/**
 * Set document content in Electron app
 */
async function setDocumentContent(window, text) {
  return await executeRexxCommand(window, 'set-content', { text });
}

/**
 * Assert that a RexxJS command succeeds
 */
async function assertCommandSucceeds(handler, command, params = {}) {
  const result = await handler.run(command, params);
  if (result.success === false) {
    throw new Error(`Command ${command} failed: ${result.error || 'Unknown error'}`);
  }
  return result;
}

/**
 * Assert that a RexxJS command fails
 */
async function assertCommandFails(handler, command, params = {}, expectedError) {
  try {
    await handler.run(command, params);
    throw new Error(`Expected command ${command} to fail, but it succeeded`);
  } catch (error) {
    if (expectedError && !error.message.includes(expectedError)) {
      throw new Error(`Expected error to contain "${expectedError}", got "${error.message}"`);
    }
    return error;
  }
}

module.exports = {
  createMockQuill,
  createMockProject,
  createMockContext,
  createMockMessageEvent,
  waitFor,
  createTestServer,
  initElectronApp,
  executeRexxCommand,
  getDocumentContent,
  setDocumentContent,
  assertCommandSucceeds,
  assertCommandFails
};
