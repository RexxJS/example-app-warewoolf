# WareWoolf RexxJS Integration TODO

## Project Overview
Converting WareWoolf (fiction/novel writing system, Electron-based) to support RexxJS scripting via:
1. Tauri migration or Electron wrapping
2. In-app RexxJS executor
3. Control bus (iframe-based)
4. Comprehensive test suite

**Complexity**: HIGH - 1800 lines, Electron desktop app, complex document model (Quill editor, DOCX export), native menus and file dialogs
**Tech Stack**: Electron, Quill editor, archiver (ZIP), docx (Word format), nspell (spell checking)

## Implementation Phases

### Phase 1: Electron vs. Tauri Decision ⚠️ DECISION REQUIRED
- [ ] Evaluate migration effort: Electron → Tauri
  - **STATUS**: Moderate complexity
  - **Dependencies on Electron**:
    - Native file dialogs (saveFile, openFile)
    - Native menus (File, Edit, Help)
    - Auto-updater (Squirrel)
    - App icons and installer generation
    - Platform-specific handlers
  - **TODO**: Determine if full Tauri rewrite or Electron wrapper
  - Check if Tauri can replicate file dialogs and native menus
  - Assess effort: Keep Electron as-is vs. Migrate to Tauri

- [ ] Decision Branch A: Keep Electron, Add RexxJS
  - Faster path (~2-3 days)
  - Minimal changes to existing codebase
  - Leverage existing Electron architecture
  - **Recommend if**: Team wants fastest delivery

- [ ] Decision Branch B: Migrate to Tauri
  - Longer timeline (~4-5 days)
  - Modernize tech stack
  - Smaller app footprint, faster startup
  - **Recommend if**: Team wants long-term sustainability

### Phase 2: RexxJS Document Manipulation API
Define meaningful writing/editing commands (based on chosen architecture):

```rexx
ADDRESS WOOLF "new-document title=MyNovel"
ADDRESS WOOLF "get-content"
ADDRESS WOOLF "set-content text=Story content here"
ADDRESS WOOLF "append text=More text"
ADDRESS WOOLF "get-word-count"
ADDRESS WOOLF "find text=SearchTerm"
ADDRESS WOOLF "replace search=OldText replace-with=NewText"
ADDRESS WOOLF "format-selection bold=true italic=false"
ADDRESS WOOLF "set-font-size size=14"
ADDRESS WOOLF "list-chapters"
ADDRESS WOOLF "add-chapter title=Chapter1"
ADDRESS WOOLF "delete-chapter number=2"
ADDRESS WOOLF "export-docx output=/path/document.docx"
ADDRESS WOOLF "export-pdf output=/path/document.pdf"
ADDRESS WOOLF "spell-check"
ADDRESS WOOLF "undo"
ADDRESS WOOLF "redo"
ADDRESS WOOLF "save-document"
ADDRESS WOOLF "open-document path=/path/story.docx"
```

- [ ] Create `woolf-rexx-handler.js`
  - Expose document CRUD operations
  - Text manipulation (insert, delete, find/replace)
  - Formatting control
  - Chapter management
  - Export capabilities
  - Coordinate with Quill editor
  - Handle document state persistence

### Phase 3: In-App Execution
- [ ] Add RexxJS bundle to app resources
- [ ] Integrate with Quill editor instance
  - RexxJS commands manipulate Quill Delta
  - Track document state changes
  - Coordinate with existing save/load
- [ ] Create execute-rexx command handler
- [ ] Test with sample document generation scripts

### Phase 4: Control Bus (Iframe)
- [ ] Create woolf-controlbus.js bridge
  - WoolfWorkerBridge for app frame
  - WoolfDirectorBridge for script frame
  - postMessage RPC for document operations
- [ ] Create woolf-controlbus-demo.html
  - Split view: script editor (left), document preview (right)
  - Real-time document updates
  - Word count and statistics display
- [ ] Verify document updates sync across iframe boundary

### Phase 5: Test Suite

#### A. Jest/Embedded Rexx Tests (20-25 tests)
- [ ] Document creation and deletion
- [ ] Text manipulation (insert, append, find, replace)
- [ ] Formatting operations
- [ ] Chapter management
- [ ] Word count and statistics
- [ ] File I/O (save, open, export)
- [ ] Command parsing and validation
- [ ] Quill editor integration

