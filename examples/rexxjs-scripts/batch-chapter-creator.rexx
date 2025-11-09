/* WareWoolf Batch Chapter Creator
 * Creates multiple chapters from a predefined outline
 */

say "WareWoolf Batch Chapter Creator"
say "================================"
say ""

/* Define your chapter outline here */
chapters.1 = "Chapter 1: The Journey Begins"
chapters.2 = "Chapter 2: Crossing the Threshold"
chapters.3 = "Chapter 3: Tests and Allies"
chapters.4 = "Chapter 4: The Approach"
chapters.5 = "Chapter 5: The Ordeal"
chapters.6 = "Chapter 6: The Reward"
chapters.7 = "Chapter 7: The Road Back"
chapters.8 = "Chapter 8: The Resurrection"
chapters.9 = "Chapter 9: Return with the Elixir"

num_chapters = 9

say "Creating" num_chapters "chapters..."
say ""

/* Create each chapter */
do i = 1 to num_chapters
  say "Creating:" chapters.i
  ADDRESS WOOLF "add-chapter title=" || chapters.i

  if rc.success then
    say "  ✓ Created successfully"
  else
    say "  ✗ Failed to create"

  say ""
end

say "================================"
say "Batch creation complete!"
say num_chapters "chapters created."
say ""
say "Use ADDRESS WOOLF 'list-chapters' to verify."
