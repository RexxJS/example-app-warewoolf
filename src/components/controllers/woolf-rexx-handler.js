/**
 * WoolfRexxHandler - RexxJS Control Interface for WareWoolf
 *
 * Provides ADDRESS WOOLF commands for document manipulation via RexxJS
 * Based on the RexxJS control bus architecture
 * Enhanced with Operational Transform support for collaborative editing
 */

const { WoolfOTDocument } = require('./woolf-ot-document');

class WoolfRexxHandler {
  constructor(context) {
    this.context = context;
    this.debugLog = [];
    this.maxLogEntries = 100;

    // Initialize OT document wrapper
    this.otDoc = new WoolfOTDocument(context.editorQuill, context.documentId || 'default');
  }

  /**
   * Main command execution entry point
   * @param {string} command - The command name (e.g., "get-content", "set-content")
   * @param {object} params - Parameters for the command
   * @returns {Promise<any>} Command result
   */
  async run(command, params = {}) {
    const timestamp = new Date().toISOString();
    this.log(`[${timestamp}] ${command}`, params);

    try {
      const cmd = command.toLowerCase().trim();

      switch (cmd) {
        // Document commands
        case 'get-content':
          return await this.getContent(params);
        case 'set-content':
          return await this.setContent(params);
        case 'append':
          return await this.append(params);
        case 'insert':
          return await this.insert(params);

        // Chapter commands
        case 'list-chapters':
          return await this.listChapters(params);
        case 'add-chapter':
          return await this.addChapter(params);
        case 'delete-chapter':
          return await this.deleteChapter(params);
        case 'get-chapter':
          return await this.getChapter(params);
        case 'set-chapter-title':
          return await this.setChapterTitle(params);
        case 'go-to-chapter':
          return await this.goToChapter(params);

        // Search & Replace
        case 'find':
          return await this.find(params);
        case 'replace':
          return await this.replace(params);

        // Formatting
        case 'format-selection':
          return await this.formatSelection(params);

        // Statistics
        case 'get-word-count':
          return await this.getWordCount(params);
        case 'get-chapter-word-count':
          return await this.getChapterWordCount(params);

        // File operations
        case 'save-document':
          return await this.saveDocument(params);
        case 'open-document':
          return await this.openDocument(params);
        case 'new-document':
          return await this.newDocument(params);

        // Export
        case 'export-docx':
          return await this.exportDocx(params);
        case 'compile':
          return await this.compile(params);

        // Editor operations
        case 'undo':
          return await this.undo(params);
        case 'redo':
          return await this.redo(params);

        // Debug
        case 'get-debug-log':
          return this.getDebugLog();
        case 'clear-debug-log':
          return this.clearDebugLog();

        // ========== OT Version Control ==========
        case 'get-version':
          return await this.getVersion(params);
        case 'get-changes-since':
          return await this.getChangesSince(params);
        case 'subscribe-changes':
          return await this.subscribeChanges(params);
        case 'unsubscribe-changes':
          return await this.unsubscribeChanges(params);

        // ========== OT Cursor & Selection ==========
        case 'get-cursor':
          return await this.getCursor(params);
        case 'set-cursor':
          return await this.setCursor(params);
        case 'get-selection':
          return await this.getSelection(params);
        case 'set-selection':
          return await this.setSelection(params);
        case 'get-all-cursors':
          return await this.getAllCursors(params);

        // ========== OT Operations ==========
        case 'insert-at':
          return await this.insertAt(params);
        case 'delete-range':
          return await this.deleteRange(params);
        case 'replace-range':
          return await this.replaceRange(params);
        case 'apply-delta':
          return await this.applyDelta(params);

        // ========== Collaboration ==========
        case 'announce-presence':
          return await this.announcePresence(params);
        case 'get-active-users':
          return await this.getActiveUsers(params);
        case 'lock-range':
          return await this.lockRange(params);
        case 'unlock-range':
          return await this.unlockRange(params);

        // ========== Document Analysis ==========
        case 'get-structure':
          return await this.getStructure(params);
        case 'get-range-text':
          return await this.getRangeText(params);
        case 'get-context-around':
          return await this.getContextAround(params);
        case 'find-pattern':
          return await this.findPattern(params);
        case 'get-metadata':
          return await this.getMetadata(params);

        // ========== LLM Suggestions ==========
        case 'suggest-edit':
          return await this.suggestEdit(params);
        case 'accept-suggestion':
          return await this.acceptSuggestion(params);
        case 'reject-suggestion':
          return await this.rejectSuggestion(params);
        case 'get-suggestions':
          return await this.getSuggestions(params);
        case 'clear-suggestions':
          return await this.clearSuggestions(params);

        // ========== Annotations ==========
        case 'annotate-range':
          return await this.annotateRange(params);
        case 'get-annotations':
          return await this.getAnnotations(params);
        case 'delete-annotation':
          return await this.deleteAnnotation(params);

        // ========== Transactions ==========
        case 'begin-transaction':
          return await this.beginTransaction(params);
        case 'commit-transaction':
          return await this.commitTransaction(params);
        case 'rollback-transaction':
          return await this.rollbackTransaction(params);

        // ========== History ==========
        case 'get-history':
          return await this.getHistory(params);
        case 'revert-to-version':
          return await this.revertToVersion(params);

        // Quick correction commands
        case 'apply-quick-correction':
          return await this.applyQuickCorrection(params);
        case 'revert-correction':
          return await this.revertCorrection(params);
        case 'switch-to-alternate':
          return await this.switchToAlternate(params);
        case 'get-corrections':
          return await this.getCorrections(params);
        case 'get-correction-at':
          return await this.getCorrectionAt(params);

        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      this.log(`ERROR: ${error.message}`);
      throw error;
    }
  }

  // ========== Document Commands ==========

  async getContent(params) {
    const { editorQuill } = this.context;
    const delta = editorQuill.getContents();

    if (params.format === 'text' || params.format === 'plain') {
      return this.deltaToText(delta);
    }
    return delta;
  }

  async setContent(params) {
    const { editorQuill } = this.context;
    const text = params.text || params.content || '';

    editorQuill.setText(text);
    return { success: true, length: text.length };
  }

  async append(params) {
    const { editorQuill } = this.context;
    const text = params.text || params.content || '';
    const length = editorQuill.getLength();

    editorQuill.insertText(length, text);
    return { success: true, position: length };
  }

  async insert(params) {
    const { editorQuill } = this.context;
    const text = params.text || params.content || '';
    const position = parseInt(params.position || params.at || 0);

    editorQuill.insertText(position, text);
    return { success: true, position };
  }

  // ========== Chapter Commands ==========

  async listChapters(params) {
    const { project } = this.context;
    return project.chapters.map((chap, idx) => ({
      index: idx,
      title: chap.title,
      filename: chap.filename,
      summary: chap.summary
    }));
  }

  async addChapter(params) {
    const title = params.title || 'New Chapter';
    // Trigger the add-chapter event
    if (typeof this.context.onAddChapter === 'function') {
      await this.context.onAddChapter(title);
      return { success: true, title };
    }
    throw new Error('Add chapter function not available');
  }

  async deleteChapter(params) {
    const index = parseInt(params.number || params.index || params.id);
    if (typeof this.context.onDeleteChapter === 'function') {
      await this.context.onDeleteChapter(index);
      return { success: true, deleted: index };
    }
    throw new Error('Delete chapter function not available');
  }

  async getChapter(params) {
    const { project, editorQuill } = this.context;
    const index = parseInt(params.number || params.index || params.id);

    if (index < 0 || index >= project.chapters.length) {
      throw new Error(`Invalid chapter index: ${index}`);
    }

    const chapter = project.chapters[index];
    const contents = chapter.getContentsOrFile();

    if (params.format === 'text' || params.format === 'plain') {
      return {
        title: chapter.title,
        summary: chapter.summary,
        content: this.deltaToText(contents)
      };
    }

    return {
      title: chapter.title,
      summary: chapter.summary,
      content: contents
    };
  }

  async setChapterTitle(params) {
    const { project } = this.context;
    const index = parseInt(params.number || params.index || params.id);
    const title = params.title || 'Untitled';

    if (index < 0 || index >= project.chapters.length) {
      throw new Error(`Invalid chapter index: ${index}`);
    }

    project.chapters[index].title = title;
    if (typeof this.context.onUpdateChapterList === 'function') {
      this.context.onUpdateChapterList();
    }

    return { success: true, index, title };
  }

  async goToChapter(params) {
    const index = parseInt(params.number || params.index || params.id);
    if (typeof this.context.onGoToChapter === 'function') {
      await this.context.onGoToChapter(index);
      return { success: true, chapter: index };
    }
    throw new Error('Go to chapter function not available');
  }

  // ========== Search & Replace ==========

  async find(params) {
    const { editorQuill } = this.context;
    const searchText = params.text || params.search || '';
    const text = editorQuill.getText();
    const matches = [];

    let index = text.indexOf(searchText);
    while (index !== -1) {
      matches.push(index);
      index = text.indexOf(searchText, index + 1);
    }

    return {
      found: matches.length > 0,
      count: matches.length,
      positions: matches
    };
  }

  async replace(params) {
    const { editorQuill } = this.context;
    const search = params.search || params.find || '';
    const replaceWith = params['replace-with'] || params.replace || '';
    const text = editorQuill.getText();

    const newText = text.replaceAll(search, replaceWith);
    editorQuill.setText(newText);

    const count = (text.length - newText.length + replaceWith.length *
                   (text.split(search).length - 1)) / search.length;

    return { success: true, replacements: count };
  }

  // ========== Formatting ==========

  async formatSelection(params) {
    const { editorQuill } = this.context;
    const range = editorQuill.getSelection();

    if (!range) {
      throw new Error('No selection');
    }

    const formats = {};
    if (params.bold !== undefined) formats.bold = params.bold === 'true' || params.bold === true;
    if (params.italic !== undefined) formats.italic = params.italic === 'true' || params.italic === true;
    if (params.underline !== undefined) formats.underline = params.underline === 'true' || params.underline === true;
    if (params.strike !== undefined) formats.strike = params.strike === 'true' || params.strike === true;

    editorQuill.formatText(range.index, range.length, formats);
    return { success: true, range, formats };
  }

  // ========== Statistics ==========

  async getWordCount(params) {
    const { getTotalWordCount } = require('./wordcount');
    const { project } = this.context;

    return {
      total: getTotalWordCount(project),
      chapters: project.chapters.length
    };
  }

  async getChapterWordCount(params) {
    const { countWords } = require('./wordcount');
    const { project } = this.context;
    const index = parseInt(params.number || params.index || params.id);

    if (index < 0 || index >= project.chapters.length) {
      throw new Error(`Invalid chapter index: ${index}`);
    }

    const chapter = project.chapters[index];
    const contents = chapter.getContentsOrFile();
    const text = this.deltaToText(contents);

    return {
      chapter: index,
      title: chapter.title,
      words: countWords(text)
    };
  }

  // ========== File Operations ==========

  async saveDocument(params) {
    if (typeof this.context.onSave === 'function') {
      await this.context.onSave();
      return { success: true };
    }
    throw new Error('Save function not available');
  }

  async openDocument(params) {
    const path = params.path || params.file;
    if (!path) {
      throw new Error('Path parameter required');
    }

    if (typeof this.context.onOpen === 'function') {
      await this.context.onOpen(path);
      return { success: true, path };
    }
    throw new Error('Open function not available');
  }

  async newDocument(params) {
    const title = params.title || 'New Project';
    if (typeof this.context.onNewProject === 'function') {
      await this.context.onNewProject(title);
      return { success: true, title };
    }
    throw new Error('New project function not available');
  }

  // ========== Export ==========

  async exportDocx(params) {
    const output = params.output || params.path || params.file;
    if (typeof this.context.onExportDocx === 'function') {
      await this.context.onExportDocx(output);
      return { success: true, output };
    }
    throw new Error('Export DOCX function not available');
  }

  async compile(params) {
    if (typeof this.context.onCompile === 'function') {
      await this.context.onCompile(params);
      return { success: true };
    }
    throw new Error('Compile function not available');
  }

  // ========== Editor Operations ==========

  async undo(params) {
    const { editorQuill } = this.context;
    editorQuill.history.undo();
    return { success: true };
  }

  async redo(params) {
    const { editorQuill } = this.context;
    editorQuill.history.redo();
    return { success: true };
  }

  // ========== Debug ==========

  getDebugLog() {
    return this.debugLog.join('\n');
  }

  clearDebugLog() {
    this.debugLog = [];
    return { success: true };
  }

  // ========== OT Version Control Methods ==========

  async getVersion(params) {
    return this.otDoc.getVersion();
  }

  async getChangesSince(params) {
    const sinceVersion = parseInt(params.version || params.since || 0);
    return this.otDoc.getChangesSince(sinceVersion);
  }

  async subscribeChanges(params) {
    const callback = params.callback || ((change) => {
      console.log('[ChangeSubscription]', change);
    });

    const subscription = this.otDoc.subscribe(callback);
    return {
      success: true,
      subscriberId: subscription.subscriberId,
      message: 'Subscribed to document changes'
    };
  }

  async unsubscribeChanges(params) {
    const subscriberId = parseInt(params.subscriberId || params.id);
    const success = this.otDoc.unsubscribe(subscriberId);
    return { success };
  }

  // ========== OT Cursor & Selection Methods ==========

  async getCursor(params) {
    const userId = params.userId || params.user || 'system';
    const cursor = this.otDoc.getCursor(userId);
    return cursor || { userId, index: 0, length: 0 };
  }

  async setCursor(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || 0);
    return this.otDoc.setCursor(userId, index);
  }

