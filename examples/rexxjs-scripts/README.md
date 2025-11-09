# WareWoolf RexxJS Example Scripts

This directory contains example RexxJS scripts that demonstrate how to use the ADDRESS WOOLF interface to automate tasks in WareWoolf.

## Available Scripts

### 1. simple-word-count.rexx
**Purpose:** Get total word count and basic statistics

**Usage:**
```rexx
/* Run in RexxJS console or via control bus */
call "simple-word-count.rexx"
```

**What it does:**
- Gets total word count
- Shows number of chapters
- Calculates average words per chapter

---

### 2. word-count-report.rexx
**Purpose:** Generate a detailed word count report

**What it does:**
- Shows total word count and chapter count
- Lists each chapter with its word count
- Calculates percentage of total for each chapter
- Flags chapters that are unusually short or long

---

### 3. batch-chapter-creator.rexx
**Purpose:** Create multiple chapters at once from an outline

**What it does:**
- Reads a predefined list of chapter titles
- Creates each chapter automatically
- Reports success/failure for each

**Customization:**
Edit the chapter titles in the script:
```rexx
chapters.1 = "Your Chapter Title"
chapters.2 = "Another Chapter"
```

---

### 4. find-and-replace.rexx
**Purpose:** Find and replace text with confirmation

**What it does:**
- Searches for a specific term
- Shows how many occurrences were found
- Replaces all occurrences
- Saves the document

**Customization:**
Edit the search and replace terms:
```rexx
search_term = "old_name"
replace_term = "new_name"
```

---

### 5. chapter-statistics.rexx
**Purpose:** Advanced statistical analysis of chapter lengths

**What it does:**
- Calculates total, average, and standard deviation
- Identifies longest and shortest chapters
- Detects outlier chapters (unusually long/short)
- Shows detailed deviation from average

---

## Running Scripts

### Method 1: Control Bus Demo
1. Open WareWoolf
2. Open `woolf-controlbus-demo.html` in a browser
3. Copy and paste the script into the editor
4. Click "Run Script"

### Method 2: RexxJS Console (if available)
1. Open the RexxJS console
2. Load the script file
3. Execute

### Method 3: Embedded in HTML
```html
<script src="lib/rexxjs.bundle.js"></script>
<script>
  fetch('examples/rexxjs-scripts/simple-word-count.rexx')
    .then(r => r.text())
    .then(script => {
      // Execute the script
      RexxJS.run(script);
    });
</script>
```

## Creating Your Own Scripts

### Basic Template

```rexx
/* Your Script Name
 * Description of what it does
 */

say "Script starting..."

/* Execute WareWoolf commands */
ADDRESS WOOLF "get-word-count"
result = rc

/* Process results */
say "Result:" result.total

say "Script complete!"
```

### Tips

1. **Always check return codes**: The `rc` variable contains the result
2. **Use descriptive output**: Help users understand what's happening
3. **Handle errors gracefully**: Check for success/failure
4. **Save when appropriate**: Use `ADDRESS WOOLF "save-document"` after changes
5. **Comment your code**: Explain what each section does

### Common Patterns

**Iterating through chapters:**
```rexx
ADDRESS WOOLF "list-chapters"
chapters = rc

do i = 0 to chapters.length - 1
  /* Do something with each chapter */
  ADDRESS WOOLF "get-chapter number=" || i
  chapter = rc
  say chapter.title
end
```

**Conditional operations:**
```rexx
ADDRESS WOOLF "find text=keyword"
result = rc

if result.found then
  say "Found" result.count "matches"
else
  say "Not found"
```

**Error handling:**
```rexx
ADDRESS WOOLF "some-command"

if rc.success then
  say "Success!"
else if rc.error then
  say "Error:" rc.error
```

## Additional Resources

- See `WOOLF_COMMANDS.md` for complete command reference
- Visit the RexxJS documentation for language syntax
- Check `woolf-controlbus-demo.html` for interactive examples

## Contributing

Have a useful script? Consider sharing it:

1. Test it thoroughly
2. Add clear comments
3. Include usage instructions
4. Submit a pull request

---

**Note:** These scripts modify your documents. Always save backups before running batch operations!
