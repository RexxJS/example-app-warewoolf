# WareWoolf Collaborative Editing Guide

## Overview

WareWoolf now supports **Operational Transform (OT)** features that enable seamless collaboration between human writers and LLM assistants. This document explains how to use these features effectively.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Getting Started](#getting-started)
- [LLM Integration Patterns](#llm-integration-patterns)
- [Workflows](#workflows)
- [Best Practices](#best-practices)
- [Architecture](#architecture)
- [Examples](#examples)

---

## Core Concepts

### What is Operational Transform?

Operational Transform (OT) is a concurrency control technique that allows multiple users (humans and LLMs) to edit the same document simultaneously without conflicts. In WareWoolf's implementation:

- **Version Tracking**: Every change increments a version number
- **Change Log**: All edits are recorded with metadata
- **Conflict Prevention**: Range locks prevent simultaneous edits to the same text
- **User Awareness**: Track cursors, selections, and presence

### Key Features

1. **Version Control** - Track all document changes
2. **Multi-User Cursors** - See where collaborators are working
3. **Range Locking** - Reserve document sections for editing
4. **Suggestion System** - LLMs propose edits for human review
5. **Annotations** - Add comments without changing text
6. **Transactions** - Group multiple edits atomically
7. **History & Revert** - Undo to any previous version

---

## Getting Started

### Basic Presence

Every collaborator (human or LLM) should announce their presence:

```rexx
/* Human announces presence */
ADDRESS WOOLF "announce-presence user-id=alice user-name=Alice user-type=human"

/* LLM announces presence */
ADDRESS WOOLF "announce-presence user-id=claude user-name=Claude user-type=llm"

/* Check who's active */
ADDRESS WOOLF "get-active-users"
users = rc
say "Collaborating with" users.count "users"
```

### Making Changes

All edit operations require a `user-id` parameter:

```rexx
/* Insert text */
ADDRESS WOOLF "insert-at index=100 text=Hello user-id=alice"

/* Delete text */
ADDRESS WOOLF "delete-range index=50 length=10 user-id=alice"

/* Replace text */
ADDRESS WOOLF "replace-range index=30 length=5 text=World user-id=alice"
```

### Tracking Versions

Monitor document evolution:

```rexx
/* Get current version */
ADDRESS WOOLF "get-version"
say "Current version:" rc.version

/* Get changes since version 10 */
ADDRESS WOOLF "get-changes-since since=10"
changes = rc
say "Changes:" changes.changes.length

/* View history */
ADDRESS WOOLF "get-history limit=20"
history = rc
do i = 0 to history.history.length - 1
  change = history.history[i]
  say "v" || change.version || ":" change.operation "by" change.userId
end
```

---

## LLM Integration Patterns

### Pattern 1: Suggestion Workflow

LLMs should suggest edits rather than making direct changes:

**LLM Script (claude-suggest.rexx):**
```rexx
/* Analyze document */
ADDRESS WOOLF "get-content format=text"
content = rc

/* Find areas to improve */
ADDRESS WOOLF "find-pattern pattern=very case-insensitive=true"
results = rc

if results.count > 0 then do
  match = results.matches[0]

  /* Suggest improvement */
  ADDRESS WOOLF "suggest-edit" ,
    "user-id=claude" ,
    "index=" || match.index ,
    "length=4" ,
    "new-text=extremely" ,
    "confidence=0.85" ,
    "reasoning=More specific intensifier"

  suggestion = rc
  say "Suggestion ID:" suggestion.suggestionId
end
```

**Human Review Script (review.rexx):**
```rexx
/* Get pending suggestions */
ADDRESS WOOLF "get-suggestions status=pending"
suggestions = rc

do i = 0 to suggestions.suggestions.length - 1
  sugg = suggestions.suggestions[i]

  /* Show suggestion */
  say "Suggestion" (i+1) || ":"
  say "  Change '" || sugg.oldText || "' → '" || sugg.newText || "'"
  say "  Reason:" sugg.metadata.reasoning
  say "  Confidence:" sugg.metadata.confidence

  /* Accept or reject */
  if sugg.metadata.confidence > 0.80 then do
    ADDRESS WOOLF "accept-suggestion" ,
      "suggestion-id=" || sugg.suggestionId ,
      "user-id=alice"
    say "  ✓ Accepted"
  end
  else do
    ADDRESS WOOLF "reject-suggestion" ,
      "suggestion-id=" || sugg.suggestionId ,
      "user-id=alice" ,
      "reason=Low confidence"
    say "  ✗ Rejected"
  end
end
```

### Pattern 2: Concurrent Editing with Locks

When multiple collaborators work on different sections:

```rexx
/* Alice locks Chapter 1 */
ADDRESS WOOLF "lock-range user-id=alice index=0 length=500 duration=300000"
lock1 = rc

/* Bob locks Chapter 2 */
ADDRESS WOOLF "lock-range user-id=bob index=500 length=500 duration=300000"
lock2 = rc

/* Alice edits her section */
ADDRESS WOOLF "insert-at index=100 text=New content user-id=alice"

/* Bob tries to edit Alice's section - BLOCKED */
ADDRESS WOOLF "insert-at index=100 text=Conflict user-id=bob"
/* Error: Range is locked by another user */

/* Release locks when done */
ADDRESS WOOLF "unlock-range lock-id=" || lock1.lockId || " user-id=alice"
ADDRESS WOOLF "unlock-range lock-id=" || lock2.lockId || " user-id=bob"
```

### Pattern 3: LLM Annotations

LLMs can comment without editing:

```rexx
/* LLM analyzes prose quality */
ADDRESS WOOLF "find-pattern pattern=was\\s+\\w+ed"
passive_voice = rc

if passive_voice.count > 0 then do
  match = passive_voice.matches[0]

  /* Add annotation */
  ADDRESS WOOLF "annotate-range" ,
    "user-id=claude" ,
    "index=" || match.index ,
    "length=" || match.length ,
    "text=Consider active voice for stronger prose" ,
    "type=suggestion"

  annotation = rc
  say "Annotation added at position" match.index
end
```

### Pattern 4: Transactional Edits

Group related changes:

```rexx
/* Start transaction */
ADDRESS WOOLF "begin-transaction user-id=alice"

/* Make multiple related changes */
ADDRESS WOOLF "insert-at index=0 text=Chapter 1\n\n user-id=alice"
ADDRESS WOOLF "insert-at index=13 text=Introduction paragraph user-id=alice"
ADDRESS WOOLF "format-selection bold=true"

/* Commit all as one version */
ADDRESS WOOLF "commit-transaction"
result = rc
say "Committed" result.operationCount "operations as version" result.version

/* Or rollback if something went wrong */
/* ADDRESS WOOLF "rollback-transaction" */
```

---

## Workflows

### Workflow 1: LLM-Assisted Writing

**Step 1: Writer creates initial draft**
```rexx
ADDRESS WOOLF "announce-presence user-id=alice user-name=Alice user-type=human"
ADDRESS WOOLF "set-content text=It was a dark night. The wind howled."
```

**Step 2: LLM analyzes and suggests**
```rexx
/* Run: llm-collaborative-editing.rexx */
/* Creates multiple suggestions for improvements */
```

**Step 3: Writer reviews suggestions**
```rexx
/* Run: review-llm-suggestions.rexx */
/* Accept good suggestions, reject poor ones */
```

**Step 4: Iterative improvement**
```rexx
/* Repeat steps 2-3 until satisfied */
```

### Workflow 2: Multi-Author Collaboration

**Step 1: Divide document into sections**
```rexx
ADDRESS WOOLF "announce-presence user-id=alice user-name=Alice user-type=human"
ADDRESS WOOLF "announce-presence user-id=bob user-name=Bob user-type=human"

/* Find section boundaries */
ADDRESS WOOLF "find-pattern pattern=Section\\s+\\d+"
sections = rc
```

**Step 2: Lock sections**
```rexx
/* Alice takes Section 1 */
ADDRESS WOOLF "lock-range user-id=alice index=0 length=1000"

/* Bob takes Section 2 */
ADDRESS WOOLF "lock-range user-id=bob index=1000 length=1000"
```

**Step 3: Edit concurrently**
```rexx
/* Each author works in their section */
/* Cursors visible to both */
```

**Step 4: Release and review**
```rexx
/* Unlock sections */
ADDRESS WOOLF "unlock-range lock-id=1 user-id=alice"
ADDRESS WOOLF "unlock-range lock-id=2 user-id=bob"

/* Review each other's work */
```

### Workflow 3: LLM Code Review

**Step 1: Writer finishes draft**
```rexx
ADDRESS WOOLF "save-document"
```

**Step 2: LLM performs comprehensive analysis**
```rexx
/* Check structure */
ADDRESS WOOLF "get-structure"
structure = rc

/* Find clichés */
ADDRESS WOOLF "find-pattern pattern=as\\s+white\\s+as\\s+snow"

/* Check paragraph lengths */
/* Add annotations for issues */
```

**Step 3: Writer addresses feedback**
```rexx
/* Review annotations */
ADDRESS WOOLF "get-annotations type=suggestion"
annotations = rc

/* Fix issues one by one */
/* Delete annotations when resolved */
ADDRESS WOOLF "delete-annotation annotation-id=1"
```

---

## Best Practices

### For LLM Agents

1. **Always announce presence** - Let humans know an AI is active
2. **Use suggestions, not direct edits** - Respect human agency
3. **Provide reasoning** - Explain why you suggest changes
4. **Include confidence scores** - Help humans prioritize
5. **Respect locks** - Don't try to edit locked ranges
6. **Use annotations for non-actionable feedback** - Comments, observations
7. **Be specific in metadata** - Good: "Passive voice weakens impact", Bad: "Fix this"

### For Human Writers

1. **Lock ranges when you need focus** - Prevent interruptions
2. **Review suggestions regularly** - Don't let them pile up
3. **Provide rejection reasons** - Helps LLMs learn your preferences
4. **Use transactions for complex edits** - Maintain atomicity
5. **Monitor active users** - Know who's collaborating
6. **Check version history** - Track document evolution
7. **Clear processed suggestions** - Keep workspace clean

### For All Collaborators

1. **Update cursors frequently** - Maintain awareness
2. **Respect lock durations** - Don't lock too long
3. **Use clear user IDs** - "alice" not "user1"
4. **Monitor changes** - Subscribe if real-time updates needed
5. **Save frequently** - Document operations are in-memory
6. **Test on small sections first** - Before bulk operations

---

## Architecture

### Component Hierarchy

```
┌─────────────────────────────────────┐
│         RexxJS Script               │
│  (Human or LLM automation)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│     WoolfRexxHandler                │
│  (Command routing & validation)     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│     WoolfOTDocument                 │
│  (OT logic & state management)      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│        Quill Editor                 │
│  (Rendering & input handling)       │
└─────────────────────────────────────┘
```

### Data Flow

**Edit Operation:**
1. Script calls `ADDRESS WOOLF "insert-at ..."`
2. Handler parses parameters
3. OTDocument checks locks
4. OTDocument applies operation to Quill
5. OTDocument logs change
6. OTDocument increments version
7. OTDocument notifies subscribers
8. Handler returns result

**Suggestion Workflow:**
1. LLM calls `suggest-edit`
2. OTDocument creates suggestion object
3. Suggestion stored as "pending"
4. Human reviews with `get-suggestions`
5. Human calls `accept-suggestion` or `reject-suggestion`
6. If accepted: apply as normal edit
7. Update suggestion status

### State Management

**In-Memory State:**
- `version` - Current document version (integer)
- `changeLog` - Array of change objects (max 1000)
- `cursors` - Map of user → cursor position
- `selections` - Map of user → selection range
- `activeUsers` - Map of user → presence info
- `suggestions` - Map of suggestionId → suggestion object
- `annotations` - Map of annotationId → annotation object
- `rangeLocks` - Map of lockId → lock object
- `changeSubscribers` - Map of subscriptionId → callback

**Persistent State:**
- Document content (via Quill/WareWoolf save)
- Note: OT metadata is NOT persisted (session-only)

---

## Examples

### Example 1: Simple LLM Collaboration

```rexx
/* setup.rexx - Initialize collaboration */

/* Human starts */
ADDRESS WOOLF "announce-presence user-id=writer user-name=Jane user-type=human"
ADDRESS WOOLF "set-content text=The cat sat on the mat."

/* LLM joins */
ADDRESS WOOLF "announce-presence user-id=assistant user-name=AI user-type=llm"

/* LLM suggests improvement */
ADDRESS WOOLF "suggest-edit" ,
  "user-id=assistant" ,
  "index=4 length=3" ,
  "new-text=kitten" ,
  "confidence=0.75" ,
  "reasoning=More specific noun"

/* Human reviews */
ADDRESS WOOLF "get-suggestions status=pending"
suggestions = rc

sugg = suggestions.suggestions[0]
ADDRESS WOOLF "accept-suggestion suggestion-id=" || sugg.suggestionId || " user-id=writer"

/* Result: "The kitten sat on the mat." */
```

### Example 2: Range Locking

```rexx
/* concurrent.rexx - Multiple users, no conflicts */

/* User 1 locks first half */
ADDRESS WOOLF "lock-range user-id=user1 index=0 length=100"
lock1 = rc

/* User 2 locks second half */
ADDRESS WOOLF "lock-range user-id=user2 index=100 length=100"
lock2 = rc

/* Both edit safely */
ADDRESS WOOLF "insert-at index=50 text=Edit1 user-id=user1"  /* ✓ OK */
ADDRESS WOOLF "insert-at index=150 text=Edit2 user-id=user2" /* ✓ OK */

/* Conflicts prevented */
/* ADDRESS WOOLF "insert-at index=150 text=Conflict user-id=user1" */ /* ✗ Error */

/* Release locks */
ADDRESS WOOLF "unlock-range lock-id=" || lock1.lockId || " user-id=user1"
ADDRESS WOOLF "unlock-range lock-id=" || lock2.lockId || " user-id=user2"
```

### Example 3: Transaction Rollback

```rexx
/* transaction.rexx - Atomic multi-edit with error handling */

/* Start transaction */
ADDRESS WOOLF "begin-transaction user-id=editor"

/* Make several changes */
ADDRESS WOOLF "insert-at index=0 text=Title\n\n user-id=editor"
ADDRESS WOOLF "insert-at index=8 text=Paragraph 1 user-id=editor"

/* Check if we're happy with changes */
ADDRESS WOOLF "get-content format=text"
preview = rc

if verify_quality(preview) then do
  /* Commit all changes as one version */
  ADDRESS WOOLF "commit-transaction"
  say "Changes committed"
end
else do
  /* Rollback - no changes applied */
  ADDRESS WOOLF "rollback-transaction"
  say "Changes discarded"
end
```

### Example 4: Change Subscription

```rexx
/* monitor.rexx - Real-time change monitoring */

/* Subscribe to all changes */
ADDRESS WOOLF "subscribe-changes user-id=monitor"
subscription = rc

say "Monitoring document (subscription" subscription.subscriptionId || ")"

/* In a real implementation, this would be callback-based
 * For demo purposes, we can poll for changes */

last_version = 0

do forever
  ADDRESS WOOLF "get-version"
  current_version = rc.version

  if current_version > last_version then do
    /* Get new changes */
    ADDRESS WOOLF "get-changes-since since=" || last_version
    changes = rc

    /* Process each change */
    do i = 0 to changes.changes.length - 1
      change = changes.changes[i]
      say "[v" || change.version || "]" change.userId ":" change.operation
    end

    last_version = current_version
  end

  /* Sleep/wait mechanism would go here */
end

/* Cleanup */
ADDRESS WOOLF "unsubscribe-changes subscription-id=" || subscription.subscriptionId
```

### Example 5: LLM Content Analysis

```rexx
/* analyze.rexx - Comprehensive document analysis by LLM */

ADDRESS WOOLF "announce-presence user-id=analyzer user-name=Analyzer user-type=llm"

say "Analyzing document..."

/* 1. Structure check */
ADDRESS WOOLF "get-structure"
structure = rc
say "Structure: " structure.chapters "chapters," structure.paragraphs "paragraphs"

/* 2. Readability check */
ADDRESS WOOLF "get-metadata"
metadata = rc
ADDRESS WOOLF "get-word-count"
stats = rc

avg_words_per_para = stats.total / structure.paragraphs
say "Avg paragraph length:" avg_words_per_para "words"

if avg_words_per_para > 100 then
  say "⚠ Paragraphs may be too long"

/* 3. Find weak language */
weak_words.1 = "very"
weak_words.2 = "really"
weak_words.3 = "just"
weak_words.4 = "quite"

do i = 1 to 4
  ADDRESS WOOLF "find-pattern pattern=" || weak_words.i || " case-insensitive=true"
  results = rc

  if results.count > 0 then
    say "Found" results.count "instances of '" || weak_words.i || "'"
end

/* 4. Passive voice check */
ADDRESS WOOLF "find-pattern pattern=was\\s+\\w+ed"
passive = rc
say "Passive voice instances:" passive.count

/* 5. Create annotations for issues */
if passive.count > 5 then do
  ADDRESS WOOLF "annotate-range" ,
    "user-id=analyzer" ,
    "index=0" ,
    "length=" || metadata.length ,
    "text=High passive voice usage - consider active constructions" ,
    "type=suggestion"
end

say "Analysis complete"
```

---

## FAQ

### Q: Are OT changes saved with the document?

**A:** No. The OT metadata (versions, cursors, suggestions, annotations) is session-only. Only the final document content is saved. This is intentional - each editing session is fresh.

### Q: Can I have multiple LLMs collaborating?

**A:** Yes! Each LLM should have a unique `user-id` (e.g., `claude-analyzer`, `claude-editor`). They can all suggest edits, add annotations, and track their own cursors.

### Q: What happens if two users edit the same range?

**A:** Use range locks! The first user to lock a range gets exclusive access. Other users will receive an error if they try to edit that range. Locks auto-expire after the duration.

### Q: How do I know what changed in version N?

**A:** Use `get-changes-since since=N-1` to see exactly what changed between versions N-1 and N. Each change includes operation type, user, timestamp, and affected text.

### Q: Can I undo to a previous version?

**A:** Yes, use `revert-to-version version=N`. Note: This creates a new forward version, it doesn't delete history.

### Q: How do suggestions differ from direct edits?

**A:** Suggestions are proposals that don't modify the document until accepted. Direct edits (insert-at, delete-range, etc.) immediately change the document. LLMs should prefer suggestions.

### Q: What's the difference between annotations and suggestions?

**A:** Annotations are comments/highlights that don't propose specific edits. Suggestions include the exact old→new text change. Use annotations for "consider restructuring" and suggestions for "change 'cat' to 'kitten'".

### Q: Can I batch accept/reject suggestions?

**A:** Yes, loop through `get-suggestions` results and call `accept-suggestion` or `reject-suggestion` for each. Use transactions if you want the accepts to be atomic.

### Q: How long do range locks last?

**A:** Default is 5 minutes (300000ms). Specify `duration=60000` for 1 minute, etc. Locks auto-release after expiration or explicit `unlock-range`.

### Q: Can I see other users' cursors in the editor?

**A:** The OT system tracks cursors via `get-all-cursors`, but rendering them in the UI is not yet implemented. This is planned for a future update.

---

## Troubleshooting

### "Range is locked by another user"

**Problem:** Trying to edit a locked range.

**Solutions:**
- Wait for lock to expire
- Ask lock owner to unlock with `unlock-range`
- Edit a different section
- Check locks with `get-all-cursors` to see who's where

### Suggestions not appearing

**Problem:** `get-suggestions` returns empty.

**Solutions:**
- Check status filter: `get-suggestions status=pending`
- Verify LLM created suggestions with `suggest-edit`
- Check that suggestions weren't cleared with `clear-suggestions`

### Version numbers seem wrong

**Problem:** Version jumps or unexpected values.

**Solutions:**
- Check if transactions were used (commits count as one version)
- Use `get-history` to see full version timeline
- Remember: version increments on every change

### Lost cursor positions

**Problem:** Cursors reset or disappear.

**Solutions:**
- Cursors are session-only, reload loses them
- Call `set-cursor` after any navigation
- Track manually if persistence needed

---

## Next Steps

### Try the Examples

Run the included example scripts:

1. `examples/rexxjs-scripts/llm-collaborative-editing.rexx` - LLM suggests improvements
2. `examples/rexxjs-scripts/review-llm-suggestions.rexx` - Review and process suggestions
3. `examples/rexxjs-scripts/concurrent-editing-demo.rexx` - Multi-user collaboration

### Build Your Own

Create custom workflows:
- **Style checker** - LLM scans for style guide violations
- **Auto-formatter** - Apply consistent formatting rules
- **Chapter analyzer** - Generate statistics per chapter
- **Co-writer** - LLM generates content suggestions
- **Proofreader** - LLM marks potential errors

### Integration

Integrate with external tools:
- **Web UI** - Use `WoolfDirectorBridge` for iframe control
- **REST API** - Wrap commands in HTTP endpoints
- **Git hooks** - Auto-analyze on commit
- **CI/CD** - Run quality checks in pipeline

---

## Contributing

To extend the OT system:

1. **Add new commands** - Edit `woolf-rexx-handler.js`
2. **Add new OT features** - Edit `woolf-ot-document.js`
3. **Add tests** - Follow patterns in `tests/unit/` and `tests/playwright/`
4. **Update docs** - Update this guide and `WOOLF_COMMANDS.md`

---

## License

This OT collaboration system is part of WareWoolf and shares its MIT license.

---

**Happy Collaborating!** 🐺🤝🤖
