# WareWoolf RexxJS Command Reference

## Overview

WareWoolf now supports scripting via RexxJS through the `ADDRESS WOOLF` interface. This allows you to automate document manipulation, chapter management, search/replace operations, and more.

## Getting Started

### Basic Syntax

```rexx
ADDRESS WOOLF "command parameter=value another=value"
```

The result of each command is stored in the special variable `rc` (return code).

### Example

```rexx
/* Get word count */
ADDRESS WOOLF "get-word-count"
say "Total words:" rc
```

## Available Commands

### Document Operations

#### `get-content`
Get the current document content.

**Parameters:**
- `format` (optional): `"text"` or `"plain"` for plain text, omit for Quill Delta format

**Returns:** Document content as text or Delta object

**Example:**
```rexx
ADDRESS WOOLF "get-content format=text"
content = rc
say "Current content:" content
```

#### `set-content`
Replace the entire document content.

**Parameters:**
- `text`: The new content

**Returns:** `{ success: true, length: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "set-content text=This is the new document content."
say "Content updated"
```

#### `append`
Append text to the end of the document.

**Parameters:**
- `text`: The text to append

**Returns:** `{ success: true, position: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "append text=This text will be added to the end."
say "Text appended at position" rc.position
```

#### `insert`
Insert text at a specific position.

**Parameters:**
- `text`: The text to insert
- `position` or `at`: The position (character index)

**Returns:** `{ success: true, position: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "insert text=Inserted text position=100"
say "Text inserted"
```

---

### Chapter Management

#### `list-chapters`
Get a list of all chapters in the project.

**Returns:** Array of chapter objects with `index`, `title`, `filename`, and `summary`

**Example:**
```rexx
ADDRESS WOOLF "list-chapters"
chapters = rc
say "Found" chapters.length "chapters"
```

#### `add-chapter`
Add a new chapter to the project.

**Parameters:**
- `title` (optional): The chapter title (default: "New Chapter")

**Returns:** `{ success: true, title: <string> }`

**Example:**
```rexx
ADDRESS WOOLF "add-chapter title=Chapter 5: The Discovery"
say "Chapter added:" rc.title
```

#### `delete-chapter`
Delete a chapter by index.

**Parameters:**
- `number`, `index`, or `id`: The chapter index (0-based)

**Returns:** `{ success: true, deleted: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "delete-chapter number=2"
say "Deleted chapter" rc.deleted
```

#### `get-chapter`
Get the content and metadata of a specific chapter.

**Parameters:**
- `number`, `index`, or `id`: The chapter index (0-based)
- `format` (optional): `"text"` for plain text

**Returns:** Object with `title`, `summary`, and `content`

**Example:**
```rexx
ADDRESS WOOLF "get-chapter number=0 format=text"
chapter = rc
say "Chapter:" chapter.title
say "Content:" chapter.content
```

#### `set-chapter-title`
Change the title of a chapter.

**Parameters:**
- `number`, `index`, or `id`: The chapter index (0-based)
- `title`: The new title

**Returns:** `{ success: true, index: <number>, title: <string> }`

**Example:**
```rexx
ADDRESS WOOLF "set-chapter-title number=0 title=Prologue"
say "Chapter renamed to:" rc.title
```

#### `go-to-chapter`
Navigate to a specific chapter in the editor.

**Parameters:**
- `number`, `index`, or `id`: The chapter index (0-based)

**Returns:** `{ success: true, chapter: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "go-to-chapter number=3"
say "Navigated to chapter" rc.chapter
```

---

### Search & Replace

#### `find`
Search for text in the current document.

**Parameters:**
- `text` or `search`: The text to search for

**Returns:** `{ found: <boolean>, count: <number>, positions: [<array of indices>] }`

**Example:**
```rexx
ADDRESS WOOLF "find text=dragon"
result = rc
if result.found then
  say "Found" result.count "occurrences"
else
  say "Text not found"
```

#### `replace`
Find and replace text in the current document.

**Parameters:**
- `search` or `find`: The text to find
- `replace-with` or `replace`: The replacement text

**Returns:** `{ success: true, replacements: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "replace search=old replace-with=new"
say "Made" rc.replacements "replacements"
```

---

### Formatting

#### `format-selection`
Apply formatting to the currently selected text.

