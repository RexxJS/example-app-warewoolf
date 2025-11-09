/* WareWoolf Word Count Report Generator
 * Generates a detailed word count report for all chapters
 */

say "==============================================="
say "     WAREWOOLF WORD COUNT REPORT"
say "==============================================="
say ""

/* Get total word count */
ADDRESS WOOLF "get-word-count"
overall = rc
say "Total Words:" overall.total
say "Total Chapters:" overall.chapters
say ""

/* Calculate average */
if overall.chapters > 0 then
  average = overall.total / overall.chapters
else
  average = 0

say "Average Words Per Chapter:" average
say ""
say "-----------------------------------------------"
say "CHAPTER BREAKDOWN"
say "-----------------------------------------------"
say ""

/* Get list of all chapters */
ADDRESS WOOLF "list-chapters"
chapters = rc

/* Iterate through each chapter */
total_verified = 0
do i = 0 to chapters.length - 1
  ADDRESS WOOLF "get-chapter-word-count number=" || i
  stats = rc

  say i + 1 "." stats.title
  say "   Words:" stats.words

  /* Calculate percentage of total */
  if overall.total > 0 then
    percentage = (stats.words / overall.total) * 100
  else
    percentage = 0

  say "   Percentage:" percentage "%"

  /* Flag chapters that are unusually short or long */
  if stats.words < (average * 0.5) & average > 0 then
    say "   [NOTE: Shorter than average]"
  else if stats.words > (average * 1.5) then
    say "   [NOTE: Longer than average]"

  say ""
  total_verified = total_verified + stats.words
end

say "==============================================="
say "Report generated successfully!"
say "==============================================="
