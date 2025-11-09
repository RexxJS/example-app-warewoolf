/* LLM Collaborative Editing Demo
 * Demonstrates how an LLM agent can collaborate with a human writer
 * using the OT-enabled document model
 *
 * This script simulates an LLM assistant that:
 * - Announces its presence
 * - Analyzes the document
 * - Suggests improvements
 * - Respects user decisions
 * - Annotates sections with feedback
 */

say "=========================================="
say "  LLM COLLABORATIVE EDITING DEMO"
say "=========================================="
say ""

/* Part 1: Announce Presence */
say "Part 1: Announcing LLM presence..."

ADDRESS WOOLF "announce-presence user-id=claude-assistant user-name=Claude user-type=llm"
presence = rc

say "  ✓ LLM agent registered:" presence.userName
say "  Document ID:" presence.documentId
say ""

/* Part 2: Analyze Current Document */
say "Part 2: Analyzing document structure..."

ADDRESS WOOLF "get-metadata"
metadata = rc

say "  Document version:" metadata.version
say "  Content length:" metadata.length "characters"

ADDRESS WOOLF "get-structure"
structure = rc

say "  Chapters:" structure.chapters
say "  Paragraphs:" structure.paragraphs
say ""

/* Part 3: Get Active Users */
say "Part 3: Checking active collaborators..."

ADDRESS WOOLF "get-active-users"
users = rc

say "  Active users:" users.count
do i = 0 to users.users.length - 1
  user = users.users[i]
  say "    -" user.userName "(" || user.userType || ")"
end
say ""

/* Part 4: Read and Analyze Content */
say "Part 4: Reading current content..."

ADDRESS WOOLF "get-content format=text"
current_text = rc

say "  Current text preview:"
say "  " || left(current_text, 60) || "..."
say ""

/* Part 5: Make Intelligent Suggestions */
say "Part 5: Making improvement suggestions..."

/* Find common phrases that could be improved */
ADDRESS WOOLF "find-pattern pattern=very case-insensitive=true"
find_result = rc

if find_result.count > 0 then do
  say "  Found" find_result.count "instances of 'very' (weak intensifier)"

  /* Suggest replacing first instance */
  first_match = find_result.matches[0]

  /* Get context around the word */
  ADDRESS WOOLF "get-context-around index=" || first_match.index || " context-size=20"
  context = rc

  say "  Context: '..." || context.before || " [very] " || context.after || "...'"

  /* Make suggestion based on context */
  new_word = "extremely" /* Could be "significantly", "remarkably", etc. */

  ADDRESS WOOLF "suggest-edit user-id=claude-assistant" ,
    "index=" || first_match.index ,
    "length=4" , /* "very" */
    "new-text=" || new_word ,
    "confidence=0.85" ,
    "reasoning=Stronger and more specific intensifier"

  suggestion = rc

  say "  ✓ Suggestion created (ID:" || suggestion.suggestionId || ")"
  say "    Suggested:" current_text → new_word
  say "    Confidence:" suggestion.metadata.confidence
  say "    Reasoning:" suggestion.metadata.reasoning
end
else
  say "  No weak intensifiers found"

say ""

/* Part 6: Suggest Structural Improvements */
say "Part 6: Analyzing paragraph structure..."

/* Check for very long paragraphs */
ADDRESS WOOLF "get-range-text index=0 length=" || metadata.length
full_text = rc.text

/* Simple analysis - count sentences in paragraphs */
paragraphs = split(full_text, chr(10) || chr(10)) /* Split on double newline */

long_para_count = 0
do i = 1 to words(paragraphs)
  para = word(paragraphs, i)
  sentence_count = countstr(".", para) + countstr("!", para) + countstr("?", para)

  if sentence_count > 5 then do
    long_para_count = long_para_count + 1

    /* Annotate the long paragraph */
    para_start = pos(para, full_text)
    para_length = length(para)

    ADDRESS WOOLF "annotate-range user-id=claude-assistant" ,
      "index=" || para_start ,
      "length=" || para_length ,
      "text=Consider breaking this into 2-3 paragraphs (" || sentence_count || " sentences)" ,
      "type=suggestion"

    say "  ⚠ Long paragraph detected:" sentence_count "sentences"
  end