**Parameters:**
- `bold`: `"true"` or `"false"`
- `italic`: `"true"` or `"false"`
- `underline`: `"true"` or `"false"`
- `strike`: `"true"` or `"false"`

**Returns:** `{ success: true, range: <object>, formats: <object> }`

**Example:**
```rexx
ADDRESS WOOLF "format-selection bold=true italic=true"
say "Text formatted"
```

---

### Statistics

#### `get-word-count`
Get the total word count for the entire project.

**Returns:** `{ total: <number>, chapters: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "get-word-count"
stats = rc
say "Total words:" stats.total "across" stats.chapters "chapters"
```

#### `get-chapter-word-count`
Get the word count for a specific chapter.

**Parameters:**
- `number`, `index`, or `id`: The chapter index (0-based)

**Returns:** `{ chapter: <number>, title: <string>, words: <number> }`

**Example:**
```rexx
ADDRESS WOOLF "get-chapter-word-count number=0"
stats = rc
say "Chapter" stats.title "has" stats.words "words"
```

---

### File Operations

#### `save-document`
Save the current project.

**Returns:** `{ success: true }`

**Example:**
```rexx
ADDRESS WOOLF "save-document"
say "Project saved"
```

#### `open-document`
Open a project file.

**Parameters:**
- `path` or `file`: The file path

**Returns:** `{ success: true, path: <string> }`

**Example:**
```rexx
ADDRESS WOOLF "open-document path=/path/to/project.woolf"
say "Opened" rc.path
```

#### `new-document`
Create a new project.

**Parameters:**
- `title` (optional): The project title (default: "New Project")

**Returns:** `{ success: true, title: <string> }`

**Example:**
```rexx
ADDRESS WOOLF "new-document title=My Novel"
say "Created project:" rc.title
```

---

### Export

#### `export-docx`
Export the project as a DOCX file.

**Parameters:**
- `output`, `path`, or `file`: The output file path

**Returns:** `{ success: true, output: <string> }`

**Example:**
```rexx
ADDRESS WOOLF "export-docx output=/path/to/output.docx"
say "Exported to" rc.output
```

#### `compile`
Open the compile dialog.

**Returns:** `{ success: true }`

**Example:**
```rexx
ADDRESS WOOLF "compile"
say "Compile dialog opened"
```

---

### Editor Operations

#### `undo`
Undo the last change.

**Returns:** `{ success: true }`

**Example:**
```rexx
ADDRESS WOOLF "undo"
say "Undo performed"
```

#### `redo`
Redo the last undone change.

**Returns:** `{ success: true }`

**Example:**
```rexx
ADDRESS WOOLF "redo"
say "Redo performed"
```

---

### Debug

#### `get-debug-log`
Get the command execution log.

**Returns:** String containing the debug log

**Example:**
```rexx
ADDRESS WOOLF "get-debug-log"
say rc
```

#### `clear-debug-log`
Clear the command execution log.

**Returns:** `{ success: true }`

**Example:**
```rexx
ADDRESS WOOLF "clear-debug-log"
say "Log cleared"
```

---

## Complete Examples

### Example 1: Batch Chapter Creation

```rexx
/* Create multiple chapters from an outline */

chapters.1 = "Chapter 1: The Beginning"
chapters.2 = "Chapter 2: Rising Action"
chapters.3 = "Chapter 3: The Climax"
chapters.4 = "Chapter 4: Falling Action"
chapters.5 = "Chapter 5: Resolution"

do i = 1 to 5
  ADDRESS WOOLF "add-chapter title=" || chapters.i
  say "Created:" chapters.i
end

say "All chapters created successfully"
```

### Example 2: Word Count Report

```rexx
/* Generate a word count report for all chapters */

ADDRESS WOOLF "list-chapters"
chapters = rc

say "WORD COUNT REPORT"
say "================="

total = 0
do i = 0 to chapters.length - 1
  ADDRESS WOOLF "get-chapter-word-count number=" || i
  stats = rc
  say stats.title ":" stats.words "words"
  total = total + stats.words
end

say "================="
say "TOTAL:" total "words"
```

### Example 3: Find and Replace Workflow