#### B. Playwright Tests (30-40 tests)
- [ ] In-app execution tests
  - Create new documents in sequence
  - Insert text at various positions
  - Find and replace operations
  - Format text (bold, italic, etc.)
  - Chapter operations
  - Word count tracking
  - Export to DOCX and PDF
  - Large document handling (10,000+ words)

- [ ] Iframe control bus tests
  - Distributed document creation and editing
  - Real-time preview updates
  - Chapter manipulation
  - Export from script
  - Collaborative editing simulation (multiple scripts)
  - Spell check integration
  - Document state recovery
  - Error handling (invalid chapters, file not found)

### Phase 6: Documentation
- [ ] Create WOOLF_COMMANDS.md with all available commands
- [ ] Example scripts:
  - Batch novel writer (generate chapters from outline)
  - Word count analyzer
  - Find and replace batch processor
  - Export automation (DOCX + PDF)
  - Story generator (template-based)
- [ ] Integration guide (Electron or Tauri)
- [ ] Performance notes for large documents

## Design Considerations

1. **Document Model**: Quill uses Delta format
   - Understand Delta structure (ops array with inserts/retains/deletes)
   - RexxJS commands translate to Delta operations
   - Maintain formatting consistency

2. **File I/O**: DOCX, PDF, and plain text
   - Use existing docx library for Word export
   - Consider headless render for PDF (puppeteer or similar)
   - Handle encoding (UTF-8 for text, DOCX binary)
   - Validate file paths (security)

3. **Chapter Management**: Document structure
   - Chapters may be stored as sections or markers
   - Need clear chapter boundary definition
   - Track chapter order and content separately
   - Support renumbering

4. **Spell Check**: nspell library (off-line spell checking)
   - Integrate spell check results into RexxJS
   - Return misspelled words and suggestions
   - Update dictionary if needed

5. **Performance**: Large documents (50,000+ words)
   - Avoid blocking operations
   - Consider Web Worker for heavy text processing
   - Lazy-load chapters in control-bus mode
   - Progress reporting for exports

6. **Electron-Specific** (if keeping Electron):
   - File dialogs return native file paths
   - Menu events trigger RexxJS handlers
   - App events (ready, window-all-closed) coordinate with scripts

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Electron vs. Tauri decision delays start | High | High | **DECISION NEEDED IMMEDIATELY** |
| Quill Delta format complexity | Medium | Medium | Early tests with Delta operations |
| File format encoding issues (DOCX/PDF) | Medium | Medium | Validate with real Word files |
| Large document performance | Medium | Medium | Implement lazy loading if needed |
| Spell check integration overhead | Low | Low | Test with 100K+ word documents |
| Breaking existing Electron menus | Medium | High | Careful integration, duplicate existing functionality |

## Success Criteria

- [ ] 15+ document manipulation commands work via ADDRESS WOOLF
- [ ] 40+ playwright tests passing
- [ ] Sample script can generate multi-chapter novel with formatting
- [ ] Control bus demo shows live document preview
- [ ] Export to DOCX and PDF with correct formatting
- [ ] Large documents (50K+ words) perform acceptably
- [ ] No regression in existing Electron app functionality

## Recommended Approach

**Option A (Faster)**: Extend Electron
1. Add RexxJS support directly to existing Electron app
2. Use native file dialogs for export paths
3. Keep existing menu system
4. Timeline: 2-3 days
5. **Recommend if**: Quick time-to-market is priority

**Option B (Future-Proof)**: Migrate to Tauri
1. Rewrite file dialog interactions for Tauri
2. Implement custom menus or use Tauri defaults
3. Modernize build system
4. Timeline: 4-5 days
5. **Recommend if**: Long-term maintenance and smaller footprint matter

## Notes

- **Complexity**: HIGH - Most complex app for desktop framework choice
- **Timeline**: 2-3 days (Electron) or 4-5 days (Tauri)
- **Critical Decision**: Electron vs. Tauri must be made in Phase 1
- **Reusable Patterns**: Photo-editor command handler pattern applies
- **Testing Investment**: HIGH - need extensive tests for document integrity
- **Priority**: Medium-High - Large audience for writing software
- **Quill Integration**: Learning curve for Delta format operations
- **Asset Handling**: DOCX is ZIP archive with XML; PDF requires external tool
