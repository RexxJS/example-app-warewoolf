/* WareWoolf Chapter Statistics Analyzer
 * Analyzes chapter lengths and identifies outliers
 */

say "==============================================="
say "     CHAPTER STATISTICS ANALYZER"
say "==============================================="
say ""

/* Get all chapters */
ADDRESS WOOLF "list-chapters"
chapters = rc

if chapters.length = 0 then do
  say "No chapters found in project."
  exit
end

say "Analyzing" chapters.length "chapter(s)..."
say ""

/* Initialize tracking variables */
total_words = 0
max_words = 0
min_words = 999999999
max_chapter = ""
min_chapter = ""
max_index = -1
min_index = -1

/* Analyze each chapter */
do i = 0 to chapters.length - 1
  ADDRESS WOOLF "get-chapter-word-count number=" || i
  stats = rc

  words = stats.words
  total_words = total_words + words

  /* Track maximum */
  if words > max_words then do
    max_words = words
    max_chapter = stats.title
    max_index = i
  end

  /* Track minimum */
  if words < min_words then do
    min_words = words
    min_chapter = stats.title
    min_index = i
  end
end

/* Calculate statistics */
average = total_words / chapters.length
variance = 0

/* Calculate variance */
do i = 0 to chapters.length - 1
  ADDRESS WOOLF "get-chapter-word-count number=" || i
  stats = rc
  diff = stats.words - average
  variance = variance + (diff * diff)
end

variance = variance / chapters.length
std_dev = sqrt(variance)

/* Display results */
say "OVERALL STATISTICS"
say "-----------------------------------------------"
say "Total Chapters:" chapters.length
say "Total Words:" total_words
say "Average Words per Chapter:" average
say "Standard Deviation:" std_dev
say ""

say "EXTREMES"
say "-----------------------------------------------"
say "Longest Chapter: #" || (max_index + 1) max_chapter
say "  Word Count:" max_words
say "  Deviation: +" || (max_words - average) "words from average"
say ""
say "Shortest Chapter: #" || (min_index + 1) min_chapter
say "  Word Count:" min_words
say "  Deviation: -" || (average - min_words) "words from average"
say ""

say "OUTLIER ANALYSIS"
say "-----------------------------------------------"

/* Identify outliers (more than 1.5 standard deviations from mean) */
outliers_found = 0
do i = 0 to chapters.length - 1
  ADDRESS WOOLF "get-chapter-word-count number=" || i
  stats = rc

  deviation = abs(stats.words - average)

  if deviation > (1.5 * std_dev) then do
    outliers_found = outliers_found + 1
    say "Chapter #" || (i + 1) ":" stats.title
    say "  Words:" stats.words

    if stats.words > average then
      say "  Status: LONGER than average by" (stats.words - average)
    else
      say "  Status: SHORTER than average by" (average - stats.words)

    say ""
  end
end

if outliers_found = 0 then
  say "No significant outliers detected."
else
  say "Found" outliers_found "outlier(s)."

say ""
say "==============================================="
say "Analysis complete!"
say "==============================================="

/* Helper function to calculate absolute value */
abs: procedure
  arg x
  if x < 0 then
    return -x
  else
    return x

/* Helper function to calculate square root (Newton's method) */
sqrt: procedure
  arg x

  if x = 0 then
    return 0

  if x < 0 then
    return -1  /* Error: negative */

  /* Initial guess */
  guess = x / 2

  /* Iterate to improve guess */
  do i = 1 to 20
    new_guess = (guess + (x / guess)) / 2

    /* Check convergence */
    if abs(new_guess - guess) < 0.0001 then
      return new_guess

    guess = new_guess
  end

  return guess
