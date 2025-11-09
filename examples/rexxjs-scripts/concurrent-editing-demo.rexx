/* Concurrent Editing Demo
 * Demonstrates conflict-free collaborative editing using range locks
 * and OT operations
 *
 * This script shows:
 * - Multiple users working on different parts of the document
 * - Range locking to prevent conflicts
 * - Cursor tracking for awareness
 * - Transaction support for atomic edits
 * - Change subscriptions for real-time updates
 */

say "=========================================="
say "  CONCURRENT EDITING DEMO"
say "=========================================="
say ""

/* Setup: Create a document with multiple sections */
say "Setup: Creating multi-section document..."

ADDRESS WOOLF "set-content text=Chapter 1: Introduction\n\n[Section 1]\n\nChapter 2: Development\n\n[Section 2]\n\nChapter 3: Conclusion\n\n[Section 3]"

ADDRESS WOOLF "get-metadata"
metadata = rc

say "  ✓ Document created (" || metadata.length || " characters)"
say ""

/* Part 1: Multiple Users Join */
say "Part 1: Multiple collaborators joining..."

ADDRESS WOOLF "announce-presence user-id=alice user-name=Alice user-type=human"
alice = rc

ADDRESS WOOLF "announce-presence user-id=bob user-name=Bob user-type=human"
bob = rc

ADDRESS WOOLF "announce-presence user-id=claude user-name=Claude user-type=llm"
claude = rc

ADDRESS WOOLF "get-active-users"
users = rc

say "  Active collaborators:" users.count
do i = 0 to users.users.length - 1
  user = users.users[i]
  say "    ✓" user.userName "(" || user.userType || ")"
end
say ""

/* Part 2: Assign Sections with Range Locks */
say "Part 2: Assigning sections to users..."

/* Find section positions */
ADDRESS WOOLF "find-pattern pattern=\\[Section 1\\]"
section1 = rc.matches[0]

ADDRESS WOOLF "find-pattern pattern=\\[Section 2\\]"
section2 = rc.matches[0]

ADDRESS WOOLF "find-pattern pattern=\\[Section 3\\]"
section3 = rc.matches[0]

/* Alice locks Section 1 */
ADDRESS WOOLF "lock-range user-id=alice" ,
  "index=" || section1.index ,
  "length=50" ,
  "duration=300000"  /* 5 minutes */

lock1 = rc

say "  ✓ Alice locked Section 1"
say "    Range:" lock1.index "-" || (lock1.index + lock1.length)
say "    Duration:" (lock1.duration / 1000) "seconds"

/* Bob locks Section 2 */
ADDRESS WOOLF "lock-range user-id=bob" ,
  "index=" || section2.index ,
  "length=50" ,
  "duration=300000"

lock2 = rc

say "  ✓ Bob locked Section 2"
say "    Range:" lock2.index "-" || (lock2.index + lock2.length)

/* Claude (LLM) works on Section 3 */
ADDRESS WOOLF "lock-range user-id=claude" ,
  "index=" || section3.index ,
  "length=50" ,
  "duration=300000"

lock3 = rc

say "  ✓ Claude locked Section 3"
say "    Range:" lock3.index "-" || (lock3.index + lock3.length)

say ""

/* Part 3: Concurrent Editing with Transactions */
say "Part 3: Concurrent editing in progress..."
say ""

/* Alice edits Section 1 using transaction */
say "  Alice working on Section 1..."

ADDRESS WOOLF "begin-transaction user-id=alice"

ADDRESS WOOLF "replace-range user-id=alice" ,
  "index=" || section1.index ,
  "length=11" ,
  "text=The introduction provides an overview of the project."

ADDRESS WOOLF "insert-at user-id=alice" ,
  "index=" || (section1.index + 54) ,
  "text= Key objectives are outlined here."

ADDRESS WOOLF "commit-transaction"
alice_result = rc

say "    ✓ Applied" alice_result.operationCount "changes (transaction)"

ADDRESS WOOLF "set-cursor user-id=alice index=" || (section1.index + 60)

/* Bob edits Section 2 */
say "  Bob working on Section 2..."

ADDRESS WOOLF "replace-range user-id=bob" ,
  "index=" || section2.index ,
  "length=11" ,
  "text=This section explores the development process in detail."

bob_result = rc

say "    ✓ Applied change"

ADDRESS WOOLF "set-cursor user-id=bob index=" || (section2.index + 40)

/* Claude (LLM) suggests improvements to Section 3 */
say "  Claude analyzing Section 3..."

ADDRESS WOOLF "replace-range user-id=claude" ,
  "index=" || section3.index ,
  "length=11" ,
  "text=In conclusion, we summarize the key findings."

ADDRESS WOOLF "annotate-range user-id=claude" ,
  "index=" || section3.index ,
  "length=50" ,
  "text=Consider adding future work section" ,
  "type=suggestion"

claude_result = rc