end

if long_para_count = 0 then
  say "  ✓ Paragraph lengths look good"

say ""

/* Part 7: Check for Passive Voice (simplified) */
say "Part 7: Checking writing style..."

ADDRESS WOOLF "find-pattern pattern=was\\s+\\w+ed case-insensitive=true"
passive_voice = rc

if passive_voice.count > 0 then do
  say "  ℹ Found" passive_voice.count "potential passive voice constructions"

  /* Annotate first instance */
  first = passive_voice.matches[0]

  ADDRESS WOOLF "annotate-range user-id=claude-assistant" ,
    "index=" || first.index ,
    "length=" || first.length ,
    "text=Consider active voice for stronger prose" ,
    "type=comment"

  say "  ✓ Annotated for review"
end
else
  say "  ✓ Writing style is active and direct"

say ""

/* Part 8: Suggest Adding Chapter if Missing */
say "Part 8: Checking document structure..."

if structure.chapters = 0 then do
  say "  ℹ Document has no chapter markers"
  say "  Suggesting to add introductory chapter..."

  ADDRESS WOOLF "suggest-edit user-id=claude-assistant" ,
    "index=0" ,
    "length=0" ,
    "new-text=Chapter 1: Introduction\n\n" ,
    "confidence=0.75" ,
    "reasoning=Adding structure improves readability"

  chapter_suggestion = rc
  say "  ✓ Chapter suggestion created (ID:" || chapter_suggestion.suggestionId || ")"
end
else
  say "  ✓ Document has" structure.chapters "chapters"

say ""

/* Part 9: Report All Pending Suggestions */
say "Part 9: Summary of suggestions..."

ADDRESS WOOLF "get-suggestions status=pending"
all_suggestions = rc

say "  Total pending suggestions:" all_suggestions.count

do i = 0 to all_suggestions.suggestions.length - 1
  sugg = all_suggestions.suggestions[i]
  say "    " || (i + 1) || "." sugg.metadata.reasoning
  say "       Confidence:" sugg.metadata.confidence
  say "       Range:" sugg.range.index "+" || sugg.range.length
end

say ""

/* Part 10: Set Cursor to First Suggestion */
if all_suggestions.count > 0 then do
  first_sugg = all_suggestions.suggestions[0]

  ADDRESS WOOLF "set-cursor user-id=claude-assistant index=" || first_sugg.range.index

  say "  ℹ Cursor positioned at first suggestion for review"
end

say ""

/* Part 11: Show Collaboration Statistics */
say "=========================================="
say "  COLLABORATION SUMMARY"
say "=========================================="
say ""

ADDRESS WOOLF "get-version"
final_version = rc

ADDRESS WOOLF "get-annotations"
all_annotations = rc

say "Statistics:"
say "  Document version:" final_version.version
say "  Active users:" users.count
say "  Suggestions made:" all_suggestions.count
say "  Annotations added:" all_annotations.count
say "  Chapters:" structure.chapters
say "  Paragraphs:" structure.paragraphs
say ""

say "Next Steps:"
say "  1. Review suggestions (use get-suggestions)"
say "  2. Accept/reject each suggestion"
say "  3. Review annotations for additional feedback"
say "  4. Continue collaborative editing"
say ""

say "LLM Agent Commands Available:"
say "  - suggest-edit: Propose changes"
say "  - annotate-range: Add comments"
say "  - get-context-around: Understand context"
say "  - find-pattern: Analyze content"
say "  - lock-range: Reserve editing space"
say ""

say "=========================================="
say "  COLLABORATION SESSION ACTIVE"
say "=========================================="