  async getSelection(params) {
    const userId = params.userId || params.user || 'system';
    const selection = this.otDoc.getSelection(userId);
    return selection || { userId, index: 0, length: 0 };
  }

  async setSelection(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || 0);
    const length = parseInt(params.length || 0);
    return this.otDoc.setSelection(userId, index, length);
  }

  async getAllCursors(params) {
    return this.otDoc.getAllCursors();
  }

  // ========== OT Operations Methods ==========

  async insertAt(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || 0);
    const text = params.text || params.content || '';
    const attributes = params.attributes || {};

    return this.otDoc.insertAt(index, text, userId, attributes);
  }

  async deleteRange(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || params.start || 0);
    const length = parseInt(params.length || 1);

    return this.otDoc.deleteRange(index, length, userId);
  }

  async replaceRange(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || params.start || 0);
    const length = parseInt(params.length || 0);
    const text = params.text || params.newText || '';
    const attributes = params.attributes || {};

    return this.otDoc.replaceRange(index, length, text, userId, attributes);
  }

  async applyDelta(params) {
    const userId = params.userId || params.user || 'system';
    const delta = params.delta;

    if (!delta) {
      throw new Error('Delta parameter required');
    }

    return this.otDoc.applyDelta(delta, userId);
  }

  // ========== Collaboration Methods ==========

  async announcePresence(params) {
    const userId = params.userId || params.user || 'system';
    const userName = params.userName || params.name || userId;
    const userType = params.userType || params.type || 'human';

    return this.otDoc.announcePresence(userId, userName, userType);
  }

  async getActiveUsers(params) {
    const threshold = parseInt(params.threshold || 60000);
    return this.otDoc.getActiveUsers(threshold);
  }

  async lockRange(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || params.start || 0);
    const length = parseInt(params.length || 1);
    const duration = parseInt(params.duration || 60000);

    return this.otDoc.lockRange(userId, index, length, duration);
  }

  async unlockRange(params) {
    const userId = params.userId || params.user || 'system';
    const lockId = parseInt(params.lockId || params.id);

    return this.otDoc.unlockRange(lockId, userId);
  }

  // ========== Document Analysis Methods ==========

  async getStructure(params) {
    return this.otDoc.getStructure();
  }

  async getRangeText(params) {
    const index = parseInt(params.index || params.position || params.start || 0);
    const length = parseInt(params.length || 1);

    return {
      index,
      length,
      text: this.otDoc.getRangeText(index, length)
    };
  }

  async getContextAround(params) {
    const index = parseInt(params.index || params.position || 0);
    const contextSize = parseInt(params.contextSize || params.size || 100);

    return this.otDoc.getContextAround(index, contextSize);
  }

  async findPattern(params) {
    const pattern = params.pattern || params.regex;
    const flags = params.flags || 'g';

    if (!pattern) {
      throw new Error('Pattern parameter required');
    }

    const options = { flags };
    return this.otDoc.findPattern(pattern, options);
  }

  async getMetadata(params) {
    return this.otDoc.getMetadata();
  }

  // ========== LLM Suggestion Methods ==========

  async suggestEdit(params) {
    const userId = params.userId || params.user || 'llm-assistant';
    const index = parseInt(params.index || params.position || params.start || 0);
    const length = parseInt(params.length || 0);
    const newText = params.newText || params.text || '';
    const metadata = params.metadata || {};

    return this.otDoc.suggestEdit(userId, index, length, newText, metadata);
  }

  async acceptSuggestion(params) {
    const suggestionId = parseInt(params.suggestionId || params.id);
    const userId = params.userId || params.user || 'system';

    if (!suggestionId) {
      throw new Error('Suggestion ID required');
    }

    return this.otDoc.acceptSuggestion(suggestionId, userId);
  }

  async rejectSuggestion(params) {
    const suggestionId = parseInt(params.suggestionId || params.id);
    const userId = params.userId || params.user || 'system';
    const reason = params.reason || '';

    if (!suggestionId) {
      throw new Error('Suggestion ID required');
    }

    return this.otDoc.rejectSuggestion(suggestionId, userId, reason);
  }

  async getSuggestions(params) {
    const status = params.status || null;
    return this.otDoc.getSuggestions(status);
  }

  async clearSuggestions(params) {
    const status = params.status || 'all';
    this.otDoc.clearSuggestions(status);
    return { success: true, status };
  }

  // ========== Annotation Methods ==========

  async annotateRange(params) {
    const userId = params.userId || params.user || 'system';
    const index = parseInt(params.index || params.position || params.start || 0);
    const length = parseInt(params.length || 1);
    const text = params.text || params.comment || '';
    const type = params.type || 'comment';

    return this.otDoc.annotate(userId, index, length, text, type);
  }

  async getAnnotations(params) {
    const type = params.type || null;
    return this.otDoc.getAnnotations(type);
  }

  async deleteAnnotation(params) {
    const annotationId = parseInt(params.annotationId || params.id);

    if (!annotationId) {
      throw new Error('Annotation ID required');
    }

    const success = this.otDoc.deleteAnnotation(annotationId);
    return { success };
  }

  // ========== Transaction Methods ==========

  async beginTransaction(params) {
    const userId = params.userId || params.user || 'system';
    return this.otDoc.beginTransaction(userId);
  }

  async commitTransaction(params) {
    return this.otDoc.commitTransaction();
  }

  async rollbackTransaction(params) {
    return this.otDoc.rollbackTransaction();
  }

  // ========== History Methods ==========

  async getHistory(params) {
    const limit = parseInt(params.limit || 50);
    return this.otDoc.getHistory(limit);
  }

  async revertToVersion(params) {
    const version = parseInt(params.version);

    if (isNaN(version)) {
      throw new Error('Version parameter required');
    }

    return this.otDoc.revertToVersion(version);
  }

  // ========== Quick Correction Commands ==========

  async applyQuickCorrection(params) {
    const userId = params['user-id'];
    const index = parseInt(params.index);
    const length = parseInt(params.length);
    const original = params.original;
    const correction = params.correction;
    const alternatesParam = params.alternates;

    if (!userId || isNaN(index) || isNaN(length) || !original || !correction) {
      throw new Error('Required parameters: user-id, index, length, original, correction');
    }

    // Parse alternates (can be JSON array or comma-separated string)
    let alternates = [];
    if (alternatesParam) {
      if (typeof alternatesParam === 'string') {
        try {
          alternates = JSON.parse(alternatesParam);
        } catch (e) {
          // Try comma-separated
          alternates = alternatesParam.split(',').map(s => s.trim());
        }
      } else if (Array.isArray(alternatesParam)) {
        alternates = alternatesParam;
      }
    }

    // Build metadata
    const metadata = {};
    if (params.confidence) {
      metadata.confidence = parseFloat(params.confidence);
    }
    if (params.type) {
      metadata.type = params.type;
    }
    if (params.reasoning) {
      metadata.reasoning = params.reasoning;
    }

    // Parse alternate confidences (optional)
    if (params['alternate-confidences']) {
      const altConfsParam = params['alternate-confidences'];
      let altConfs = [];

      if (typeof altConfsParam === 'string') {
        try {
          altConfs = JSON.parse(altConfsParam);
        } catch (e) {
          // Try comma-separated
          altConfs = altConfsParam.split(',').map(s => parseFloat(s.trim()));
        }
      } else if (Array.isArray(altConfsParam)) {
        altConfs = altConfsParam.map(c => parseFloat(c));
      }

      metadata.alternateConfidences = altConfs;
    }

    return this.otDoc.applyQuickCorrection(
      userId,
      index,
      length,
      original,
      correction,
      alternates,
      metadata
    );
  }

  async revertCorrection(params) {
    const correctionId = parseInt(params['correction-id']);
    const userId = params['user-id'];

    if (isNaN(correctionId) || !userId) {
      throw new Error('Required parameters: correction-id, user-id');
    }

    return this.otDoc.revertCorrection(correctionId, userId);
  }

  async switchToAlternate(params) {
    const correctionId = parseInt(params['correction-id']);
    const alternateIndex = parseInt(params['alternate-index']);
    const userId = params['user-id'];

    if (isNaN(correctionId) || isNaN(alternateIndex) || !userId) {
      throw new Error('Required parameters: correction-id, alternate-index, user-id');
    }

    return this.otDoc.switchToAlternate(correctionId, alternateIndex, userId);
  }

  async getCorrections(params) {
    const filters = {};

    if (params['user-id']) {
      filters.userId = params['user-id'];
    }

    if (params.reverted !== undefined) {
      filters.reverted = params.reverted === 'true' || params.reverted === true;
    }

    const corrections = this.otDoc.getCorrections(filters);

    return {
      corrections,
      count: corrections.length
    };
  }

  async getCorrectionAt(params) {
    const index = parseInt(params.index);

    if (isNaN(index)) {
      throw new Error('Index parameter required');
    }

    const correction = this.otDoc.getCorrectionAt(index);

    return {
      correction,
      found: correction !== null
    };
  }

  // ========== Utilities ==========

  log(message, data = null) {
    const entry = data ? `${message} ${JSON.stringify(data)}` : message;
    this.debugLog.push(entry);

    if (this.debugLog.length > this.maxLogEntries) {
      this.debugLog.shift();
    }

    console.log('[WoolfRexx]', entry);
  }

  deltaToText(delta) {
    if (!delta || !delta.ops) return '';
    let text = '';
    delta.ops.forEach(op => {
      if (op.insert) {
        text += op.insert;
      }
    });
    return text;
  }
}

/**
 * Setup RexxJS control interface
 * @param {object} context - Application context with editorQuill, project, and handlers
 */
function setupRexxJSControl(context) {
  const handler = new WoolfRexxHandler(context);

  // Make it globally available for RexxJS
  window.ADDRESS_WOOLF = {
    run: handler.run.bind(handler)
  };

  console.log('[WareWoolf] RexxJS control interface initialized');
  return handler;
}

module.exports = {
  WoolfRexxHandler,
  setupRexxJSControl
};