say "    ✓ Applied change and added annotation"

ADDRESS WOOLF "set-cursor user-id=claude index=" || (section3.index + 45)

say ""

/* Part 4: Check Cursor Positions */
say "Part 4: Current cursor positions..."

ADDRESS WOOLF "get-all-cursors"
cursors = rc

/* Convert Map to array for RexxJS */
say "  Active cursors:"
cursor_ids = ""
for user_id over cursors.cursors
  cursor = cursors.cursors[user_id]
  user_name = user_id
  if user_id = "alice" then user_name = "Alice"
  if user_id = "bob" then user_name = "Bob"
  if user_id = "claude" then user_name = "Claude"

  say "    " || user_name || ":" cursor.index
end
say ""

/* Part 5: Try Conflicting Edit (Should Fail) */
say "Part 5: Testing conflict prevention..."

say "  Attempting: Bob tries to edit Alice's locked section..."

/* Bob tries to edit Section 1 (locked by Alice) */
error_occurred = 0
ADDRESS WOOLF "insert-at user-id=bob" ,
  "index=" || (section1.index + 10) ,
  "text=CONFLICT"

if rc.error then do
  say "    ✗ Edit blocked: Range is locked by Alice"
  error_occurred = 1
end

if error_occurred = 0 then
  say "    ⚠ Warning: Lock was not enforced!"

say ""

/* Part 6: Release Locks and Coordinate */
say "Part 6: Completing work and releasing locks..."

ADDRESS WOOLF "unlock-range lock-id=" || lock1.lockId || " user-id=alice"
say "  ✓ Alice released Section 1"

ADDRESS WOOLF "unlock-range lock-id=" || lock2.lockId || " user-id=bob"
say "  ✓ Bob released Section 2"

ADDRESS WOOLF "unlock-range lock-id=" || lock3.lockId || " user-id=claude"
say "  ✓ Claude released Section 3"

say ""

/* Part 7: Review Final Document */
say "Part 7: Reviewing collaborative changes..."

ADDRESS WOOLF "get-version"
final_version = rc

ADDRESS WOOLF "get-content format=text"
final_content = rc

say "  Final document version:" final_version.version
say ""
say "  Document preview:"
say "  ──────────────────────────────────────"

/* Show first 200 characters */
preview = left(final_content, 200)
say "  " || preview || "..."

say "  ──────────────────────────────────────"
say ""

/* Part 8: Change History */
say "Part 8: Change history from this session..."

ADDRESS WOOLF "get-history limit=10"
history = rc

say "  Recent changes:" history.totalChanges "total"

do i = 0 to min(history.history.length - 1, 5)
  change = history.history[i]
  user_name = change.userId

  say "    v" || change.version || ":" change.operation "by" user_name "at" change.timestamp
end

say ""

/* Part 9: Collaboration Statistics */
say "Part 9: Collaboration statistics..."

/* Count changes by user */
alice_changes = 0
bob_changes = 0
claude_changes = 0

do i = 0 to history.history.length - 1
  change = history.history[i]

  if change.userId = "alice" then alice_changes = alice_changes + 1
  if change.userId = "bob" then bob_changes = bob_changes + 1
  if change.userId = "claude" then claude_changes = claude_changes + 1
end

say "  Contributions:"
say "    Alice:" alice_changes "change(s)"
say "    Bob:" bob_changes "change(s)"
say "    Claude:" claude_changes "change(s)"

ADDRESS WOOLF "get-annotations"
annotations = rc

say "  Annotations:" annotations.count

ADDRESS WOOLF "get-word-count"
stats = rc

say "  Final word count:" stats.total

say ""

/* Final Summary */
say "=========================================="
say "  CONCURRENT EDITING COMPLETE"
say "=========================================="
say ""

say "Demonstrated Capabilities:"
say "  ✓ Multi-user presence tracking"
say "  ✓ Range locks for conflict prevention"
say "  ✓ Cursor position awareness"
say "  ✓ Transaction-based atomic edits"
say "  ✓ Change history and versioning"
say "  ✓ Successful collaboration by" users.count "users"
say ""

say "Key Patterns Used:"
say "  • announce-presence: Register collaborators"
say "  • lock-range: Reserve editing regions"
say "  • begin-transaction/commit-transaction: Atomic multi-edits"
say "  • get-all-cursors: Awareness of other users"
say "  • get-history: Track all changes"
say ""

say "Best Practices:"
say "  1. Lock ranges before editing to prevent conflicts"
say "  2. Use transactions for multi-step edits"
say "  3. Always unlock ranges when done"
say "  4. Check active users before starting"
say "  5. Review change history regularly"
say ""

say "Real-World Applications:"
say "  • Multi-author book writing"
say "  • LLM-assisted content creation"
say "  • Collaborative screenplay development"
say "  • Technical documentation teams"
say "  • Student-teacher editing sessions"
say ""

say "=========================================="
