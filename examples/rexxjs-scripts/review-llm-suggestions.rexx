/* Review LLM Suggestions Script
 * Demonstrates how a human writer can review and process
 * suggestions made by an LLM collaborative agent
 *
 * This script shows:
 * - Listing all pending suggestions
 * - Reviewing each suggestion with context
 * - Accepting helpful suggestions
 * - Rejecting inappropriate suggestions
 * - Managing the suggestion workflow
 */

say "=========================================="
say "  SUGGESTION REVIEW WORKFLOW"
say "=========================================="
say ""

/* Part 1: Announce Human Presence */
say "Part 1: Registering human reviewer..."

ADDRESS WOOLF "announce-presence user-id=alice user-name=Alice user-type=human"
presence = rc

say "  ✓ Reviewer:" presence.userName
say ""

/* Part 2: Get All Pending Suggestions */
say "Part 2: Loading pending suggestions..."

ADDRESS WOOLF "get-suggestions status=pending"
suggestions = rc

if suggestions.count = 0 then do
  say "  No pending suggestions to review."
  say "  Run llm-collaborative-editing.rexx first to generate suggestions."
  exit 0
end

say "  Found" suggestions.count "pending suggestion(s)"
say ""

/* Part 3: Review Each Suggestion */
say "Part 3: Reviewing suggestions..."
say ""

accepted_count = 0
rejected_count = 0

do i = 0 to suggestions.suggestions.length - 1
  suggestion = suggestions.suggestions[i]
  sugg_num = i + 1

  say "──────────────────────────────────────"
  say "Suggestion" sugg_num "of" suggestions.count
  say "──────────────────────────────────────"
  say "  From:" suggestion.userId
  say "  Range:" suggestion.range.index "+" || suggestion.range.length
  say ""

  /* Get context */
  ADDRESS WOOLF "get-context-around" ,
    "index=" || suggestion.range.index ,
    "context-size=30"
  context = rc

  say "  Context:"
  say "    ..." || context.before
  say "    [" || suggestion.oldText || "] → [" || suggestion.newText || "]"
  say "    " || context.after || "..."
  say ""

  if suggestion.metadata.confidence then
    say "  Confidence:" suggestion.metadata.confidence

  if suggestion.metadata.reasoning then
    say "  Reasoning:" suggestion.metadata.reasoning

  say ""

  /* Decision logic - in real use, this would be interactive
   * For this demo, we'll accept high-confidence suggestions
   */
  decision = "review"

  /* Auto-accept very high confidence suggestions */
  if suggestion.metadata.confidence >= 0.90 then
    decision = "accept"

  /* Auto-reject low confidence suggestions */
  else if suggestion.metadata.confidence < 0.70 then
    decision = "reject"

  /* Review medium confidence manually (in demo, accept if reasonable) */
  else do
    /* Simple heuristic: accept if replacement is longer (more specific) */
    if length(suggestion.newText) > length(suggestion.oldText) then
      decision = "accept"
    else
      decision = "reject"
  end

  /* Process decision */
  if decision = "accept" then do
    ADDRESS WOOLF "accept-suggestion" ,
      "suggestion-id=" || suggestion.suggestionId ,
      "user-id=alice"

    result = rc

    say "  ✓ ACCEPTED"
    say "    Applied to document at version" result.appliedAtVersion
    accepted_count = accepted_count + 1
  end
  else if decision = "reject" then do
    reason = "Does not improve clarity"

    /* Provide specific reasons based on context */
    if suggestion.metadata.confidence < 0.70 then
      reason = "Low confidence - needs human judgment"
    else if length(suggestion.newText) < length(suggestion.oldText) then
      reason = "Oversimplification - original is better"

    ADDRESS WOOLF "reject-suggestion" ,
      "suggestion-id=" || suggestion.suggestionId ,
      "user-id=alice" ,
      "reason=" || reason

    result = rc

    say "  ✗ REJECTED"
    say "    Reason:" reason
    rejected_count = rejected_count + 1
  end

  say ""
end

say "=========================================="
say ""

/* Part 4: Review Summary */
say "Part 4: Review summary..."
say ""
say "  Total suggestions reviewed:" suggestions.count
say "  Accepted:" accepted_count
say "  Rejected:" rejected_count
say "  Acceptance rate:" (accepted_count * 100 / suggestions.count) || "%"
say ""

/* Part 5: Check Remaining Suggestions */
ADDRESS WOOLF "get-suggestions status=pending"
remaining = rc

ADDRESS WOOLF "get-suggestions status=accepted"
accepted = rc

ADDRESS WOOLF "get-suggestions status=rejected"
rejected = rc

say "Current suggestion status:"
say "  Pending:" remaining.count
say "  Accepted:" accepted.count
say "  Rejected:" rejected.count
say ""

/* Part 6: Clear Processed Suggestions */
say "Part 6: Cleaning up processed suggestions..."

/* Clear rejected suggestions (keep accepted for history) */
ADDRESS WOOLF "clear-suggestions status=rejected"
cleared = rc

say "  ✓ Cleared" cleared.cleared "rejected suggestion(s)"
say ""

/* Part 7: Document State */
say "Part 7: Current document state..."

ADDRESS WOOLF "get-version"
version = rc

ADDRESS WOOLF "get-word-count"
stats = rc

say "  Document version:" version.version
say "  Word count:" stats.total
say "  Changes from suggestions:" accepted_count
say ""

/* Part 8: Get Change History */
if accepted_count > 0 then do
  say "Part 8: Recent changes from accepted suggestions..."

  ADDRESS WOOLF "get-history limit=5"
  history = rc

  say "  Last 5 changes:"
  do i = 0 to min(history.history.length - 1, 4)
    change = history.history[i]
    say "    v" || change.version || ":" change.operation "by" change.userId
  end

  say ""
end

/* Part 9: Review Annotations */
say "Part 9: Reviewing LLM annotations..."

ADDRESS WOOLF "get-annotations"
annotations = rc

if annotations.count > 0 then do
  say "  Found" annotations.count "annotation(s) for review:"
  say ""

  do i = 0 to annotations.annotations.length - 1
    annot = annotations.annotations[i]

    say "  Annotation" (i + 1) || ":"
    say "    Type:" annot.type
    say "    From:" annot.userId
    say "    Text:" annot.text
    say "    Range:" annot.range.index "+" || annot.range.length
    say ""
  end
end
else
  say "  No annotations to review"

say ""

/* Final Summary */
say "=========================================="
say "  REVIEW COMPLETE"
say "=========================================="
say ""

if accepted_count > 0 then do
  say "✓ Applied" accepted_count "improvement(s) to your document"
  say ""
end

if annotations.count > 0 then do
  say "ℹ" annotations.count "annotation(s) available for your consideration"
  say ""
end

say "Collaboration Tips:"
say "  - LLM suggestions are just that - suggestions!"
say "  - You always have final say on your writing"
say "  - Use reject-suggestion with reason to help train patterns"
say "  - Review annotations for non-actionable feedback"
say "  - Lock ranges when you want uninterrupted editing"
say ""

say "Next Actions:"
say "  - Continue writing with lock-range for focus"
say "  - Request new analysis with llm-collaborative-editing.rexx"
say "  - Review remaining annotations"
say "  - Export completed work"
say ""

say "=========================================="
