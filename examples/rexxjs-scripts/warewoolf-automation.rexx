/* WareWoolf Automation Script
 * Demonstrates automated document manipulation using RexxJS
 * Similar to the calculator automation pattern from RexxJS examples
 *
 * This script can be run via the control bus to automate
 * document creation, editing, and analysis tasks.
 */

say "=========================================="
say "  WAREWOOLF AUTOMATION SCRIPT"
say "=========================================="
say ""

/* Part 1: Document Setup */
say "Part 1: Setting up document..."

/* Use INTERPRET_JS to check current state (like calculator reading display) */
current_content = INTERPRET_JS("document.querySelector('.ql-editor').textContent")
say "Current content length:" length(current_content) "characters"

/* Create a new document via ADDRESS WOOLF */
ADDRESS WOOLF "set-content text=Chapter 1"
say "✓ Document initialized"
say ""

/* Part 2: Content Generation */
say "Part 2: Generating content..."

/* Build a story paragraph by paragraph */
paragraphs.1 = "It was a dark and stormy night."
paragraphs.2 = "The wind howled through the trees."
paragraphs.3 = "Inside the old mansion, a single candle flickered."
paragraphs.4 = "She knew she was not alone."

do i = 1 to 4
  ADDRESS WOOLF "append text=" || paragraphs.i
  say "  Added paragraph" i
end

say "✓ Content generated"
say ""

/* Part 3: Word Count Analysis */
say "Part 3: Analyzing document..."

ADDRESS WOOLF "get-word-count"
stats = rc
say "  Total words:" stats.total
say "  Chapters:" stats.chapters

/* Calculate average using INTERPRET_JS */
if stats.chapters > 0 then do
  avg = stats.total / stats.chapters
  say "  Average words per chapter:" avg
end

say "✓ Analysis complete"
say ""

/* Part 4: Search and Replace */
say "Part 4: Performing search and replace..."

/* Find all occurrences of a word */
ADDRESS WOOLF "find text=dark"
find_result = rc

if find_result.found then do
  say "  Found" find_result.count "occurrence(s) of 'dark'"

  /* Replace with another word */
  ADDRESS WOOLF "replace search=dark replace-with=mysterious"
  say "  ✓ Replaced 'dark' with 'mysterious'"
end
else
  say "  No occurrences found"

say ""

/* Part 5: Chapter Management */
say "Part 5: Managing chapters..."

/* Add a new chapter */
ADDRESS WOOLF "add-chapter title=Chapter 2: The Discovery"
say "  ✓ Added new chapter"

/* List all chapters */
ADDRESS WOOLF "list-chapters"
chapters = rc

say "  Chapters in document:"
do i = 0 to chapters.length - 1
  chapter = chapters[i]
  say "    " || (i + 1) || "." chapter.title
end

say ""

/* Part 6: Using INTERPRET_JS for DOM inspection */
say "Part 6: Inspecting document structure..."

/* Get editor dimensions (like calculator getting button positions) */
editor_height = INTERPRET_JS("document.querySelector('.ql-editor').offsetHeight")
editor_width = INTERPRET_JS("document.querySelector('.ql-editor').offsetWidth")

say "  Editor dimensions:" editor_width "x" editor_height "px"

/* Check if editor has focus */
has_focus = INTERPRET_JS("document.activeElement.classList.contains('ql-editor')")
say "  Editor has focus:" has_focus

say ""

/* Part 7: Batch Operations */
say "Part 7: Batch operations..."

/* Create multiple chapters from outline */
outline.1 = "Chapter 3: The Investigation"
outline.2 = "Chapter 4: The Revelation"
outline.3 = "Chapter 5: The Confrontation"

say "  Creating chapters from outline..."
do i = 1 to 3
  ADDRESS WOOLF "add-chapter title=" || outline.i
  say "    ✓" outline.i
end

/* Get updated stats */
ADDRESS WOOLF "get-word-count"
final_stats = rc

say ""
say "  Final statistics:"
say "    Chapters:" final_stats.chapters
say "    Total words:" final_stats.total

say ""

/* Part 8: JSON-RPC Style Call (alternative protocol) */
say "Part 8: Using JSON-RPC protocol..."

/* The control bus also supports JSON-RPC 2.0 calls */
/* This would be done via the rpc() method on DirectorBridge */
/* Example: director.rpc('get-content', { format: 'text' }) */

say "  JSON-RPC protocol available for integration"
say ""

/* Part 9: Save Document */
say "Part 9: Saving work..."

ADDRESS WOOLF "save-document"
say "  ✓ Document saved"
say ""

/* Final Report */
say "=========================================="
say "  AUTOMATION COMPLETE"
say "=========================================="
say ""
say "Summary:"
say "  - Created and populated document"
say "  - Performed search and replace"
say "  - Added" final_stats.chapters "chapters"
say "  - Generated" final_stats.total "words"
say "  - Saved document"
say ""
say "This automation can be extended with:"
say "  - More complex text generation"
say "  - Formatting operations"
say "  - Export to multiple formats"
say "  - Batch processing multiple documents"
say ""
say "=========================================="
