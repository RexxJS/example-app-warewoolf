/**
 * WoolfOTDocument - Operational Transform Document Model
 *
 * Provides OT-enabled document manipulation for collaborative editing
 * Supports LLM and human concurrent editing with conflict resolution
 */

class WoolfOTDocument {
  constructor(quillEditor, documentId = 'default') {
    this.quill = quillEditor;
    this.documentId = documentId;
    this.version = 0;
    this.changeLog = [];
    this.maxLogSize = 1000;

    // Cursors and selections
    this.cursors = new Map(); // userId -> { index, length, timestamp }
    this.selections = new Map();

    // Active users/agents
    this.activeUsers = new Map(); // userId -> { name, type, lastSeen }

    // Suggestions (for LLM collaborative editing)
    this.suggestions = new Map(); // suggestionId -> { userId, range, delta, status }
    this.suggestionCounter = 0;

    // Annotations
    this.annotations = new Map(); // annotationId -> { userId, range, text, type }
    this.annotationCounter = 0;

    // Change subscribers
    this.changeSubscribers = new Map(); // subscriberId -> callback
    this.subscriberCounter = 0;

    // Transactions
    this.currentTransaction = null;
    this.transactionStack = [];

    // Range locks
    this.rangeLocks = new Map(); // lockId -> { userId, range, timestamp }
    this.lockCounter = 0;

    // Listen to Quill changes
    this.quill.on('text-change', this.handleTextChange.bind(this));
    this.quill.on('selection-change', this.handleSelectionChange.bind(this));
  }

  // ========== Version Control ==========

  getVersion() {
    return {
      version: this.version,
      timestamp: Date.now(),
      documentId: this.documentId
    };
  }

  incrementVersion() {
    this.version++;
    return this.version;
  }

  getChangesSince(sinceVersion) {
    return this.changeLog.filter(change => change.version > sinceVersion);
  }

  logChange(change) {
    const entry = {
      ...change,
      version: this.version,
      timestamp: Date.now()
    };

    this.changeLog.push(entry);

    // Trim log if too large
    if (this.changeLog.length > this.maxLogSize) {
      this.changeLog = this.changeLog.slice(-this.maxLogSize);
    }

    // Notify subscribers
    this.notifySubscribers(entry);

    return entry;
  }

  // ========== Change Subscriptions ==========

  subscribe(callback) {
    const subscriberId = ++this.subscriberCounter;
    this.changeSubscribers.set(subscriberId, callback);

    return {
      subscriberId,
      unsubscribe: () => this.unsubscribe(subscriberId)
    };
  }

  unsubscribe(subscriberId) {
    return this.changeSubscribers.delete(subscriberId);
  }

  notifySubscribers(change) {
    this.changeSubscribers.forEach(callback => {
      try {
        callback(change);
      } catch (error) {
        console.error('[OTDocument] Subscriber error:', error);
      }
    });
  }

  // ========== Operational Transform Operations ==========

  /**
   * Insert text at position with OT
   */
  insertAt(index, text, userId = 'system', attributes = {}) {
    // Check for range locks
    if (this.isRangeLocked(index, text.length, userId)) {
      throw new Error('Range is locked by another user');
    }

    // Transform index based on pending operations
    const transformedIndex = this.transformIndex(index);

    this.quill.insertText(transformedIndex, text, attributes);
    this.incrementVersion();

    const change = {
      type: 'insert',
      userId,
      index: transformedIndex,
      text,
      attributes,
      length: text.length
    };

    return this.logChange(change);
  }

  /**
   * Delete range with OT
   */
  deleteRange(index, length, userId = 'system') {
    if (this.isRangeLocked(index, length, userId)) {
      throw new Error('Range is locked by another user');
    }

    const transformedIndex = this.transformIndex(index);

    this.quill.deleteText(transformedIndex, length);
    this.incrementVersion();

    const change = {
      type: 'delete',
      userId,
      index: transformedIndex,
      length
    };

    return this.logChange(change);
  }

  /**
   * Replace range with OT
   */
  replaceRange(index, length, text, userId = 'system', attributes = {}) {
    if (this.isRangeLocked(index, length, userId)) {
      throw new Error('Range is locked by another user');
    }

    const transformedIndex = this.transformIndex(index);

    this.quill.deleteText(transformedIndex, length);
    this.quill.insertText(transformedIndex, text, attributes);
    this.incrementVersion();

    const change = {
      type: 'replace',
      userId,
      index: transformedIndex,
      oldLength: length,
      newText: text,
      newLength: text.length,
      attributes
    };

    return this.logChange(change);
  }

  /**
   * Apply Quill delta directly
   */
  applyDelta(delta, userId = 'system') {
    this.quill.updateContents(delta);
    this.incrementVersion();

    const change = {
      type: 'delta',
      userId,
      delta
    };

    return this.logChange(change);
  }

  /**
   * Transform index based on concurrent operations
   * Simple OT: adjust index based on changes since last sync
   */
  transformIndex(index) {
    // In a real OT system, this would transform based on pending operations
    // For now, we use the index as-is since Quill handles concurrent edits
    return index;
  }

