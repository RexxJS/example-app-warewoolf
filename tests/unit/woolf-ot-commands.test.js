/**
 * Unit tests for OT commands in WoolfRexxHandler
 * Tests collaborative editing and LLM interaction commands
 */

const { setupRexxJSControl } = require('../../src/components/controllers/woolf-rexx-handler');

describe('WoolfRexxHandler OT Commands', () => {
  let handler;
  let mockContext;
  let mockQuill;

  beforeEach(() => {
    // Mock Quill editor
    mockQuill = {
      getText: jest.fn(() => 'Sample document content for testing'),
      getLength: jest.fn(() => 35),
      getContents: jest.fn(() => ({
        ops: [
          { insert: 'Chapter 1\n', attributes: { header: 1 } },
          { insert: 'Sample document content for testing\n' }
        ]
      })),
      insertText: jest.fn(),
      deleteText: jest.fn(),
      updateContents: jest.fn(),
      formatText: jest.fn(),
      getSelection: jest.fn(() => ({ index: 0, length: 0 })),
      setSelection: jest.fn(),
      on: jest.fn()
    };

    // Mock context
    mockContext = {
      editorQuill: mockQuill,
      documentId: 'test-doc-456'
    };

    handler = setupRexxJSControl(mockContext);
  });

  describe('Version Control Commands', () => {
    test('get-version should return current version', async () => {
      const result = await handler.run('get-version', {});

      expect(result).toHaveProperty('version');
      expect(result.version).toBe(0);
    });

    test('get-changes-since should return changes after version', async () => {
      // Make some changes
      await handler.run('insert-at', { index: 0, text: 'Hello', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 5, text: ' World', 'user-id': 'user1' });

      const result = await handler.run('get-changes-since', { since: 0 });

      expect(result.changes).toHaveLength(2);
      expect(result.changes[0]).toMatchObject({
        version: 1,
        operation: 'insert',
        text: 'Hello'
      });
    });

    test('subscribe-changes should create subscription', async () => {
      const result = await handler.run('subscribe-changes', { 'user-id': 'user1' });

      expect(result).toHaveProperty('subscriptionId');
      expect(result.subscribed).toBe(true);
    });

    test('unsubscribe-changes should remove subscription', async () => {
      const subResult = await handler.run('subscribe-changes', { 'user-id': 'user1' });
      const unsubResult = await handler.run('unsubscribe-changes', {
        'subscription-id': subResult.subscriptionId
      });

      expect(unsubResult.unsubscribed).toBe(true);
    });
  });

  describe('Cursor and Selection Commands', () => {
    test('get-cursor should return cursor position', async () => {
      await handler.run('set-cursor', { 'user-id': 'user1', index: 10 });
      const result = await handler.run('get-cursor', { 'user-id': 'user1' });

      expect(result).toMatchObject({
        index: 10,
        length: 0
      });
    });

    test('set-cursor should update cursor position', async () => {
      const result = await handler.run('set-cursor', {
        'user-id': 'user1',
        index: 15
      });

      expect(result.updated).toBe(true);
      expect(result.cursor.index).toBe(15);
    });

    test('get-selection should return selection range', async () => {
      await handler.run('set-selection', {
        'user-id': 'user1',
        index: 5,
        length: 10
      });

      const result = await handler.run('get-selection', { 'user-id': 'user1' });

      expect(result).toMatchObject({
        index: 5,
        length: 10
      });
    });

    test('set-selection should update selection', async () => {
      const result = await handler.run('set-selection', {
        'user-id': 'user1',
        index: 10,
        length: 20
      });

      expect(result.updated).toBe(true);
      expect(result.selection).toMatchObject({ index: 10, length: 20 });
    });

    test('get-all-cursors should return all user cursors', async () => {
      await handler.run('set-cursor', { 'user-id': 'user1', index: 5 });
      await handler.run('set-cursor', { 'user-id': 'user2', index: 15 });

      const result = await handler.run('get-all-cursors', {});

      expect(result.cursors).toBeDefined();
      expect(Object.keys(result.cursors).length).toBe(2);
    });

    test('get-all-selections should return all user selections', async () => {
      await handler.run('set-selection', { 'user-id': 'user1', index: 0, length: 5 });
      await handler.run('set-selection', { 'user-id': 'user2', index: 10, length: 15 });

      const result = await handler.run('get-all-selections', {});

      expect(result.selections).toBeDefined();
      expect(Object.keys(result.selections).length).toBe(2);
    });
  });

  describe('OT Operation Commands', () => {
    test('insert-at should insert text at index', async () => {
      const result = await handler.run('insert-at', {
        index: 5,
        text: 'inserted',
        'user-id': 'user1'
      });

      expect(mockQuill.insertText).toHaveBeenCalledWith(5, 'inserted', undefined);
      expect(result).toMatchObject({
        operation: 'insert',
        index: 5,
        text: 'inserted'
      });
    });

    test('insert-at should support formatting attributes', async () => {
      await handler.run('insert-at', {
        index: 5,
        text: 'bold text',
        'user-id': 'user1',
        bold: 'true'
      });

      expect(mockQuill.insertText).toHaveBeenCalledWith(
        5,
        'bold text',
        expect.objectContaining({ bold: true })
      );
    });

    test('delete-range should delete text', async () => {
      const result = await handler.run('delete-range', {
        index: 5,
        length: 10,
        'user-id': 'user1'
      });

      expect(mockQuill.deleteText).toHaveBeenCalledWith(5, 10);
      expect(result).toMatchObject({
        operation: 'delete',
        index: 5,
        length: 10
      });
    });

    test('replace-range should replace text', async () => {
      mockQuill.getText = jest.fn((index, length) => 'old text');

      const result = await handler.run('replace-range', {
        index: 5,
        length: 8,
        text: 'new text',
        'user-id': 'user1'
      });

      expect(mockQuill.deleteText).toHaveBeenCalledWith(5, 8);
      expect(mockQuill.insertText).toHaveBeenCalledWith(5, 'new text', undefined);
      expect(result).toMatchObject({
        operation: 'replace',
        oldText: 'old text',
        newText: 'new text'
      });
    });

    test('apply-delta should apply Quill delta', async () => {
      const delta = {
        ops: [
          { retain: 5 },
          { insert: 'Hello' },
          { delete: 3 }
        ]
      };

      const result = await handler.run('apply-delta', {
        delta: JSON.stringify(delta),
        'user-id': 'user1'
      });

      expect(mockQuill.updateContents).toHaveBeenCalledWith(delta);
      expect(result.applied).toBe(true);
    });
  });

  describe('Collaboration Commands', () => {
    test('announce-presence should register user', async () => {
      const result = await handler.run('announce-presence', {
        'user-id': 'llm-agent',
        'user-name': 'Claude',
        'user-type': 'llm'
      });

      expect(result).toMatchObject({
        userId: 'llm-agent',
        userName: 'Claude',
        userType: 'llm'
      });
    });

    test('get-active-users should list all users', async () => {
      await handler.run('announce-presence', {
        'user-id': 'user1',
        'user-name': 'Alice',
        'user-type': 'human'
      });
      await handler.run('announce-presence', {
        'user-id': 'llm-agent',
        'user-name': 'Claude',
        'user-type': 'llm'
      });

      const result = await handler.run('get-active-users', {});

      expect(result.users).toHaveLength(2);
      expect(result.users[0].userName).toBe('Alice');
      expect(result.users[1].userName).toBe('Claude');
    });

    test('lock-range should create range lock', async () => {
      const result = await handler.run('lock-range', {
        'user-id': 'user1',
        index: 10,
        length: 20
      });

      expect(result).toMatchObject({
        userId: 'user1',
        index: 10,
        length: 20,
        active: true
      });
    });

    test('lock-range should support duration', async () => {
      const result = await handler.run('lock-range', {
        'user-id': 'user1',
        index: 10,
        length: 20,
        duration: 5000
      });

      expect(result.duration).toBe(5000);
    });

    test('unlock-range should remove lock', async () => {
      const lockResult = await handler.run('lock-range', {
        'user-id': 'user1',
        index: 10,
        length: 20
      });

      const unlockResult = await handler.run('unlock-range', {
        'lock-id': lockResult.lockId,
        'user-id': 'user1'
      });

      expect(unlockResult.unlocked).toBe(true);
    });

    test('locked ranges should prevent edits from other users', async () => {
      await handler.run('lock-range', {
        'user-id': 'user1',
        index: 10,
        length: 20
      });

      await expect(handler.run('insert-at', {
        index: 15,
        text: 'test',
        'user-id': 'user2'
      })).rejects.toThrow('Range is locked');
    });
  });

  describe('Document Analysis Commands', () => {
    test('get-structure should return document structure', async () => {
      const result = await handler.run('get-structure', {});

      expect(result).toHaveProperty('chapters');
      expect(result).toHaveProperty('paragraphs');
    });

    test('get-range-text should return text from range', async () => {
      mockQuill.getText = jest.fn((index, length) => 'sample text');

      const result = await handler.run('get-range-text', {
        index: 10,
        length: 20
      });

      expect(result.text).toBe('sample text');
      expect(result.range).toMatchObject({ index: 10, length: 20 });
    });

    test('get-context-around should return surrounding text', async () => {
      mockQuill.getText = jest.fn(() => 'The quick brown fox jumps');

      const result = await handler.run('get-context-around', {
        index: 10,
        'context-size': 5
      });

      expect(result).toHaveProperty('before');
      expect(result).toHaveProperty('at');
      expect(result).toHaveProperty('after');
    });

    test('find-pattern should search document', async () => {
      mockQuill.getText = jest.fn(() => 'The cat sat on the mat');

      const result = await handler.run('find-pattern', {
        pattern: 'cat'
      });

      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('count');
    });

    test('find-pattern should support case-insensitive search', async () => {
      mockQuill.getText = jest.fn(() => 'The Cat sat on the mat');

      const result = await handler.run('find-pattern', {
        pattern: 'cat',
        'case-insensitive': 'true'
      });

      expect(result.count).toBeGreaterThan(0);
    });

    test('get-metadata should return document info', async () => {
      const result = await handler.run('get-metadata', {});

      expect(result).toMatchObject({
        documentId: 'test-doc-456',
        version: expect.any(Number),
        length: expect.any(Number)
      });
    });
  });

  describe('LLM Suggestion Commands', () => {
    test('suggest-edit should create suggestion', async () => {
      mockQuill.getText = jest.fn((index, length) => 'old text');

      const result = await handler.run('suggest-edit', {
        'user-id': 'llm-agent',
        index: 10,
        length: 8,
        'new-text': 'improved text',
        confidence: '0.95',
        reasoning: 'Better clarity'
      });

      expect(result).toMatchObject({
        userId: 'llm-agent',
        range: { index: 10, length: 8 },
        newText: 'improved text',
        oldText: 'old text',
        status: 'pending'
      });
      expect(result.metadata).toMatchObject({
        confidence: 0.95,
        reasoning: 'Better clarity'
      });
    });

    test('accept-suggestion should apply edit', async () => {
      mockQuill.getText = jest.fn((index, length) => 'old text');

      const suggestion = await handler.run('suggest-edit', {
        'user-id': 'llm-agent',
        index: 10,
        length: 8,
        'new-text': 'new text'
      });

      const result = await handler.run('accept-suggestion', {
        'suggestion-id': suggestion.suggestionId,
        'user-id': 'user1'
      });

      expect(result.status).toBe('accepted');
      expect(result.acceptedBy).toBe('user1');
      expect(mockQuill.deleteText).toHaveBeenCalled();
      expect(mockQuill.insertText).toHaveBeenCalled();
    });

    test('reject-suggestion should not apply edit', async () => {
      const suggestion = await handler.run('suggest-edit', {
        'user-id': 'llm-agent',
        index: 10,
        length: 8,
        'new-text': 'new text'
      });

      mockQuill.deleteText.mockClear();
      mockQuill.insertText.mockClear();

      const result = await handler.run('reject-suggestion', {
        'suggestion-id': suggestion.suggestionId,
        'user-id': 'user1',
        reason: 'Not needed'
      });

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Not needed');
      expect(mockQuill.deleteText).not.toHaveBeenCalled();
      expect(mockQuill.insertText).not.toHaveBeenCalled();
    });

    test('get-suggestions should list all suggestions', async () => {
      await handler.run('suggest-edit', {
        'user-id': 'llm-1',
        index: 5,
        length: 3,
        'new-text': 'text1'
      });
      await handler.run('suggest-edit', {
        'user-id': 'llm-2',
        index: 10,
        length: 5,
        'new-text': 'text2'
      });

      const result = await handler.run('get-suggestions', {});

      expect(result.suggestions).toHaveLength(2);
    });

    test('get-suggestions should filter by status', async () => {
      const s1 = await handler.run('suggest-edit', {
        'user-id': 'llm-1',
        index: 5,
        length: 3,
        'new-text': 'text1'
      });
      await handler.run('suggest-edit', {
        'user-id': 'llm-2',
        index: 10,
        length: 5,
        'new-text': 'text2'
      });

      await handler.run('accept-suggestion', {
        'suggestion-id': s1.suggestionId,
        'user-id': 'user1'
      });

      const result = await handler.run('get-suggestions', {
        status: 'pending'
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].status).toBe('pending');
    });

    test('clear-suggestions should remove suggestions', async () => {
      await handler.run('suggest-edit', {
        'user-id': 'llm-1',
        index: 5,
        length: 3,
        'new-text': 'text1'
      });

      const result = await handler.run('clear-suggestions', {});

      expect(result.cleared).toBeGreaterThan(0);
    });
  });

  describe('Annotation Commands', () => {
    test('annotate-range should create annotation', async () => {
      const result = await handler.run('annotate-range', {
        'user-id': 'user1',
        index: 10,
        length: 20,
        text: 'This needs work',
        type: 'comment'
      });

      expect(result).toMatchObject({
        userId: 'user1',
        range: { index: 10, length: 20 },
        text: 'This needs work',
        type: 'comment'
      });
    });

    test('get-annotations should return all annotations', async () => {
      await handler.run('annotate-range', {
        'user-id': 'user1',
        index: 5,
        length: 10,
        text: 'Comment 1',
        type: 'comment'
      });
      await handler.run('annotate-range', {
        'user-id': 'user2',
        index: 15,
        length: 20,
        text: 'Comment 2',
        type: 'highlight'
      });

      const result = await handler.run('get-annotations', {});

      expect(result.annotations).toHaveLength(2);
    });

    test('get-annotations should filter by type', async () => {
      await handler.run('annotate-range', {
        'user-id': 'user1',
        index: 5,
        length: 10,
        text: 'Comment',
        type: 'comment'
      });
      await handler.run('annotate-range', {
        'user-id': 'user2',
        index: 15,
        length: 20,
        text: 'Highlight',
        type: 'highlight'
      });

      const result = await handler.run('get-annotations', {
        type: 'comment'
      });

      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0].type).toBe('comment');
    });

    test('delete-annotation should remove annotation', async () => {
      const annotation = await handler.run('annotate-range', {
        'user-id': 'user1',
        index: 10,
        length: 20,
        text: 'Test',
        type: 'comment'
      });

      const result = await handler.run('delete-annotation', {
        'annotation-id': annotation.annotationId
      });

      expect(result.deleted).toBe(true);
    });
  });

  describe('Transaction Commands', () => {
    test('begin-transaction should start transaction', async () => {
      const result = await handler.run('begin-transaction', {
        'user-id': 'user1'
      });

      expect(result).toMatchObject({
        userId: 'user1',
        operations: []
      });
    });

    test('operations in transaction should not increment version', async () => {
      await handler.run('begin-transaction', { 'user-id': 'user1' });

      const version1 = (await handler.run('get-version', {})).version;

      await handler.run('insert-at', { index: 5, text: 'A', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 6, text: 'B', 'user-id': 'user1' });

      const version2 = (await handler.run('get-version', {})).version;

      expect(version2).toBe(version1); // Version unchanged during transaction
    });

    test('commit-transaction should apply all operations', async () => {
      await handler.run('begin-transaction', { 'user-id': 'user1' });
      await handler.run('insert-at', { index: 5, text: 'A', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 6, text: 'B', 'user-id': 'user1' });

      const result = await handler.run('commit-transaction', {});

      expect(result.committed).toBe(true);
      expect(result.operationCount).toBe(2);
    });

    test('rollback-transaction should discard operations', async () => {
      const initialVersion = (await handler.run('get-version', {})).version;

      await handler.run('begin-transaction', { 'user-id': 'user1' });
      await handler.run('insert-at', { index: 5, text: 'A', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 6, text: 'B', 'user-id': 'user1' });

      const result = await handler.run('rollback-transaction', {});

      expect(result.rolledBack).toBe(true);
      expect((await handler.run('get-version', {})).version).toBe(initialVersion);
    });
  });

  describe('History Commands', () => {
    test('get-history should return change log', async () => {
      await handler.run('insert-at', { index: 0, text: 'A', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 1, text: 'B', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 2, text: 'C', 'user-id': 'user1' });

      const result = await handler.run('get-history', {});

      expect(result.history).toHaveLength(3);
      expect(result.totalChanges).toBe(3);
    });

    test('get-history should limit results', async () => {
      await handler.run('insert-at', { index: 0, text: 'A', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 1, text: 'B', 'user-id': 'user1' });
      await handler.run('insert-at', { index: 2, text: 'C', 'user-id': 'user1' });

      const result = await handler.run('get-history', { limit: 2 });

      expect(result.history).toHaveLength(2);
    });

    test('revert-to-version should restore previous state', async () => {
      const v1 = (await handler.run('get-version', {})).version;
      await handler.run('insert-at', { index: 0, text: 'Test', 'user-id': 'user1' });

      const result = await handler.run('revert-to-version', {
        version: v1
      });

      expect(result.reverted).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing required parameters', async () => {
      await expect(handler.run('insert-at', {})).rejects.toThrow();
    });

    test('should handle invalid suggestion ID', async () => {
      await expect(handler.run('accept-suggestion', {
        'suggestion-id': 99999,
        'user-id': 'user1'
      })).rejects.toThrow();
    });

    test('should handle invalid lock ID', async () => {
      await expect(handler.run('unlock-range', {
        'lock-id': 99999,
        'user-id': 'user1'
      })).rejects.toThrow();
    });

    test('should handle invalid annotation ID', async () => {
      await expect(handler.run('delete-annotation', {
        'annotation-id': 99999
      })).rejects.toThrow();
    });

    test('should handle transaction errors', async () => {
      await expect(handler.run('commit-transaction', {}))
        .rejects.toThrow();
    });
  });
});