```rexx
/* Find all occurrences and replace with confirmation */

search_term = "dragon"
replace_term = "wyrm"

ADDRESS WOOLF "find text=" || search_term
result = rc

if result.found then do
  say "Found" result.count "occurrences of '" || search_term || "'"
  say "Replacing with '" || replace_term || "'"

  ADDRESS WOOLF "replace search=" || search_term " replace-with=" || replace_term
  say "Replaced" rc.replacements "occurrences"

  ADDRESS WOOLF "save-document"
  say "Changes saved"
end
else
  say "Search term not found"
```

### Example 4: Chapter Statistics

```rexx
/* Analyze chapter lengths and identify outliers */

ADDRESS WOOLF "list-chapters"
chapters = rc

say "CHAPTER ANALYSIS"
say "================"

total = 0
max_words = 0
min_words = 999999
max_chapter = ""
min_chapter = ""

do i = 0 to chapters.length - 1
  ADDRESS WOOLF "get-chapter-word-count number=" || i
  stats = rc

  words = stats.words
  total = total + words

  if words > max_words then do
    max_words = words
    max_chapter = stats.title
  end

  if words < min_words then do
    min_words = words
    min_chapter = stats.title
  end
end

average = total / chapters.length

say "Average chapter length:" average "words"
say "Longest chapter:" max_chapter "(" || max_words "words)"
say "Shortest chapter:" min_chapter "(" || min_words "words)"
```

### Example 5: Automated Formatting

```rexx
/* Apply consistent formatting to chapter titles */

ADDRESS WOOLF "list-chapters"
chapters = rc

do i = 0 to chapters.length - 1
  chapter = chapters[i]

  /* Go to chapter */
  ADDRESS WOOLF "go-to-chapter number=" || i

  /* Replace chapter-specific terms */
  ADDRESS WOOLF "replace search=TODO replace-with=✓"

  say "Processed chapter:" chapter.title
end

ADDRESS WOOLF "save-document"
say "All chapters formatted and saved"
```

---

## Control Bus Usage

For iframe-based control (e.g., from the demo page), use the `WoolfDirectorBridge`:

```javascript
// In your control script
const director = new WoolfDirectorBridge(parentWindow);

// Execute commands
const result = await director.run('get-word-count');
console.log('Word count:', result.total);

const chapters = await director.run('list-chapters');
console.log('Chapters:', chapters);
```

---

## Error Handling

All commands can throw errors. Use try/catch in JavaScript or check return codes in REXX:

```rexx
/* REXX error handling */
ADDRESS WOOLF "get-chapter number=999"
if rc.error then
  say "Error:" rc.error
else
  say "Success:" rc
```

```javascript
// JavaScript error handling
try {
  const result = await director.run('invalid-command');
} catch (error) {
  console.error('Command failed:', error.message);
}
```

---

## Tips & Best Practices

1. **Always save before major operations**: Use `save-document` before bulk changes
2. **Test with small data first**: Try commands on test chapters before running on your entire novel
3. **Use the debug log**: Check `get-debug-log` to troubleshoot command execution
4. **Chapter indices are 0-based**: First chapter is 0, not 1
5. **Parameter format**: Use `key=value` format without spaces around the `=`

---

## Troubleshooting

### Command not recognized
- Check spelling and case (commands are case-insensitive but parameters are case-sensitive)
- Ensure the command name is correct (see list above)

### Parameters not working
- Use `key=value` format without spaces
- Quote strings with special characters
- Check parameter names match documentation

### No response from command
- Check the debug log: `ADDRESS WOOLF "get-debug-log"`
- Verify the control bus is connected
- Check browser console for JavaScript errors

---

## Integration Notes

### Electron Integration
WareWoolf's Electron app automatically loads RexxJS and sets up the ADDRESS WOOLF interface on startup.

### Control Bus
The control bus allows external pages (via iframe) to send commands to WareWoolf using postMessage. See `woolf-controlbus-demo.html` for a working example.

### Architecture
- **woolf-rexx-handler.js**: Main command handler
- **woolf-controlbus.js**: iframe communication bridge
- **render.js**: Integration with WareWoolf's main application

---

## Contributing

To add new commands:

1. Add the command case to `woolf-rexx-handler.js` switch statement
2. Implement the command method
3. Update this documentation
4. Add example usage
5. Test thoroughly

---

## License

This RexxJS integration is part of WareWoolf and shares its MIT license.