  // ========== Cursor and Selection Tracking ==========

  setCursor(userId, index) {
    this.cursors.set(userId, {
      index,
      length: 0,
      timestamp: Date.now()
    });

    return { userId, index, timestamp: Date.now() };
  }

  getCursor(userId) {
    return this.cursors.get(userId);
  }

  getAllCursors() {
    const result = {};
    this.cursors.forEach((cursor, userId) => {
      result[userId] = cursor;
    });
    return result;
  }

  setSelection(userId, index, length) {
    this.selections.set(userId, {
      index,
      length,
      timestamp: Date.now()
    });

    // Also update cursor
    this.setCursor(userId, index);

    return { userId, index, length, timestamp: Date.now() };
  }

  getSelection(userId) {
    return this.selections.get(userId) || this.getCursor(userId);
  }

  handleSelectionChange(range, oldRange, source) {
    if (source === 'user' && range) {
      // Track system user's selection
      this.setSelection('system', range.index, range.length);
    }
  }

  handleTextChange(delta, oldDelta, source) {
    // This is called by Quill when text changes
    // We already log changes in our methods, so we track external changes here
    if (source === 'user') {
      this.incrementVersion();
      this.logChange({
        type: 'external',
        userId: 'system',
        delta,
        source
      });
    }
  }

  // ========== Collaborative User Management ==========

  announcePresence(userId, userName, userType = 'human') {
    this.activeUsers.set(userId, {
      name: userName,
      type: userType,
      lastSeen: Date.now(),
      joinedAt: this.activeUsers.has(userId) ?
        this.activeUsers.get(userId).joinedAt :
        Date.now()
    });

    return {
      userId,
      activeUsers: this.getActiveUsers()
    };
  }

  updatePresence(userId) {
    const user = this.activeUsers.get(userId);
    if (user) {
      user.lastSeen = Date.now();
    }
  }

  removePresence(userId) {
    this.activeUsers.delete(userId);
    this.cursors.delete(userId);
    this.selections.delete(userId);
  }

  getActiveUsers(activeThresholdMs = 60000) {
    const now = Date.now();
    const active = [];

    this.activeUsers.forEach((user, userId) => {
      if (now - user.lastSeen < activeThresholdMs) {
        active.push({
          userId,
          ...user
        });
      }
    });

    return active;
  }

  // ========== Range Locks ==========

  lockRange(userId, index, length, duration = 60000) {
    // Check if range is already locked
    for (const [lockId, lock] of this.rangeLocks.entries()) {
      if (this.rangesOverlap(
        { index, length },
        { index: lock.range.index, length: lock.range.length }
      ) && lock.userId !== userId) {
        throw new Error(`Range already locked by ${lock.userId}`);
      }
    }

    const lockId = ++this.lockCounter;
    const lock = {
      lockId,
      userId,
      range: { index, length },
      timestamp: Date.now(),
      expiresAt: Date.now() + duration
    };

    this.rangeLocks.set(lockId, lock);

    // Auto-unlock after duration
    setTimeout(() => {
      this.unlockRange(lockId, userId);
    }, duration);

    return lock;
  }

  unlockRange(lockId, userId) {
    const lock = this.rangeLocks.get(lockId);

    if (!lock) {
      return { success: false, error: 'Lock not found' };
    }

    if (lock.userId !== userId) {
      throw new Error('Cannot unlock range locked by another user');
    }

    this.rangeLocks.delete(lockId);
    return { success: true, lockId };
  }

  isRangeLocked(index, length, userId) {
    const now = Date.now();

    for (const [lockId, lock] of this.rangeLocks.entries()) {
      // Remove expired locks
      if (now > lock.expiresAt) {
        this.rangeLocks.delete(lockId);
        continue;
      }

      // Check if ranges overlap and locked by different user
      if (lock.userId !== userId &&
          this.rangesOverlap(
            { index, length },
            { index: lock.range.index, length: lock.range.length }
          )) {
        return true;
      }
    }

    return false;
  }

  rangesOverlap(range1, range2) {
    const end1 = range1.index + range1.length;
    const end2 = range2.index + range2.length;

    return range1.index < end2 && range2.index < end1;
  }

  // ========== LLM Suggestions ==========

  suggestEdit(userId, index, length, newText, metadata = {}) {
    const suggestionId = ++this.suggestionCounter;

    const suggestion = {
      suggestionId,
      userId,
      range: { index, length },
      newText,
      oldText: this.getRangeText(index, length),
      status: 'pending',
      metadata,
      createdAt: Date.now()
    };

    this.suggestions.set(suggestionId, suggestion);

    return suggestion;
  }

  acceptSuggestion(suggestionId, acceptingUserId = 'system') {
    const suggestion = this.suggestions.get(suggestionId);

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    if (suggestion.status !== 'pending') {
      throw new Error(`Suggestion already ${suggestion.status}`);
    }

    // Apply the suggestion
    const { index, length } = suggestion.range;
    this.replaceRange(index, length, suggestion.newText, acceptingUserId);

    // Update status
    suggestion.status = 'accepted';
    suggestion.acceptedBy = acceptingUserId;
    suggestion.acceptedAt = Date.now();

    return suggestion;
  }

