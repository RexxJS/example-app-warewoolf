/* Spell-Check Bot
 * Watches for common misspellings and creates suggestions
 *
 * This script demonstrates:
 * - Real-time document monitoring
 * - Pattern-based error detection
 * - Creating suggestions with high confidence
 * - Polling-based change detection
 */

say "=========================================="
say "  SPELL-CHECK BOT"
say "=========================================="
say ""

/* Part 1: Announce Bot Presence */
ADDRESS WOOLF "announce-presence user-id=spell-bot user-name=SpellBot user-type=llm"
presence = rc

say "Bot registered:" presence.userName
say "Document ID:" presence.documentId
say ""

/* Part 2: Define Common Misspellings */
say "Loading spelling corrections..."

/* Format: "wrong correct" */
corrections.1 = "teh the"
corrections.2 = "recieve receive"
corrections.3 = "occured occurred"
corrections.4 = "occuring occurring"
corrections.5 = "thier their"
corrections.6 = "wierd weird"
corrections.7 = "definately definitely"
corrections.8 = "seperate separate"
corrections.9 = "untill until"
corrections.10 = "similiar similar"
corrections.11 = "similarley similarly"
corrections.12 = "experiance experience"
corrections.13 = "occassion occasion"
corrections.14 = "necesary necessary"
corrections.15 = "begining beginning"

correction_count = 15

say "Loaded" correction_count "common misspellings"
say ""

/* Part 3: Main Monitoring Loop */
say "Starting spell-check monitor..."
say "Press Ctrl+C to stop"
say ""

check_interval = 2  /* Check every 2 seconds */
total_suggestions = 0

do forever
  /* Check each known misspelling */
  do i = 1 to correction_count
    parse var corrections.i wrong correct

    /* Search for this misspelling (case-insensitive word boundary) */
    ADDRESS WOOLF "find-pattern pattern=\\b" || wrong || "\\b case-insensitive=true"
    results = rc

    if results.count > 0 then do
      /* Found one or more instances */
      say "Found" results.count "instance(s) of '" || wrong || "'"

      /* Create suggestion for first occurrence */
      match = results.matches[0]

      ADDRESS WOOLF "suggest-edit" ,
        "user-id=spell-bot" ,
        "index=" || match.index ,
        "length=" || length(wrong) ,
        "new-text=" || correct ,
        "confidence=0.99" ,
        "reasoning=Spelling: '" || wrong || "' should be '" || correct || "'"

      suggestion = rc

      say "  → Created suggestion ID:" suggestion.suggestionId
      say "     Position:" match.index
      say "     Change: '" || wrong || "' → '" || correct || "'"

      total_suggestions = total_suggestions + 1
    end
  end

  /* Show status */
  ADDRESS WOOLF "get-suggestions status=pending"
  pending = rc

  if pending.count > 0 then do
    say ""
    say "Status: " pending.count "pending suggestion(s)"
    say "Total suggestions created:" total_suggestions
  end

  /* Wait before next check */
  call sleep check_interval
end

/* Sleep function (if available in RexxJS) */
sleep: procedure
  arg seconds
  /* Implementation depends on RexxJS environment */
  /* For now, this is a placeholder */
  return

/* Note: In a real implementation, you'd want:
 * 1. Subscribe to change events instead of polling
 * 2. Only check recently changed text
 * 3. Debouncing to avoid checking while user is typing
 * 4. Auto-accept very high confidence suggestions
 */
