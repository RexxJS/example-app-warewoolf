/* WareWoolf Find and Replace Tool
 * Interactive find and replace with statistics
 */

say "==============================================="
say "     WAREWOOLF FIND & REPLACE TOOL"
say "==============================================="
say ""

/* Define your search and replace terms */
search_term = "old_name"
replace_term = "new_name"

say "Search for:" search_term
say "Replace with:" replace_term
say ""

/* First, find all occurrences */
say "Searching for occurrences..."
ADDRESS WOOLF "find text=" || search_term
result = rc

if result.found then do
  say "Found" result.count "occurrence(s) of '" || search_term || "'"
  say "Positions:" result.positions
  say ""

  /* Perform the replacement */
  say "Performing replacement..."
  ADDRESS WOOLF "replace search=" || search_term " replace-with=" || replace_term
  replace_result = rc

  say "Replaced" replace_result.replacements "occurrence(s)"
  say ""

  /* Save the document */
  say "Saving changes..."
  ADDRESS WOOLF "save-document"

  if rc.success then
    say "✓ Document saved successfully"
  else
    say "✗ Error saving document"

  say ""
  say "==============================================="
  say "Find and replace completed!"
  say "==============================================="
end
else do
  say "No occurrences of '" || search_term || "' found."
  say "No changes made."
end