  rejectSuggestion(suggestionId, rejectingUserId = 'system', reason = '') {
    const suggestion = this.suggestions.get(suggestionId);

    if (!suggestion) {
      throw new Error('Suggestion not found');
    }

    suggestion.status = 'rejected';
    suggestion.rejectedBy = rejectingUserId;
    suggestion.rejectedAt = Date.now();
    suggestion.rejectionReason = reason;

    return suggestion;
  }

  getSuggestions(status = null) {
    const suggestions = Array.from(this.suggestions.values());

    if (status) {
      return suggestions.filter(s => s.status === status);
    }

    return suggestions;
  }

  clearSuggestions(status = 'all') {
    if (status === 'all') {
      this.suggestions.clear();
    } else {
      for (const [id, suggestion] of this.suggestions.entries()) {
        if (suggestion.status === status) {
          this.suggestions.delete(id);
        }
      }
    }
  }

  // ========== Annotations ==========

  annotate(userId, index, length, text, type = 'comment') {
    const annotationId = ++this.annotationCounter;

    const annotation = {
      annotationId,
      userId,
      range: { index, length },
      text,
      type,
      createdAt: Date.now()
    };

    this.annotations.set(annotationId, annotation);

    return annotation;
  }

  getAnnotations(filterType = null) {
    const annotations = Array.from(this.annotations.values());

    if (filterType) {
      return annotations.filter(a => a.type === filterType);
    }

    return annotations;
  }

  deleteAnnotation(annotationId) {
    return this.annotations.delete(annotationId);
  }

  // ========== Transactions ==========

  beginTransaction(userId = 'system') {
    if (this.currentTransaction) {
      throw new Error('Transaction already in progress');
    }

    const transaction = {
      userId,
      startVersion: this.version,
      changes: [],
      startedAt: Date.now()
    };

    this.currentTransaction = transaction;
    this.transactionStack.push(transaction);

    return transaction;
  }

  commitTransaction() {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress');
    }

    const transaction = this.currentTransaction;
    transaction.committedAt = Date.now();
    transaction.endVersion = this.version;

    this.currentTransaction = null;

    return transaction;
  }

  rollbackTransaction() {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress');
    }

    const transaction = this.currentTransaction;

    // Revert changes (simplified - real OT would transform)
    // For now, we mark as rolled back
    transaction.rolledBack = true;
    transaction.rolledBackAt = Date.now();

    this.currentTransaction = null;

    // In a production system, you'd actually undo the changes
    console.warn('[OTDocument] Transaction rollback is simplified');

    return transaction;
  }

  // ========== Document Analysis ==========

  getStructure() {
    const delta = this.quill.getContents();
    const structure = {
      chapters: [],
      headings: [],
      paragraphs: 0
    };

    let currentIndex = 0;

    delta.ops.forEach(op => {
      if (op.insert) {
        // Count paragraphs
        const paragraphs = (op.insert.match(/\n/g) || []).length;
        structure.paragraphs += paragraphs;

        // Look for headings
        if (op.attributes && op.attributes.header) {
          structure.headings.push({
            level: op.attributes.header,
            text: op.insert,
            index: currentIndex
          });
        }

        currentIndex += op.insert.length;
      }
    });

    return structure;
  }

  getRangeText(index, length) {
    return this.quill.getText(index, length);
  }

  getContextAround(index, contextSize = 100) {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(this.quill.getLength(), index + contextSize);

    return {
      before: this.quill.getText(start, index - start),
      at: this.quill.getText(index, 1),
      after: this.quill.getText(index + 1, end - index - 1),
      range: { start, end }
    };
  }

  findPattern(pattern, options = {}) {
    const text = this.quill.getText();
    const regex = typeof pattern === 'string' ?
      new RegExp(pattern, options.flags || 'g') :
      pattern;

    const matches = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        index: match.index,
        length: match[0].length,
        groups: match.slice(1)
      });
    }

    return matches;
  }

  getMetadata() {
    return {
      documentId: this.documentId,
      version: this.version,
      length: this.quill.getLength(),
      activeUsers: this.getActiveUsers().length,
      pendingSuggestions: this.getSuggestions('pending').length,
      annotations: this.annotations.size,
      lastChange: this.changeLog.length > 0 ?
        this.changeLog[this.changeLog.length - 1] :
        null
    };
  }

  // ========== History ==========

  getHistory(limit = 50) {
    return this.changeLog.slice(-limit);
  }

  revertToVersion(targetVersion) {
    // Simplified reversion - in production would replay operations
    throw new Error('Version reversion not yet implemented in simplified OT');
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WoolfOTDocument };
}

if (typeof window !== 'undefined') {
  window.WoolfOTDocument = WoolfOTDocument;
}
