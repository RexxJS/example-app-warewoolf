/**
 * Unit tests for WoolfRexxHandler
 * Tests command parsing, execution, and error handling
 */

const { WoolfRexxHandler } = require('../../src/components/controllers/woolf-rexx-handler');

describe('WoolfRexxHandler', () => {
  let handler;
  let mockContext;
  let mockQuill;
  let mockProject;

  beforeEach(() => {
    // Create mock Quill editor
    mockQuill = {
      getContents: jest.fn(() => ({ ops: [{ insert: 'Test content\n' }] })),
      getText: jest.fn(() => 'Test content\n'),
      setText: jest.fn(),
      insertText: jest.fn(),
      getLength: jest.fn(() => 13),
      getSelection: jest.fn(() => ({ index: 0, length: 4 })),
      formatText: jest.fn(),
      history: {
        undo: jest.fn(),
        redo: jest.fn()
      }
    };

    // Create mock project
    mockProject = {
      chapters: [
        { title: 'Chapter 1', filename: 'chapter1.txt', summary: 'First chapter', getContentsOrFile: jest.fn(() => ({ ops: [{ insert: 'Content 1' }] })) },
        { title: 'Chapter 2', filename: 'chapter2.txt', summary: 'Second chapter', getContentsOrFile: jest.fn(() => ({ ops: [{ insert: 'Content 2' }] })) }
      ]
    };

    // Create mock context
    mockContext = {
      editorQuill: mockQuill,
      project: mockProject,
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

    // Create handler instance
    handler = new WoolfRexxHandler(mockContext);
  });

  describe('Document Operations', () => {
    test('get-content returns text format', async () => {
      const result = await handler.run('get-content', { format: 'text' });
      expect(result).toBe('Test content\n');
    });

    test('get-content returns delta format by default', async () => {
      const result = await handler.run('get-content');
      expect(result).toEqual({ ops: [{ insert: 'Test content\n' }] });
    });

    test('set-content replaces document content', async () => {
      const result = await handler.run('set-content', { text: 'New content' });
      expect(mockQuill.setText).toHaveBeenCalledWith('New content');
      expect(result.success).toBe(true);
      expect(result.length).toBe(11);
    });

    test('append adds text to end', async () => {
      const result = await handler.run('append', { text: ' appended' });
      expect(mockQuill.insertText).toHaveBeenCalledWith(13, ' appended');
      expect(result.success).toBe(true);
      expect(result.position).toBe(13);
    });

    test('insert adds text at position', async () => {
      const result = await handler.run('insert', { text: 'inserted', position: 5 });
      expect(mockQuill.insertText).toHaveBeenCalledWith(5, 'inserted');
      expect(result.success).toBe(true);
      expect(result.position).toBe(5);
    });
  });

  describe('Chapter Management', () => {
    test('list-chapters returns all chapters', async () => {
      const result = await handler.run('list-chapters');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        index: 0,
        title: 'Chapter 1',
        filename: 'chapter1.txt'
      });
    });

    test('add-chapter creates new chapter', async () => {
      const result = await handler.run('add-chapter', { title: 'New Chapter' });
      expect(mockContext.onAddChapter).toHaveBeenCalledWith('New Chapter');
      expect(result.success).toBe(true);
    });

    test('delete-chapter removes chapter', async () => {
      const result = await handler.run('delete-chapter', { number: 1 });
      expect(mockContext.onDeleteChapter).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
    });

    test('get-chapter returns chapter data', async () => {
      const result = await handler.run('get-chapter', { number: 0, format: 'text' });
      expect(result.title).toBe('Chapter 1');
      expect(result.summary).toBe('First chapter');
      expect(result.content).toBe('Content 1');
    });

    test('get-chapter throws error for invalid index', async () => {
      await expect(handler.run('get-chapter', { number: 99 }))
        .rejects.toThrow('Invalid chapter index');
    });

    test('set-chapter-title updates title', async () => {
      const result = await handler.run('set-chapter-title', { number: 0, title: 'Updated Title' });
      expect(mockProject.chapters[0].title).toBe('Updated Title');
      expect(result.success).toBe(true);
    });

    test('go-to-chapter navigates to chapter', async () => {
      const result = await handler.run('go-to-chapter', { number: 1 });
      expect(mockContext.onGoToChapter).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
    });
  });

  describe('Search & Replace', () => {
    test('find returns match positions', async () => {
      mockQuill.getText.mockReturnValue('test word test word test');
      const result = await handler.run('find', { text: 'test' });
      expect(result.found).toBe(true);
      expect(result.count).toBe(3);
      expect(result.positions).toEqual([0, 10, 20]);
    });

    test('find returns no matches', async () => {
      mockQuill.getText.mockReturnValue('no matches here');
      const result = await handler.run('find', { text: 'missing' });
      expect(result.found).toBe(false);
      expect(result.count).toBe(0);
    });

    test('replace replaces all occurrences', async () => {
      mockQuill.getText.mockReturnValue('old old old');
      mockQuill.setText.mockImplementation(() => {});

      const result = await handler.run('replace', { search: 'old', 'replace-with': 'new' });
      expect(mockQuill.setText).toHaveBeenCalledWith('new new new');
      expect(result.success).toBe(true);
    });
  });

  describe('Formatting', () => {
    test('format-selection applies bold', async () => {
      const result = await handler.run('format-selection', { bold: 'true' });
      expect(mockQuill.formatText).toHaveBeenCalledWith(0, 4, { bold: true });
      expect(result.success).toBe(true);
    });

    test('format-selection applies multiple formats', async () => {
      const result = await handler.run('format-selection', {
        bold: 'true',
        italic: 'true',
        underline: 'false'
      });
      expect(mockQuill.formatText).toHaveBeenCalledWith(0, 4, {
        bold: true,
        italic: true,
        underline: false
      });
    });

    test('format-selection throws error with no selection', async () => {
      mockQuill.getSelection.mockReturnValue(null);
      await expect(handler.run('format-selection', { bold: 'true' }))
        .rejects.toThrow('No selection');
    });
  });

  describe('Statistics', () => {
    test('get-word-count returns total words', async () => {
      // Mock the require for wordcount
      const mockGetTotalWordCount = jest.fn(() => 1000);
      jest.mock('../../src/components/controllers/wordcount', () => ({
        getTotalWordCount: mockGetTotalWordCount
      }));

      // For this test, we'll verify the structure
      const result = await handler.run('get-word-count');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('chapters');
      expect(result.chapters).toBe(2);
    });

    test('get-chapter-word-count returns chapter words', async () => {
      const result = await handler.run('get-chapter-word-count', { number: 0 });
      expect(result).toHaveProperty('chapter');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('words');
      expect(result.chapter).toBe(0);
      expect(result.title).toBe('Chapter 1');
    });
  });

  describe('File Operations', () => {
    test('save-document calls save handler', async () => {
      const result = await handler.run('save-document');
      expect(mockContext.onSave).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('open-document calls open handler', async () => {
      const result = await handler.run('open-document', { path: '/path/to/file.woolf' });
      expect(mockContext.onOpen).toHaveBeenCalledWith('/path/to/file.woolf');
      expect(result.success).toBe(true);
    });

    test('open-document requires path', async () => {
      await expect(handler.run('open-document', {}))
        .rejects.toThrow('Path parameter required');
    });

    test('new-document creates new project', async () => {
      const result = await handler.run('new-document', { title: 'My Novel' });
      expect(mockContext.onNewProject).toHaveBeenCalledWith('My Novel');
      expect(result.success).toBe(true);
    });
  });

  describe('Editor Operations', () => {
    test('undo calls editor undo', async () => {
      const result = await handler.run('undo');
      expect(mockQuill.history.undo).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    test('redo calls editor redo', async () => {
      const result = await handler.run('redo');
      expect(mockQuill.history.redo).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('Debug Operations', () => {
    test('get-debug-log returns log entries', async () => {
      await handler.run('get-content');
      await handler.run('list-chapters');

      const result = await handler.run('get-debug-log');
      expect(typeof result).toBe('string');
      expect(result).toContain('get-content');
      expect(result).toContain('list-chapters');
    });

    test('clear-debug-log clears log', async () => {
      await handler.run('get-content');
      const result = await handler.run('clear-debug-log');
      expect(result.success).toBe(true);

      const log = await handler.run('get-debug-log');
      expect(log).not.toContain('get-content');
    });
  });

  describe('Error Handling', () => {
    test('unknown command throws error', async () => {
      await expect(handler.run('invalid-command'))
        .rejects.toThrow('Unknown command: invalid-command');
    });

    test('errors are logged', async () => {
      try {
        await handler.run('invalid-command');
      } catch (e) {
        // Expected error
      }

      const log = await handler.run('get-debug-log');
      expect(log).toContain('ERROR');
    });
  });

  describe('Utility Functions', () => {
    test('deltaToText converts delta to plain text', () => {
      const delta = { ops: [
        { insert: 'Hello ' },
        { insert: 'world', attributes: { bold: true } },
        { insert: '\n' }
      ]};

      const text = handler.deltaToText(delta);
      expect(text).toBe('Hello world\n');
    });

    test('deltaToText handles empty delta', () => {
      const text = handler.deltaToText(null);
      expect(text).toBe('');
    });

    test('log adds entries to debug log', () => {
      handler.log('Test message', { data: 'value' });
      const log = handler.debugLog[handler.debugLog.length - 1];
      expect(log).toContain('Test message');
      expect(log).toContain('data');
    });

    test('log respects max entries limit', () => {
      // Fill beyond max
      for (let i = 0; i < 150; i++) {
        handler.log(`Message ${i}`);
      }

      expect(handler.debugLog.length).toBeLessThanOrEqual(handler.maxLogEntries);
    });
  });
});
