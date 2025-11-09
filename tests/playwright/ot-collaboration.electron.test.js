/**
 * Playwright integration tests for OT collaborative editing
 * Tests real-world scenarios of humans and LLMs working together
 */

const { _electron: electron } = require('playwright');
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('OT Collaborative Editing', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../main.js')]
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test.describe('Multi-User Cursor Tracking', () => {
    test('should track multiple user cursors', async () => {
      // Set cursor for user1
      const result1 = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('set-cursor', {
          'user-id': 'user1',
          index: 10
        });
      });

      expect(result1.updated).toBe(true);

      // Set cursor for user2
      const result2 = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('set-cursor', {
          'user-id': 'user2',
          index: 25
        });
      });

      expect(result2.updated).toBe(true);

      // Get all cursors
      const allCursors = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-all-cursors', {});
      });

      expect(Object.keys(allCursors.cursors).length).toBe(2);
      expect(allCursors.cursors.user1.index).toBe(10);
      expect(allCursors.cursors.user2.index).toBe(25);
    });

    test('should track multiple user selections', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-selection', {
          'user-id': 'user1',
          index: 5,
          length: 15
        });

        await window.ADDRESS_WOOLF.run('set-selection', {
          'user-id': 'llm-agent',
          index: 20,
          length: 30
        });

        return await window.ADDRESS_WOOLF.run('get-all-selections', {});
      });

      expect(Object.keys(result.selections).length).toBe(2);
    });
  });

  test.describe('LLM Suggestion Workflow', () => {
    test('should allow LLM to suggest edits', async () => {
      const suggestion = await window.evaluate(async () => {
        // First insert some content
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'The quick brown fox jumps over the lazy dog.'
        });

        // LLM suggests replacing "quick" with "swift"
        return await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'llm-agent',
          index: 4,
          length: 5, // "quick"
          'new-text': 'swift',
          confidence: '0.92',
          reasoning: 'More formal and precise'
        });
      });

      expect(suggestion.status).toBe('pending');
      expect(suggestion.oldText).toContain('quick');
      expect(suggestion.newText).toBe('swift');
      expect(suggestion.metadata.confidence).toBe(0.92);
    });

    test('should allow human to accept LLM suggestion', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'The cat sat on the mat.'
        });

        // LLM suggests edit
        const suggestion = await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'llm-agent',
          index: 4,
          length: 3, // "cat"
          'new-text': 'kitten'
        });

        // Human accepts
        return await window.ADDRESS_WOOLF.run('accept-suggestion', {
          'suggestion-id': suggestion.suggestionId,
          'user-id': 'human-user'
        });
      });

      expect(result.status).toBe('accepted');
      expect(result.acceptedBy).toBe('human-user');

      // Verify content was updated
      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', {
          format: 'text'
        });
      });

      expect(content).toContain('kitten');
    });

    test('should allow human to reject LLM suggestion', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Hello world'
        });

        // LLM suggests edit
        const suggestion = await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'llm-agent',
          index: 0,
          length: 5, // "Hello"
          'new-text': 'Greetings'
        });

        // Human rejects
        return await window.ADDRESS_WOOLF.run('reject-suggestion', {
          'suggestion-id': suggestion.suggestionId,
          'user-id': 'human-user',
          reason: 'Prefer original phrasing'
        });
      });

      expect(result.status).toBe('rejected');
      expect(result.rejectionReason).toBe('Prefer original phrasing');

      // Verify content was NOT changed
      const content = await window.evaluate(async () => {
        return await window.ADDRESS_WOOLF.run('get-content', {
          format: 'text'
        });
      });

      expect(content).toContain('Hello');
      expect(content).not.toContain('Greetings');
    });

    test('should handle multiple pending suggestions', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'The quick brown fox jumps over the lazy dog.'
        });

        // LLM makes multiple suggestions
        await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'llm-agent',
          index: 4,
          length: 5,
          'new-text': 'swift'
        });

        await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'llm-agent',
          index: 16,
          length: 3,
          'new-text': 'hare'
        });

        await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'llm-agent',
          index: 36,
          length: 4,
          'new-text': 'sleepy'
        });

        return await window.ADDRESS_WOOLF.run('get-suggestions', {
          status: 'pending'
        });
      });

      expect(result.suggestions.length).toBe(3);
      expect(result.suggestions.every(s => s.status === 'pending')).toBe(true);
    });
  });

  test.describe('Range Locking', () => {
    test('should prevent edits to locked ranges', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'This is a test document.'
        });

        // User1 locks a range
        await window.ADDRESS_WOOLF.run('lock-range', {
          'user-id': 'user1',
          index: 10,
          length: 14 // "test document"
        });

        // Try to edit locked range as user2
        try {
          await window.ADDRESS_WOOLF.run('insert-at', {
            index: 15,
            text: 'modified',
            'user-id': 'user2'
          });
          return { error: null };
        } catch (error) {
          return { error: error.message };
        }
      });

      expect(result.error).toContain('locked');
    });

    test('should allow lock owner to edit locked range', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'This is a test document.'
        });

        // User1 locks a range
        await window.ADDRESS_WOOLF.run('lock-range', {
          'user-id': 'user1',
          index: 10,
          length: 14
        });

        // User1 can still edit their own locked range
        return await window.ADDRESS_WOOLF.run('insert-at', {
          index: 15,
          text: 'modified ',
          'user-id': 'user1'
        });
      });

      expect(result.operation).toBe('insert');
    });

    test('should allow edits after unlock', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'This is a test document.'
        });

        // User1 locks and then unlocks
        const lock = await window.ADDRESS_WOOLF.run('lock-range', {
          'user-id': 'user1',
          index: 10,
          length: 14
        });

        await window.ADDRESS_WOOLF.run('unlock-range', {
          'lock-id': lock.lockId,
          'user-id': 'user1'
        });

        // User2 should now be able to edit
        return await window.ADDRESS_WOOLF.run('insert-at', {
          index: 15,
          text: 'modified ',
          'user-id': 'user2'
        });
      });

      expect(result.operation).toBe('insert');
    });
  });

  test.describe('Presence and Collaboration', () => {
    test('should track active users', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('announce-presence', {
          'user-id': 'alice',
          'user-name': 'Alice Writer',
          'user-type': 'human'
        });

        await window.ADDRESS_WOOLF.run('announce-presence', {
          'user-id': 'claude',
          'user-name': 'Claude AI',
          'user-type': 'llm'
        });

        await window.ADDRESS_WOOLF.run('announce-presence', {
          'user-id': 'bob',
          'user-name': 'Bob Editor',
          'user-type': 'human'
        });

        return await window.ADDRESS_WOOLF.run('get-active-users', {});
      });

      expect(result.users.length).toBe(3);
      expect(result.users.find(u => u.userName === 'Alice Writer')).toBeDefined();
      expect(result.users.find(u => u.userName === 'Claude AI')).toBeDefined();
      expect(result.users.find(u => u.userType === 'llm')).toBeDefined();
    });
  });

  test.describe('Version Control and History', () => {
    test('should track version history', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Version 1'
        });

        const v1 = await window.ADDRESS_WOOLF.run('get-version', {});

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 9,
          text: '\nVersion 2',
          'user-id': 'user1'
        });

        const v2 = await window.ADDRESS_WOOLF.run('get-version', {});

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 19,
          text: '\nVersion 3',
          'user-id': 'user1'
        });

        const v3 = await window.ADDRESS_WOOLF.run('get-version', {});

        return {
          v1: v1.version,
          v2: v2.version,
          v3: v3.version
        };
      });

      expect(result.v2).toBeGreaterThan(result.v1);
      expect(result.v3).toBeGreaterThan(result.v2);
    });

    test('should retrieve changes since version', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Start'
        });

        const v1 = await window.ADDRESS_WOOLF.run('get-version', {});

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 5,
          text: ' Change1',
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 13,
          text: ' Change2',
          'user-id': 'user2'
        });

        return await window.ADDRESS_WOOLF.run('get-changes-since', {
          since: v1.version
        });
      });

      expect(result.changes.length).toBe(2);
      expect(result.changes[0].text).toContain('Change1');
      expect(result.changes[1].text).toContain('Change2');
    });

    test('should get full history', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Start'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 0,
          text: 'A',
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 1,
          text: 'B',
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 2,
          text: 'C',
          'user-id': 'user1'
        });

        return await window.ADDRESS_WOOLF.run('get-history', {});
      });

      expect(result.history.length).toBe(3);
      expect(result.totalChanges).toBe(3);
    });
  });

  test.describe('Transactions', () => {
    test('should group operations in transaction', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Base text'
        });

        const versionBefore = await window.ADDRESS_WOOLF.run('get-version', {});

        // Begin transaction
        await window.ADDRESS_WOOLF.run('begin-transaction', {
          'user-id': 'user1'
        });

        // Multiple operations
        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 9,
          text: ' edit1',
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 15,
          text: ' edit2',
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 21,
          text: ' edit3',
          'user-id': 'user1'
        });

        // Commit
        const committed = await window.ADDRESS_WOOLF.run('commit-transaction', {});
        const versionAfter = await window.ADDRESS_WOOLF.run('get-version', {});

        return {
          versionBefore: versionBefore.version,
          versionAfter: versionAfter.version,
          operationCount: committed.operationCount
        };
      });

      expect(result.operationCount).toBe(3);
      // All operations should be one version bump
      expect(result.versionAfter).toBe(result.versionBefore + 1);
    });

    test('should rollback transaction', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Original text'
        });

        const versionBefore = await window.ADDRESS_WOOLF.run('get-version', {});

        await window.ADDRESS_WOOLF.run('begin-transaction', {
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('insert-at', {
          index: 13,
          text: ' modified',
          'user-id': 'user1'
        });

        await window.ADDRESS_WOOLF.run('rollback-transaction', {});

        const versionAfter = await window.ADDRESS_WOOLF.run('get-version', {});
        const content = await window.ADDRESS_WOOLF.run('get-content', {
          format: 'text'
        });

        return {
          versionBefore: versionBefore.version,
          versionAfter: versionAfter.version,
          content
        };
      });

      // Version should not change
      expect(result.versionAfter).toBe(result.versionBefore);
      // Content should not have "modified"
      expect(result.content).not.toContain('modified');
    });
  });

  test.describe('Document Analysis', () => {
    test('should analyze document structure', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Chapter 1\n\nFirst paragraph.\n\nChapter 2\n\nSecond paragraph.'
        });

        return await window.ADDRESS_WOOLF.run('get-structure', {});
      });

      expect(result).toHaveProperty('chapters');
      expect(result).toHaveProperty('paragraphs');
    });

    test('should get context around cursor position', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'The quick brown fox jumps over the lazy dog.'
        });

        return await window.ADDRESS_WOOLF.run('get-context-around', {
          index: 20, // Position at "jumps"
          'context-size': 10
        });
      });

      expect(result).toHaveProperty('before');
      expect(result).toHaveProperty('at');
      expect(result).toHaveProperty('after');
    });

    test('should find patterns in document', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'The cat sat on the mat. The cat was happy.'
        });

        return await window.ADDRESS_WOOLF.run('find-pattern', {
          pattern: 'cat',
          'case-insensitive': 'true'
        });
      });

      expect(result.count).toBe(2);
      expect(result.matches.length).toBe(2);
    });
  });

  test.describe('Annotations', () => {
    test('should add and retrieve annotations', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'This paragraph needs revision.'
        });

        await window.ADDRESS_WOOLF.run('annotate-range', {
          'user-id': 'reviewer',
          index: 5,
          length: 9, // "paragraph"
          text: 'Consider rephrasing',
          type: 'comment'
        });

        return await window.ADDRESS_WOOLF.run('get-annotations', {});
      });

      expect(result.annotations.length).toBe(1);
      expect(result.annotations[0].text).toBe('Consider rephrasing');
    });

    test('should filter annotations by type', async () => {
      const result = await window.evaluate(async () => {
        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Sample text for annotation testing.'
        });

        await window.ADDRESS_WOOLF.run('annotate-range', {
          'user-id': 'user1',
          index: 0,
          length: 6,
          text: 'Important',
          type: 'highlight'
        });

        await window.ADDRESS_WOOLF.run('annotate-range', {
          'user-id': 'user2',
          index: 12,
          length: 10,
          text: 'Needs work',
          type: 'comment'
        });

        const highlights = await window.ADDRESS_WOOLF.run('get-annotations', {
          type: 'highlight'
        });

        const comments = await window.ADDRESS_WOOLF.run('get-annotations', {
          type: 'comment'
        });

        return { highlights, comments };
      });

      expect(result.highlights.annotations.length).toBe(1);
      expect(result.comments.annotations.length).toBe(1);
    });
  });

  test.describe('Real-World Collaboration Scenario', () => {
    test('should handle complete collaborative writing workflow', async () => {
      const result = await window.evaluate(async () => {
        // 1. Human starts document
        await window.ADDRESS_WOOLF.run('announce-presence', {
          'user-id': 'alice',
          'user-name': 'Alice',
          'user-type': 'human'
        });

        await window.ADDRESS_WOOLF.run('set-content', {
          text: 'Chapter 1: The Beginning\n\nIt was a dark night.'
        });

        // 2. LLM joins and suggests improvements
        await window.ADDRESS_WOOLF.run('announce-presence', {
          'user-id': 'claude',
          'user-name': 'Claude AI',
          'user-type': 'llm'
        });

        const suggestion1 = await window.ADDRESS_WOOLF.run('suggest-edit', {
          'user-id': 'claude',
          index: 39,
          length: 11, // "dark night"
          'new-text': 'dark and stormy night',
          confidence: '0.88',
          reasoning: 'More evocative opening'
        });

        // 3. Human accepts suggestion
        await window.ADDRESS_WOOLF.run('accept-suggestion', {
          'suggestion-id': suggestion1.suggestionId,
          'user-id': 'alice'
        });

        // 4. LLM annotates a section
        await window.ADDRESS_WOOLF.run('annotate-range', {
          'user-id': 'claude',
          index: 0,
          length: 25,
          text: 'Strong opening chapter title',
          type: 'comment'
        });

        // 5. Get final state
        const content = await window.ADDRESS_WOOLF.run('get-content', {
          format: 'text'
        });

        const users = await window.ADDRESS_WOOLF.run('get-active-users', {});
        const annotations = await window.ADDRESS_WOOLF.run('get-annotations', {});
        const version = await window.ADDRESS_WOOLF.run('get-version', {});

        return { content, users, annotations, version };
      });

      expect(result.content).toContain('dark and stormy night');
      expect(result.users.users.length).toBe(2);
      expect(result.annotations.annotations.length).toBe(1);
      expect(result.version.version).toBeGreaterThan(0);
    });
  });
});
