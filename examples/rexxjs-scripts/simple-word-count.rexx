/* Simple Word Count Example
 * A basic script to get the total word count
 */

/* Get the word count */
ADDRESS WOOLF "get-word-count"

/* Display the results */
say "Total Words:" rc.total
say "Total Chapters:" rc.chapters

/* Calculate average words per chapter */
if rc.chapters > 0 then
  average = rc.total / rc.chapters
else
  average = 0

say "Average Words per Chapter:" average
