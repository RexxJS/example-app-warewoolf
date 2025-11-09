/**
 * Playwright integration tests for WareWoolf RexxJS
 * Tests the Electron app with RexxJS scripting
 */

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

let electronApp;
let window;

test.describe('WareWoolf RexxJS Integration', () => {
  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../src/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();

    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(2000); // Give time for initialization
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.describe('ADDRESS_WOOLF Interface', () => {
    test('should have ADDRESS_WOOLF available', async () => {
      const hasAddressWoolf = await window.evaluate(() => {
        return typeof window.ADDRESS_WOOLF !== 'undefined';
      });

      expect(hasAddressWoolf).toBe(true);
    });

    test('should have run method', async () => {
      const hasRun = await window.evaluate(() => {
        return typeof window.ADDRESS_WOOLF.run === 'function';
      });

      expect(hasRun).toBe(true);
    });
  });

  test.describe('Document Operations', () => {
    test('get-content should return document content', async () => {
      const result = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      });

      expect(typeof result).toBe('string');
    });

    test('set-content should update document', async () => {
      const testContent = 'Test content from Playwright';

      const result = await window.evaluate(async (content) => {
        await window.ADDRESS_WOOLF.run('set-content', { text: content });
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      }, testContent);

      expect(result).toContain('Test content from Playwright');
    });

    test('append should add text to end', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', { text: 'Initial' });
        await window.ADDRESS_WOOLF.run('append', { text: ' Appended' });
      });

      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      });

      expect(content).toContain('Initial Appended');
    });

    test('insert should add text at position', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', { text: 'Start End' });
        await window.ADDRESS_WOOLF.run('insert', { text: 'Middle ', position: 6 });
      });

      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      });

      expect(content).toContain('Start Middle End');
    });
  });

  test.describe('Chapter Management', () => {
    test('list-chapters should return chapters array', async () => {
      const chapters = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('list-chapters');
      });

      expect(Array.isArray(chapters)).toBe(true);
      expect(chapters.length).toBeGreaterThan(0);
    });

    test('add-chapter should create new chapter', async () => {
      const initialCount = await window.evaluate(async () => {
        const chapters = await window.ADDRESS_WOOLF.run('list-chapters');
        return chapters.length;
      });

      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('add-chapter', { title: 'Test Chapter' });
      });

      const newCount = await window.evaluate(async () => {
        const chapters = await window.ADDRESS_WOOLF.run('list-chapters');
        return chapters.length;
      });

      expect(newCount).toBe(initialCount + 1);
    });

    test('get-chapter should return chapter data', async () => {
      const chapter = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-chapter', { number: 0, format: 'text' });
      });

      expect(chapter).toHaveProperty('title');
      expect(chapter).toHaveProperty('content');
    });

    test('set-chapter-title should update title', async () => {
      const newTitle = 'Updated Chapter Title';

      await window.evaluate(async (title) => {
        await window.ADDRESS_WOOLF.run('set-chapter-title', { number: 0, title });
      }, newTitle);

      const chapters = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('list-chapters');
      });

      expect(chapters[0].title).toBe(newTitle);
    });
  });

  test.describe('Search & Replace', () => {
    test('find should locate text', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'test word test word test'
        });
      });

      const result = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('find', { text: 'test' });
      });

      expect(result.found).toBe(true);
      expect(result.count).toBe(3);
      expect(result.positions).toHaveLength(3);
    });

    test('find should return not found', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', { text: 'some content' });
      });

      const result = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('find', { text: 'missing' });
      });

      expect(result.found).toBe(false);
      expect(result.count).toBe(0);
    });

    test('replace should replace all occurrences', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', { text: 'old old old' });
        await window.ADDRESS_WOOLF.run('replace', {
          search: 'old',
          'replace-with': 'new'
        });
      });

      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      });

      expect(content).toContain('new new new');
    });
  });

  test.describe('Statistics', () => {
    test('get-word-count should return stats', async () => {
      const stats = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-word-count');
      });

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('chapters');
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.chapters).toBe('number');
    });

    test('get-chapter-word-count should return chapter stats', async () => {
      const stats = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-chapter-word-count', { number: 0 });
      });

      expect(stats).toHaveProperty('chapter');
      expect(stats).toHaveProperty('title');
      expect(stats).toHaveProperty('words');
      expect(typeof stats.words).toBe('number');
    });
  });

  test.describe('Editor Operations', () => {
    test('undo should work', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', { text: 'Initial' });
        await window.ADDRESS_WOOLF.run('append', { text: ' Change' });
        await window.ADDRESS_WOOLF.run('undo');
      });

      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      });

      expect(content).not.toContain('Change');
    });

    test('redo should work', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', { text: 'Initial' });
        await window.ADDRESS_WOOLF.run('append', { text: ' Change' });
        await window.ADDRESS_WOOLF.run('undo');
        await window.ADDRESS_WOOLF.run('redo');
      });

      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });
      });

      expect(content).toContain('Change');
    });
  });

  test.describe('Debug Operations', () => {
    test('get-debug-log should return log', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('clear-debug-log');
        await window.ADDRESS_WOOLF.run('get-word-count');
      });

      const log = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-debug-log');
      });

      expect(typeof log).toBe('string');
      expect(log).toContain('get-word-count');
    });

    test('clear-debug-log should clear log', async () => {
      await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('get-word-count');
        await window.ADDRESS_WOOLF.run('clear-debug-log');
      });

      const log = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-debug-log');
      });

      expect(log).not.toContain('get-word-count');
    });
  });

  test.describe('Error Handling', () => {
    test('should throw error for unknown command', async () => {
      const error = await window.evaluate(async () => {
        try {
          await window.ADDRESS_WOOLF.run('invalid-command');
          return null;
        } catch (e) {
          return e.message;
        }
      });

      expect(error).toContain('Unknown command');
    });

    test('should throw error for invalid parameters', async () => {
      const error = await window.evaluate(async () => {
        try {
          await window.ADDRESS_WOOLF.run('get-chapter', { number: 9999 });
          return null;
        } catch (e) {
          return e.message;
        }
      });

      expect(error).toContain('Invalid chapter index');
    });
  });

  test.describe('Complex Workflows', () => {
    test('should handle chapter creation workflow', async () => {
      const results = await window.evaluate(async () => {
        // Create chapters
        await window.ADDRESS_WOOLF.run('add-chapter', { title: 'Chapter 1' });
        await window.ADDRESS_WOOLF.run('add-chapter', { title: 'Chapter 2' });
        await window.ADDRESS_WOOLF.run('add-chapter', { title: 'Chapter 3' });

        // Get list
        const chapters = await window.ADDRESS_WOOLF.run('list-chapters');

        // Get word count
        const stats = await window.ADDRESS_WOOLF.run('get-word-count');

        return { chapters: chapters.length, words: stats.total };
      });

      expect(results.chapters).toBeGreaterThanOrEqual(3);
    });

    test('should handle find and replace workflow', async () => {
      const result = await window.evaluate(async () => {
        // Set content
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'The old dog ran to the old house'
        });

        // Find
        const findResult = await window.ADDRESS_WOOLF.run('find', { text: 'old' });

        // Replace
        await window.ADDRESS_WOOLF.run('replace', {
          search: 'old',
          'replace-with': 'new'
        });

        // Get updated content
        const content = await window.ADDRESS_WOOLF.run('get-content', { format: 'text' });

        return {
          foundCount: findResult.count,
          updatedContent: content
        };
      });

      expect(result.foundCount).toBe(2);
      expect(result.updatedContent).toContain('new dog');
      expect(result.updatedContent).toContain('new house');
      expect(result.updatedContent).not.toContain('old');
    });
  });
});
