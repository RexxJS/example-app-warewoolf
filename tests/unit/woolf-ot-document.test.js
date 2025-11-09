/**
 * Unit tests for WoolfOTDocument
 * Tests the Operational Transform document wrapper for collaborative editing
 */

const { WoolfOTDocument } = require('../../src/components/controllers/woolf-ot-document');

describe('WoolfOTDocument', () => {
  let mockQuill;
  let otDoc;

  beforeEach(() => {
    // Mock Quill editor
    mockQuill = {
      getText: jest.fn(() => 'Sample document text'),
      getLength: jest.fn(() => 20),
      getContents: jest.fn(() => ({
        ops: [{ insert: 'Sample document text\n' }]
      })),
      insertText: jest.fn(),
      deleteText: jest.fn(),
      updateContents: jest.fn(),
      formatText: jest.fn(),
      getSelection: jest.fn(() => ({ index: 0, length: 0 })),
      setSelection: jest.fn(),
      on: jest.fn()
    };

    otDoc = new WoolfOTDocument(mockQuill, 'test-doc-123');
  });

  describe('Version Control', () => {
    test('should start at version 0', () => {
      expect(otDoc.getVersion()).toBe(0);
    });

    test('should increment version after changes', () => {
      otDoc.insertAt(0, 'Hello', 'user1');
      expect(otDoc.getVersion()).toBe(1);

      otDoc.insertAt(5, ' World', 'user1');
      expect(otDoc.getVersion()).toBe(2);
    });

    test('should log changes with version numbers', () => {
      otDoc.insertAt(0, 'Test', 'user1');
      const changes = otDoc.getChangesSince(0);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        version: 1,
        userId: 'user1',
        operation: 'insert',
        index: 0,
        text: 'Test'
      });
    });

    test('should get changes since specific version', () => {
      otDoc.insertAt(0, 'A', 'user1'); // v1
      otDoc.insertAt(1, 'B', 'user1'); // v2
      otDoc.insertAt(2, 'C', 'user1'); // v3

      const changes = otDoc.getChangesSince(1);
      expect(changes).toHaveLength(2);
      expect(changes[0].version).toBe(2);
      expect(changes[1].version).toBe(3);
    });

    test('should keep max 1000 changes in log', () => {
      // Add 1050 changes
      for (let i = 0; i < 1050; i++) {
        otDoc.insertAt(0, 'x', 'user1');
      }

      expect(otDoc.changeLog.length).toBe(1000);
      expect(otDoc.getVersion()).toBe(1050);
    });
  });

  describe('Cursor and Selection Tracking', () => {
    test('should track cursor position for user', () => {
      otDoc.updateCursor('user1', 10);

      const cursor = otDoc.getCursor('user1');
      expect(cursor).toMatchObject({
        index: 10,
        length: 0
      });
    });

    test('should track selection for user', () => {
      otDoc.updateSelection('user1', 5, 10);

      const selection = otDoc.getSelection('user1');
      expect(selection).toMatchObject({
        index: 5,
        length: 10
      });
    });

    test('should get all cursors', () => {
      otDoc.updateCursor('user1', 5);
      otDoc.updateCursor('user2', 10);
      otDoc.updateCursor('llm-agent', 15);

      const allCursors = otDoc.getAllCursors();
      expect(allCursors.size).toBe(3);
      expect(allCursors.get('user1').index).toBe(5);
      expect(allCursors.get('user2').index).toBe(10);
      expect(allCursors.get('llm-agent').index).toBe(15);
    });

    test('should get all selections', () => {
      otDoc.updateSelection('user1', 0, 5);
      otDoc.updateSelection('user2', 10, 20);

      const allSelections = otDoc.getAllSelections();
      expect(allSelections.size).toBe(2);
      expect(allSelections.get('user1')).toMatchObject({ index: 0, length: 5 });
    });
  });

  describe('Presence Tracking', () => {
    test('should announce user presence', () => {
      const presence = otDoc.announcePresence('user1', 'Alice', 'human');

      expect(presence).toMatchObject({
        userId: 'user1',
        userName: 'Alice',
        userType: 'human',
        documentId: 'test-doc-123'
      });
    });

    test('should track active users', () => {
      otDoc.announcePresence('user1', 'Alice', 'human');
      otDoc.announcePresence('llm-agent', 'Claude', 'llm');

      const activeUsers = otDoc.getActiveUsers();
      expect(activeUsers.length).toBe(2);
      expect(activeUsers[0].userName).toBe('Alice');
      expect(activeUsers[1].userName).toBe('Claude');
    });

    test('should update lastSeen on presence announcement', () => {
      const first = otDoc.announcePresence('user1', 'Alice', 'human');
      const firstTime = first.lastSeen;

      // Wait a bit
      jest.advanceTimersByTime(100);

      const second = otDoc.announcePresence('user1', 'Alice', 'human');
      expect(second.lastSeen).toBeGreaterThan(firstTime);
    });
  });

  describe('Range Locks', () => {
    test('should lock range for user', () => {
      const lock = otDoc.lockRange('user1', 10, 20);

      expect(lock).toMatchObject({
        userId: 'user1',
        index: 10,
        length: 20,
        active: true
      });
    });

    test('should prevent editing locked range by other users', () => {
      otDoc.lockRange('user1', 10, 20);

      expect(() => {
        otDoc.insertAt(15, 'test', 'user2');
      }).toThrow('Range is locked by another user');
    });

    test('should allow lock owner to edit locked range', () => {
      otDoc.lockRange('user1', 10, 20);

      expect(() => {
        otDoc.insertAt(15, 'test', 'user1');
      }).not.toThrow();
    });

    test('should unlock range', () => {
      const lock = otDoc.lockRange('user1', 10, 20);

      otDoc.unlockRange(lock.lockId, 'user1');

      // Should now allow other users to edit
      expect(() => {
        otDoc.insertAt(15, 'test', 'user2');
      }).not.toThrow();
    });

    test('should auto-expire locks after duration', () => {
      jest.useFakeTimers();

      otDoc.lockRange('user1', 10, 20, 1000); // 1 second

      // Initially locked
      expect(() => {
        otDoc.insertAt(15, 'test', 'user2');
      }).toThrow();

      // After 1 second, should be unlocked
      jest.advanceTimersByTime(1001);

      expect(() => {
        otDoc.insertAt(15, 'test', 'user2');
      }).not.toThrow();

      jest.useRealTimers();
    });

    test('should only allow lock owner to unlock', () => {
      const lock = otDoc.lockRange('user1', 10, 20);

      expect(() => {
        otDoc.unlockRange(lock.lockId, 'user2');
      }).toThrow();
    });

    test('should check if range is locked', () => {
      otDoc.lockRange('user1', 10, 20);

      expect(otDoc.isRangeLocked(15, 1, 'user2')).toBe(true);
      expect(otDoc.isRangeLocked(15, 1, 'user1')).toBe(false); // owner
      expect(otDoc.isRangeLocked(5, 1, 'user2')).toBe(false); // outside range
    });
  });

  describe('OT Operations', () => {
    test('should insert text at index', () => {
      const result = otDoc.insertAt(5, 'Hello', 'user1');

      expect(mockQuill.insertText).toHaveBeenCalledWith(5, 'Hello', undefined);
      expect(result).toMatchObject({
        version: 1,
        operation: 'insert',
        index: 5,
        text: 'Hello'
      });
    });

    test('should insert text with attributes', () => {
      const attrs = { bold: true, color: 'red' };
      otDoc.insertAt(5, 'Hello', 'user1', attrs);

      expect(mockQuill.insertText).toHaveBeenCalledWith(5, 'Hello', attrs);
    });

    test('should delete range', () => {
      const result = otDoc.deleteRange(5, 10, 'user1');

      expect(mockQuill.deleteText).toHaveBeenCalledWith(5, 10);
      expect(result).toMatchObject({
        version: 1,
        operation: 'delete',
        index: 5,
        length: 10
      });
    });

    test('should replace range', () => {
      mockQuill.getText = jest.fn((index, length) => 'old text');

      const result = otDoc.replaceRange(5, 8, 'new text', 'user1');

      expect(mockQuill.deleteText).toHaveBeenCalledWith(5, 8);
      expect(mockQuill.insertText).toHaveBeenCalledWith(5, 'new text', undefined);
      expect(result).toMatchObject({
        version: 2,
        operation: 'replace',
        oldText: 'old text',
        newText: 'new text'
      });
    });

    test('should apply delta', () => {
      const delta = {
        ops: [
          { retain: 5 },
          { insert: 'Hello' },
          { delete: 3 }
        ]
      };

      const result = otDoc.applyDelta(delta, 'user1');

      expect(mockQuill.updateContents).toHaveBeenCalledWith(delta);
      expect(result.version).toBe(1);
    });
  });

  describe('Suggestion System', () => {
    test('should create suggestion for edit', () => {
      mockQuill.getText = jest.fn((index, length) => 'old text');

      const suggestion = otDoc.suggestEdit('llm-agent', 10, 8, 'better text', {
        confidence: 0.95,
        reasoning: 'Improved clarity'
      });

      expect(suggestion).toMatchObject({
        suggestionId: 1,
        userId: 'llm-agent',
        range: { index: 10, length: 8 },
        newText: 'better text',
        oldText: 'old text',
        status: 'pending',
        metadata: {
          confidence: 0.95,
          reasoning: 'Improved clarity'
        }
      });
    });

    test('should accept suggestion and apply changes', () => {
      mockQuill.getText = jest.fn((index, length) => 'old text');

      const suggestion = otDoc.suggestEdit('llm-agent', 10, 8, 'better text');
      const accepted = otDoc.acceptSuggestion(suggestion.suggestionId, 'user1');

      expect(accepted.status).toBe('accepted');
      expect(accepted.acceptedBy).toBe('user1');
      expect(mockQuill.deleteText).toHaveBeenCalledWith(10, 8);
      expect(mockQuill.insertText).toHaveBeenCalledWith(10, 'better text', undefined);
    });

    test('should reject suggestion without applying changes', () => {
      const suggestion = otDoc.suggestEdit('llm-agent', 10, 8, 'better text');
      const rejected = otDoc.rejectSuggestion(suggestion.suggestionId, 'user1', 'Not needed');

      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectedBy).toBe('user1');
      expect(rejected.rejectionReason).toBe('Not needed');
      expect(mockQuill.deleteText).not.toHaveBeenCalled();
    });

    test('should list all suggestions', () => {
      otDoc.suggestEdit('llm-1', 5, 3, 'text1');
      otDoc.suggestEdit('llm-2', 10, 5, 'text2');

      const suggestions = otDoc.getSuggestions();
      expect(suggestions.length).toBe(2);
    });

    test('should filter suggestions by status', () => {
      const s1 = otDoc.suggestEdit('llm-1', 5, 3, 'text1');
      const s2 = otDoc.suggestEdit('llm-2', 10, 5, 'text2');

      otDoc.acceptSuggestion(s1.suggestionId, 'user1');

      const pending = otDoc.getSuggestions({ status: 'pending' });
      expect(pending.length).toBe(1);
      expect(pending[0].suggestionId).toBe(s2.suggestionId);
    });

    test('should clear suggestions by status', () => {
      const s1 = otDoc.suggestEdit('llm-1', 5, 3, 'text1');
      const s2 = otDoc.suggestEdit('llm-2', 10, 5, 'text2');

      otDoc.acceptSuggestion(s1.suggestionId, 'user1');

      const result = otDoc.clearSuggestions({ status: 'accepted' });
      expect(result.cleared).toBe(1);

      const remaining = otDoc.getSuggestions();
      expect(remaining.length).toBe(1);
    });

    test('should throw error if suggestion already processed', () => {
      const suggestion = otDoc.suggestEdit('llm-1', 5, 3, 'text1');
      otDoc.acceptSuggestion(suggestion.suggestionId, 'user1');

      expect(() => {
        otDoc.acceptSuggestion(suggestion.suggestionId, 'user1');
      }).toThrow();
    });
  });

  describe('Annotations', () => {
    test('should add annotation to range', () => {
      const annotation = otDoc.annotate('user1', 10, 20, 'This needs revision', 'comment');

      expect(annotation).toMatchObject({
        userId: 'user1',
        range: { index: 10, length: 20 },
        text: 'This needs revision',
        type: 'comment'
      });
    });

    test('should get annotations in range', () => {
      otDoc.annotate('user1', 5, 10, 'Comment 1', 'comment');
      otDoc.annotate('user2', 15, 20, 'Comment 2', 'comment');
      otDoc.annotate('user3', 30, 5, 'Comment 3', 'comment');

      const annotations = otDoc.getAnnotations({ index: 10, length: 20 });
      expect(annotations.length).toBe(2); // Should include overlapping ones
    });

    test('should filter annotations by type', () => {
      otDoc.annotate('user1', 5, 10, 'Comment', 'comment');
      otDoc.annotate('user2', 15, 20, 'Highlight', 'highlight');

      const comments = otDoc.getAnnotations({ type: 'comment' });
      expect(comments.length).toBe(1);
      expect(comments[0].type).toBe('comment');
    });

    test('should delete annotation', () => {
      const annotation = otDoc.annotate('user1', 10, 20, 'Test', 'comment');

      const result = otDoc.deleteAnnotation(annotation.annotationId);
      expect(result.deleted).toBe(true);

      const annotations = otDoc.getAnnotations();
      expect(annotations.length).toBe(0);
    });
  });

  describe('Transactions', () => {
    test('should begin transaction', () => {
      const transaction = otDoc.beginTransaction('user1');

      expect(transaction).toMatchObject({
        userId: 'user1',
        operations: []
      });
      expect(otDoc.currentTransaction).not.toBeNull();
    });

    test('should group operations in transaction', () => {
      otDoc.beginTransaction('user1');

      otDoc.insertAt(5, 'Hello', 'user1');
      otDoc.insertAt(10, 'World', 'user1');

      expect(otDoc.currentTransaction.operations.length).toBe(2);
      // Version should not increment during transaction
      expect(otDoc.getVersion()).toBe(0);
    });

    test('should commit transaction and increment version once', () => {
      otDoc.beginTransaction('user1');
      otDoc.insertAt(5, 'A', 'user1');
      otDoc.insertAt(6, 'B', 'user1');

      const result = otDoc.commitTransaction();

      expect(result.committed).toBe(true);
      expect(result.operationCount).toBe(2);
      expect(otDoc.getVersion()).toBe(1); // Only one version for whole transaction
      expect(otDoc.currentTransaction).toBeNull();
    });

    test('should rollback transaction without applying changes', () => {
      const initialVersion = otDoc.getVersion();

      otDoc.beginTransaction('user1');
      otDoc.insertAt(5, 'A', 'user1');
      otDoc.insertAt(6, 'B', 'user1');

      const result = otDoc.rollbackTransaction();

      expect(result.rolledBack).toBe(true);
      expect(result.operationCount).toBe(2);
      expect(otDoc.getVersion()).toBe(initialVersion); // Version unchanged
      expect(otDoc.currentTransaction).toBeNull();
    });

    test('should throw error if starting transaction when one exists', () => {
      otDoc.beginTransaction('user1');

      expect(() => {
        otDoc.beginTransaction('user1');
      }).toThrow();
    });

    test('should throw error if committing with no transaction', () => {
      expect(() => {
        otDoc.commitTransaction();
      }).toThrow();
    });
  });

  describe('Change Subscriptions', () => {
    test('should subscribe to changes', () => {
      const callback = jest.fn();
      const subscriptionId = otDoc.subscribeToChanges('user1', callback);

      expect(typeof subscriptionId).toBe('number');
      expect(otDoc.changeSubscribers.has(subscriptionId)).toBe(true);
    });

    test('should notify subscribers of changes', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      otDoc.subscribeToChanges('user1', callback1);
      otDoc.subscribeToChanges('user2', callback2);

      otDoc.insertAt(5, 'Test', 'user1');

      expect(callback1).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          operation: 'insert',
          text: 'Test'
        })
      );
      expect(callback2).toHaveBeenCalled();
    });

    test('should unsubscribe from changes', () => {
      const callback = jest.fn();
      const subscriptionId = otDoc.subscribeToChanges('user1', callback);

      otDoc.unsubscribeFromChanges(subscriptionId);

      otDoc.insertAt(5, 'Test', 'user1');

      expect(callback).not.toHaveBeenCalled();
    });

    test('should filter subscriptions by userId', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      otDoc.subscribeToChanges('user1', callback1, { userId: 'user1' });
      otDoc.subscribeToChanges('user2', callback2);

      // Change by user1 should notify both
      otDoc.insertAt(5, 'A', 'user1');
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      callback1.mockClear();
      callback2.mockClear();

      // Change by user2 should only notify callback2 (no filter)
      otDoc.insertAt(6, 'B', 'user2');
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Document Analysis', () => {
    test('should get document structure', () => {
      mockQuill.getContents = jest.fn(() => ({
        ops: [
          { insert: 'Chapter 1\n', attributes: { header: 1 } },
          { insert: 'Some content\n' },
          { insert: 'Chapter 2\n', attributes: { header: 1 } },
          { insert: 'More content\n' }
        ]
      }));

      const structure = otDoc.getStructure();

      expect(structure.chapters).toBe(2);
      expect(structure.paragraphs).toBeGreaterThan(0);
    });

    test('should get text from range', () => {
      mockQuill.getText = jest.fn((index, length) => {
        if (index === 10 && length === 20) {
          return 'sample text here';
        }
        return '';
      });

      const text = otDoc.getRangeText(10, 20);
      expect(text).toBe('sample text here');
    });

    test('should get context around index', () => {
      mockQuill.getText = jest.fn(() => 'The quick brown fox jumps over the lazy dog');

      const context = otDoc.getContextAround(20, 5);

      expect(context).toHaveProperty('before');
      expect(context).toHaveProperty('at');
      expect(context).toHaveProperty('after');
    });

    test('should find pattern in document', () => {
      mockQuill.getText = jest.fn(() => 'The cat sat on the mat. The cat was happy.');

      const results = otDoc.findPattern(/the/gi);

      expect(results.matches.length).toBeGreaterThan(0);
      expect(results.count).toBeGreaterThan(0);
    });

    test('should get document metadata', () => {
      mockQuill.getText = jest.fn(() => 'Sample text with words');
      mockQuill.getLength = jest.fn(() => 22);

      const metadata = otDoc.getMetadata();

      expect(metadata).toMatchObject({
        documentId: 'test-doc-123',
        version: 0,
        length: 22
      });
    });
  });

  describe('History Management', () => {
    test('should get change history', () => {
      otDoc.insertAt(0, 'A', 'user1');
      otDoc.insertAt(1, 'B', 'user1');
      otDoc.insertAt(2, 'C', 'user1');

      const history = otDoc.getHistory();
      expect(history.length).toBe(3);
      expect(history[0].version).toBe(1);
    });

    test('should limit history size', () => {
      otDoc.insertAt(0, 'A', 'user1');
      otDoc.insertAt(1, 'B', 'user1');
      otDoc.insertAt(2, 'C', 'user1');

      const history = otDoc.getHistory(2);
      expect(history.length).toBe(2);
    });

    test('should revert to previous version', () => {
      // Note: This is a simplified test. Real reversion would need
      // inverse operation calculation
      const version1 = otDoc.getVersion();
      otDoc.insertAt(0, 'Test', 'user1');
      const version2 = otDoc.getVersion();

      expect(() => {
        otDoc.revertToVersion(version1);
      }).not.toThrow();
    });
  });
});
