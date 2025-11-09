# How to Connect a Remote LLM to WareWoolf

This guide explains how to connect a remote LLM (Python, Node.js, or any language) to WareWoolf for real-time collaborative editing with auto-corrections and alternates.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Connection Methods](#connection-methods)
- [Event Streaming](#event-streaming)
- [Sending Commands](#sending-commands)
- [Auto-Correction with Alternates](#auto-correction-with-alternates)
- [Example Implementations](#example-implementations)
- [UI Integration](#ui-integration)
- [Best Practices](#best-practices)

---

## Overview

WareWoolf supports **remote LLM connections** via the **Control Bus** with event streaming. This allows an LLM running in any language/process to:

1. **Watch typing in real-time** - receive change events as user types
2. **Analyze text** - detect spelling/grammar/style issues
3. **Auto-correct immediately** - apply fixes with alternates
4. **Provide hover options** - user can revert or pick alternates
5. **Work independently** - LLM makes decisions without 3GL code

### Key Features

✅ **Real-time event streaming** - get notified of every change
✅ **Cursor/selection tracking** - know where user is typing
✅ **Quick corrections** - apply fix immediately with alternates
✅ **Revert/alternate UI** - hover to undo or switch
✅ **Remote operation** - LLM runs anywhere, connects via WebSocket/HTTP
✅ **RexxJS commands** - LLM speaks WareWoolf's native language

---

## Architecture

```
┌─────────────────────────────────────┐
│      Remote LLM Process             │
│   (Python, Node, Go, etc.)          │
│                                     │
│  - Analyzes text                    │
│  - Detects errors                   │
│  - Sends corrections                │
└──────────┬──────────────────────────┘
           │
           │ WebSocket / HTTP / Server-Sent Events
           │
           ▼
┌─────────────────────────────────────┐
│   Control Bus Iframe                │
│  (woolf-controlbus-stream.js)       │
│                                     │
│  - Event streaming                  │
│  - Command routing                  │
└──────────┬──────────────────────────┘
           │
           │ postMessage API
           │
           ▼
┌─────────────────────────────────────┐
│      WareWoolf Application          │
│   (Electron + Quill Editor)         │
│                                     │
│  - OT Document Model                │
│  - Quick Corrections                │
│  - UI Rendering                     │
└─────────────────────────────────────┘
```

### Data Flow

**Typing Event:**
1. User types "similarley"
2. Quill editor fires change event
3. OT Document logs change
4. Control Bus streams event to iframe
5. Iframe forwards to remote LLM via WebSocket
6. LLM analyzes: "spelling error detected"
7. LLM sends correction command
8. Control Bus applies: "similarly" (+ "summarily" as alternate)
9. UI shows correction with hover for revert/alternate

---

## Quick Start

### 1. Set Up Control Bus Iframe

Create an HTML file that bridges WareWoolf and your LLM:

```html
<!-- llm-bridge.html -->
<!DOCTYPE html>
<html>
<head>
  <title>LLM Control Bridge</title>
  <script src="../src/components/controllers/woolf-controlbus-stream.js"></script>
</head>
<body>
  <h3>LLM Bridge Active</h3>
  <div id="status">Connecting...</div>

  <script>
    // Connect to WareWoolf
    const director = new WoolfDirectorBridgeStream(window.parent);

    // Connect to remote LLM (WebSocket example)
    const llmSocket = new WebSocket('ws://localhost:8765');

    // Register for event stream
    director.registerStream().then(streamId => {
      document.getElementById('status').textContent = 'Connected';

      // Forward WareWoolf events to LLM
      director.on('change', (change) => {
        llmSocket.send(JSON.stringify({
          type: 'document-change',
          change
        }));
      });

      director.on('cursor', (cursor) => {
        llmSocket.send(JSON.stringify({
          type: 'cursor-update',
          cursor
        }));
      });

      // Receive commands from LLM
      llmSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'execute-command') {
          const result = await director.run(message.command, message.params);

          // Send result back to LLM
          llmSocket.send(JSON.stringify({
            type: 'command-result',
            requestId: message.requestId,
            result
          }));
        }
      };
    });
  </script>
</body>
</html>
```

### 2. Load Bridge in WareWoolf

In your WareWoolf application (or demo page):

```html
<iframe src="llm-bridge.html" id="llm-bridge" style="width:300px;height:100px;"></iframe>
```

### 3. Implement Remote LLM

Here's a minimal Python LLM server:

```python
import asyncio
import websockets
import json

async def handle_client(websocket, path):
    async for message in websocket:
        data = json.loads(message)

        if data['type'] == 'document-change':
            # Analyze the change
            change = data['change']

            # Example: detect "teh" typo
            if change.get('text') == 'teh':
                # Send correction command
                await websocket.send(json.dumps({
                    'type': 'execute-command',
                    'requestId': 1,
                    'command': 'apply-quick-correction',
                    'params': {
                        'user-id': 'llm-spell-check',
                        'index': change['index'],
                        'length': 3,
                        'original': 'teh',
                        'correction': 'the',
                        'alternates': [],
                        'confidence': 0.99
                    }
                }))

# Start server
start_server = websockets.serve(handle_client, 'localhost', 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
```

---

## Connection Methods

### Method 1: WebSocket (Recommended)

**Best for:** Real-time bidirectional communication

**Bridge Side:**
```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onmessage = async (event) => {
  const cmd = JSON.parse(event.data);
  const result = await director.run(cmd.command, cmd.params);
  ws.send(JSON.stringify({ result }));
};

director.on('change', (change) => {
  ws.send(JSON.stringify({ type: 'change', change }));
});
```

**LLM Side (Python):**
```python
import websockets

async def llm_handler(websocket, path):
    async for message in websocket:
        data = json.loads(message)

        if data['type'] == 'change':
            # Analyze and respond
            correction = analyze(data['change'])
            await websocket.send(json.dumps({
                'command': 'apply-quick-correction',
                'params': correction
            }))
```

### Method 2: Server-Sent Events (SSE)

**Best for:** One-way streaming from WareWoolf to LLM

**Bridge Side:**
```javascript
// Send events to LLM endpoint
director.on('change', (change) => {
  fetch('http://localhost:5000/events', {
    method: 'POST',
    body: JSON.stringify({ type: 'change', change })
  });
});
```

**LLM Side (Node.js):**
```javascript
app.post('/events', async (req, res) => {
  const { type, change } = req.body;

  if (type === 'change') {
    const correction = await analyzeText(change);

    // Send command back via webhook or WebSocket
    sendCommand('apply-quick-correction', correction);
  }

  res.sendStatus(200);
});
```

### Method 3: HTTP Polling (Simple but Less Efficient)

**Bridge Side:**
```javascript
// Poll LLM for commands every 500ms
setInterval(async () => {
  const response = await fetch('http://localhost:5000/get-commands');
  const commands = await response.json();

  for (const cmd of commands) {
    await director.run(cmd.command, cmd.params);
  }
}, 500);

// Push changes to LLM
director.on('change', (change) => {
  fetch('http://localhost:5000/changes', {
    method: 'POST',
    body: JSON.stringify(change)
  });
});
```

---

## Event Streaming

### Available Events

#### 1. **initial-state** (on connect)

Sent when LLM first registers for streaming:

```javascript
director.on('initial-state', (state) => {
  console.log('Document version:', state.version);
  console.log('Document ID:', state.documentId);
  console.log('Active users:', state.activeUsers);
});
```

**State object:**
```json
{
  "version": 42,
  "documentId": "my-novel-123",
  "length": 5000,
  "activeUsers": [
    { "userId": "alice", "userName": "Alice", "userType": "human" }
  ],
  "metadata": { "documentId": "...", "version": 42, "length": 5000 }
}
```

#### 2. **change** (on every edit)

Sent whenever document changes:

```javascript
director.on('change', (change) => {
  console.log('Operation:', change.operation); // insert, delete, replace
  console.log('Position:', change.index);
  console.log('Text:', change.text);
  console.log('User:', change.userId);
});
```

**Change object:**
```json
{
  "version": 43,
  "operation": "insert",
  "index": 150,
  "text": "similarley",
  "userId": "alice",
  "timestamp": 1704123456789
}
```

#### 3. **cursor** (on cursor movement)

Sent when user moves cursor:

```javascript
director.on('cursor', (cursor) => {
  console.log('User:', cursor.userId);
  console.log('Position:', cursor.cursor.index);
});
```

#### 4. **suggestion** (when LLM creates suggestion)

Sent when any LLM creates a suggestion:

```javascript
director.on('suggestion', (suggestion) => {
  console.log('Suggestion ID:', suggestion.suggestionId);
  console.log('Proposed change:', suggestion.oldText, '→', suggestion.newText);
});
```

### Filtering Events

You can filter events when registering:

```javascript
// Only receive changes from specific user
director.registerStream({ userId: 'alice' });

// Custom filter
director.registerStream({
  userId: 'alice',
  // Add more filters as needed
});
```

---

## Sending Commands

### Quick Correction (Auto-Apply with Alternates)

This is the **recommended** method for spelling/grammar fixes:

```javascript
// LLM detects "similarley" typo
await director.run('apply-quick-correction', {
  'user-id': 'llm-autocorrect',
  'index': 145,           // Position of error
  'length': 10,           // Length of "similarley"
  'original': 'similarley', // What user typed
  'correction': 'similarly', // Main fix
  'alternates': ['summarily'], // Other options
  'confidence': 0.92,
  'type': 'spelling'
});
```

**Result:**
- Text immediately changes to "similarly"
- Correction stored with ID
- UI can show hover to revert or pick "summarily"

### Revert Correction

```javascript
// User wants original back
await director.run('revert-correction', {
  'correction-id': 5,
  'user-id': 'alice'
});
```

### Switch to Alternate

```javascript
// User picks "summarily" instead
await director.run('switch-to-alternate', {
  'correction-id': 5,
  'alternate-index': 0,  // "summarily" is first alternate
  'user-id': 'alice'
});
```

### Get Correction at Cursor

```javascript
// Check if cursor is on a correction
const result = await director.run('get-correction-at', {
  'index': 150
});

if (result.correction) {
  console.log('Original:', result.correction.original);
  console.log('Applied:', result.correction.applied);
  console.log('Alternates:', result.correction.alternates);
}
```

### Other Useful Commands

```javascript
// Get document context around error
const context = await director.run('get-context-around', {
  'index': 150,
  'context-size': 50
});

// Find all instances of a pattern
const results = await director.run('find-pattern', {
  'pattern': '\\b\\w+ley\\b',  // Words ending in "ley"
  'case-insensitive': 'true'
});

// Replace a range
await director.run('replace-range', {
  'index': 100,
  'length': 5,
  'text': 'fixed',
  'user-id': 'llm'
});
```

---

## Auto-Correction with Alternates

### The iOS-Style Correction Flow

**Problem:** iOS autocorrect lacks good undo - hard to see what changed or pick alternates.

**WareWoolf Solution:**

1. **LLM detects error** - "similarley"
2. **LLM provides options** - main: "similarly", alternate: "summarily"
3. **Auto-apply immediately** - text changes to "similarly"
4. **UI shows indicator** - underline or marker on correction
5. **Hover reveals options:**
   - ↺ Revert to "similarley" (original)
   - ↻ Switch to "summarily" (alternate)
6. **Click to apply** - or leave correction as-is

### Implementation Example

**LLM Side (Python):**

```python
async def analyze_word(word, position):
    """Analyze a word for spelling/grammar issues"""

    # Check if it's a known typo
    if word in COMMON_TYPOS:
        main_fix = COMMON_TYPOS[word]
        alternates_with_confidence = get_alternates(word)

        # Extract just the alternate words and confidence scores
        alternates = [alt for alt, _ in alternates_with_confidence]
        alternate_confidences = [conf for _, conf in alternates_with_confidence]

        return {
            'command': 'apply-quick-correction',
            'params': {
                'user-id': 'llm-autocorrect',
                'index': position,
                'length': len(word),
                'original': word,
                'correction': main_fix,
                'alternates': alternates,
                'confidence': 0.95,
                'alternate-confidences': alternate_confidences,
                'type': 'spelling'
            }
        }

    # Check for style issues
    if word == 'very':
        return {
            'command': 'apply-quick-correction',
            'params': {
                'user-id': 'llm-style',
                'index': position,
                'length': 4,
                'original': 'very',
                'correction': 'extremely',
                'alternates': ['remarkably', 'significantly'],
                'confidence': 0.75,
                'alternate-confidences': [0.72, 0.68],
                'type': 'style'
            }
        }

    return None
```

**Dictionary Example:**

```python
COMMON_TYPOS = {
    'teh': 'the',
    'recieve': 'receive',
    'occured': 'occurred',
    'similarley': 'similarly',
    'definately': 'definitely',
}

def get_alternates(word):
    """Get alternate corrections with confidence scores"""
    # Format: word -> [(alternate, confidence), ...]
    alternates_map = {
        'similarley': [('summarily', 0.78)],
        'very': [('extremely', 0.85), ('remarkably', 0.72)],
        # ...
    }
    return alternates_map.get(word, [])
```

### Single-Word Analysis Pattern

```python
async def handle_change(change):
    """Handle each change event"""

    # Only analyze insertions (typing)
    if change['operation'] != 'insert':
        return

    # Get the inserted text
    text = change['text']

    # Check if it's a word boundary (space, punctuation)
    if text in [' ', '.', ',', '\n']:
        # User just finished a word - analyze the word before cursor
        position = change['index'] - 1

        # Get context to extract the word
        context = await director.run('get-context-around', {
            'index': position,
            'context-size': 20
        })

        # Extract the word (simple: split on whitespace)
        word = context['before'].split()[-1] if context['before'] else ''

        if word:
            # Analyze the word
            correction = await analyze_word(word, position - len(word) + 1)

            if correction:
                # Send correction command
                await websocket.send(json.dumps(correction))
```

---

## Example Implementations

### Example 1: Python WebSocket LLM

```python
#!/usr/bin/env python3
"""
WareWoolf Remote LLM - Spelling & Grammar Checker
Connects via WebSocket, watches typing, auto-corrects with alternates
"""

import asyncio
import websockets
import json
import re

# Spelling corrections
CORRECTIONS = {
    'teh': ('the', []),
    'recieve': ('receive', []),
    'similarley': ('similarly', ['summarily']),
    'definately': ('definitely', []),
    'occured': ('occurred', []),
}

# Style improvements
STYLE_FIXES = {
    'very': ('extremely', ['remarkably', 'significantly']),
    'really': ('truly', ['genuinely']),
}

async def llm_handler(websocket, path):
    """Handle connection from WareWoolf bridge"""

    print("LLM connected to WareWoolf")
    request_id = 0

    async for message in websocket:
        data = json.loads(message)

        # Handle document changes
        if data.get('type') == 'document-change':
            change = data['change']

            # Only analyze insertions
            if change['operation'] == 'insert':
                text = change.get('text', '')

                # Check if user just finished a word
                if text in [' ', '.', ',', '\n', '!', '?']:
                    # Request context to get the word
                    request_id += 1
                    await websocket.send(json.dumps({
                        'type': 'execute-command',
                        'requestId': request_id,
                        'command': 'get-context-around',
                        'params': {
                            'index': change['index'] - 1,
                            'context-size': 30
                        }
                    }))

        # Handle command results
        elif data.get('type') == 'command-result':
            result = data['result']

            # Extract last word from context
            if 'before' in result:
                words = re.findall(r'\b\w+\b', result['before'])
                if words:
                    last_word = words[-1]
                    word_end = result['index']
                    word_start = word_end - len(last_word)

                    # Check for correction
                    correction = check_word(last_word)

                    if correction:
                        request_id += 1
                        await websocket.send(json.dumps({
                            'type': 'execute-command',
                            'requestId': request_id,
                            'command': 'apply-quick-correction',
                            'params': {
                                'user-id': 'llm-autocorrect',
                                'index': word_start,
                                'length': len(last_word),
                                'original': last_word,
                                'correction': correction[0],
                                'alternates': correction[1],
                                'confidence': correction[2],
                                'type': correction[3]
                            }
                        }))

                        print(f"✓ Corrected '{last_word}' → '{correction[0]}'")

def check_word(word):
    """Check if word needs correction"""

    word_lower = word.lower()

    # Check spelling
    if word_lower in CORRECTIONS:
        fix, alts = CORRECTIONS[word_lower]
        return (fix, alts, 0.99, 'spelling')

    # Check style
    if word_lower in STYLE_FIXES:
        fix, alts = STYLE_FIXES[word_lower]
        return (fix, alts, 0.75, 'style')

    return None

# Start WebSocket server
print("Starting LLM server on ws://localhost:8765")
start_server = websockets.serve(llm_handler, 'localhost', 8765)

asyncio.get_event_loop().run_until_complete(start_server)
print("LLM ready. Waiting for WareWoolf connection...")
asyncio.get_event_loop().run_forever()
```

### Example 2: Node.js HTTP LLM

```javascript
// llm-server.js
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');

const app = express();
app.use(bodyParser.json());

// Store pending commands to send to WareWoolf
let pendingCommands = [];

// Spelling dictionary
const corrections = {
  'teh': { fix: 'the', alternates: [] },
  'similarley': { fix: 'similarly', alternates: ['summarily'] },
  'recieve': { fix: 'receive', alternates: [] },
};

// Receive change events from WareWoolf
app.post('/events', (req, res) => {
  const { type, change } = req.body;

  if (type === 'change' && change.operation === 'insert') {
    const text = change.text;

    // Word boundary - analyze previous word
    if ([' ', '.', ',', '\n'].includes(text)) {
      // Request context
      pendingCommands.push({
        command: 'get-context-around',
        params: {
          'index': change.index - 1,
          'context-size': 30
        },
        callback: (result) => {
          const words = result.before.match(/\b\w+\b/g) || [];
          const lastWord = words[words.length - 1];

          if (lastWord && corrections[lastWord.toLowerCase()]) {
            const corr = corrections[lastWord.toLowerCase()];

            pendingCommands.push({
              command: 'apply-quick-correction',
              params: {
                'user-id': 'llm-node',
                'index': result.index - lastWord.length,
                'length': lastWord.length,
                'original': lastWord,
                'correction': corr.fix,
                'alternates': corr.alternates,
                'confidence': 0.95,
                'type': 'spelling'
              }
            });
          }
        }
      });
    }
  }

  res.sendStatus(200);
});

// WareWoolf polls for commands
app.get('/commands', (req, res) => {
  const commands = pendingCommands.splice(0); // Get and clear
  res.json(commands);
});

app.listen(5000, () => {
  console.log('LLM server running on http://localhost:5000');
});
```

---

## UI Integration

### Hover UI for Corrections

The tooltip shows the current correction with confidence, plus options to revert or pick alternates:

```
┌──────────────────────────────┐
│ similarly      92% ✓         │ (currently applied)
├──────────────────────────────┤
│ ↺ similarley    (original)   │ (revert to what user typed)
│ ↻ summarily        78%       │ (alternate suggestion)
└──────────────────────────────┘
```

**Visual breakdown:**
- **Top row** (blue background): Currently applied correction with confidence and checkmark
- **Middle row**: Revert to original (no confidence - it's the user's text)
- **Bottom rows**: Alternates with their own confidence scores

To show revert/alternate options on hover, add UI code to WareWoolf:

```javascript
// In WareWoolf application
function setupCorrectionUI() {
  const editor = document.querySelector('.ql-editor');

  // Show correction tooltip on hover
  editor.addEventListener('mouseover', async (e) => {
    const index = quill.getSelection()?.index || 0;

    // Check if hovering over a correction
    const result = await window.ADDRESS_WOOLF.run('get-correction-at', {
      index
    });

    if (result.correction) {
      showCorrectionTooltip(e.clientX, e.clientY, result.correction);
    }
  });
}

function showCorrectionTooltip(x, y, correction) {
  const tooltip = document.createElement('div');
  tooltip.className = 'correction-tooltip';
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';

  // Get confidence score (0-1 float)
  const confidence = correction.metadata?.confidence || 0;
  const confidencePercent = Math.round(confidence * 100);

  // Current applied correction (show as selected)
  const current = document.createElement('div');
  current.className = 'correction-current';
  current.innerHTML = `
    <strong>${correction.applied}</strong>
    <span class="confidence">${confidencePercent}%</span>
    <span class="checkmark">✓</span>
  `;
  tooltip.appendChild(current);

  // Divider
  const divider = document.createElement('hr');
  tooltip.appendChild(divider);

  // Revert button (back to original)
  const revert = document.createElement('button');
  revert.className = 'correction-option';
  revert.innerHTML = `
    <span class="icon">↺</span>
    <span class="text">${correction.original}</span>
    <span class="label">(original)</span>
  `;
  revert.onclick = async () => {
    await window.ADDRESS_WOOLF.run('revert-correction', {
      'correction-id': correction.correctionId,
      'user-id': 'alice'
    });
    tooltip.remove();
  };
  tooltip.appendChild(revert);

  // Alternate buttons with confidence scores
  correction.alternates.forEach((alt, i) => {
    const btn = document.createElement('button');
    btn.className = 'correction-option';

    // Get alternate-specific confidence if available
    const altConfidence = correction.metadata?.alternateConfidences?.[i];
    const altConfidenceHTML = altConfidence
      ? `<span class="confidence">${Math.round(altConfidence * 100)}%</span>`
      : `<span class="confidence dim">—</span>`;

    btn.innerHTML = `
      <span class="icon">↻</span>
      <span class="text">${alt}</span>
      ${altConfidenceHTML}
    `;
    btn.onclick = async () => {
      await window.ADDRESS_WOOLF.run('switch-to-alternate', {
        'correction-id': correction.correctionId,
        'alternate-index': i,
        'user-id': 'alice'
      });
      tooltip.remove();
    };
    tooltip.appendChild(btn);
  });

  document.body.appendChild(tooltip);
}
```

### CSS for Correction Indicators

```css
/* Underline corrected text */
.correction-applied {
  border-bottom: 2px dotted #4CAF50;
  cursor: pointer;
}

/* Tooltip styles */
.correction-tooltip {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  padding: 0;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  min-width: 220px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* Current applied correction */
.correction-current {
  padding: 10px 12px;
  background: #f0f9ff;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.correction-current strong {
  flex: 1;
  color: #1976d2;
}

.correction-current .confidence {
  color: #1976d2;
  font-weight: 600;
  font-size: 12px;
}

.correction-current .checkmark {
  color: #4CAF50;
  font-size: 16px;
}

/* Divider */
.correction-tooltip hr {
  margin: 0;
  border: none;
  border-top: 1px solid #e0e0e0;
}

/* Option buttons */
.correction-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: white;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  transition: background 0.2s;
}

.correction-option:first-of-type {
  border-radius: 0;
}

.correction-option:last-of-type {
  border-radius: 0 0 6px 6px;
}

.correction-option:hover {
  background: #f5f5f5;
}

.correction-option .icon {
  color: #666;
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.correction-option .text {
  flex: 1;
  color: #333;
}

.correction-option .label {
  color: #999;
  font-size: 12px;
  font-style: italic;
}

.correction-option .confidence {
  color: #666;
  font-weight: 600;
  font-size: 12px;
  min-width: 35px;
  text-align: right;
}

.correction-option .confidence.dim {
  color: #ccc;
}
```

---

## Best Practices

### 1. **Debounce Corrections**

**Critical UX principle:** Don't correct while user is actively typing!

Apply corrections only when:
- **5 seconds** have passed since the word was completed, OR
- User has typed **3+ more characters** (moved on to next word/sentence)

This prevents jarring mid-typing corrections and feels natural.

```python
# Track word positions that need checking
pending_corrections = {}  # {position: (word, timestamp)}
DEBOUNCE_DELAY = 5.0  # 5 seconds
CURSOR_DISTANCE = 3   # 3+ characters away

async def handle_change(change):
    """Handle each change event with smart debouncing"""

    # Word boundary - user finished typing a word
    if change['operation'] == 'insert' and is_word_boundary(change['text']):
        # Get the word that was just completed
        word_position = change['index'] - 1
        context = await get_context(word_position)
        word = extract_last_word(context)

        if needs_correction(word):
            # Schedule for checking (don't apply immediately!)
            pending_corrections[word_position] = {
                'word': word,
                'timestamp': time.time(),
                'checked': False
            }

    # Check pending corrections (run periodically)
    await check_pending_corrections(change['index'])

async def check_pending_corrections(current_cursor):
    """Apply corrections when conditions are met"""

    now = time.time()

    for position, pending in list(pending_corrections.items()):
        if pending['checked']:
            continue

        # Condition 1: 5 seconds have passed
        time_elapsed = now - pending['timestamp']

        # Condition 2: User has moved 3+ characters away
        cursor_distance = abs(current_cursor - position)

        if time_elapsed >= DEBOUNCE_DELAY or cursor_distance >= CURSOR_DISTANCE:
            # Safe to apply correction now
            await apply_correction(position, pending['word'])
            pending['checked'] = True

            # Clean up old entries
            if time_elapsed > 60:  # Remove after 1 minute
                del pending_corrections[position]

def is_word_boundary(char):
    return char in [' ', '.', ',', '\n', '!', '?', ';', ':', '-']
```

**Example timeline:**

```
00:00  User types: "similarley"
00:00  User types: " " (space - word complete)
       → LLM detects typo, schedules correction
00:00  User types: "to"
       → Cursor now 3 chars away from "similarley"
       → Correction applied! "similarley" → "similarly"
00:01  User continues typing normally
```

Or:

```
00:00  User types: "similarley"
00:00  User types: " " (space - word complete)
       → LLM detects typo, schedules correction
00:00  User pauses to think...
00:05  5 seconds elapsed, no more typing
       → Correction applied! "similarley" → "similarly"
```

### 2. **Single-Word Analysis**

Analyze words as they're completed (more efficient than whole document):

```python
def is_word_boundary(char):
    return char in [' ', '.', ',', '\n', '!', '?', ';', ':', '-']

async def handle_insert(change):
    if is_word_boundary(change['text']):
        # User just finished a word
        await analyze_previous_word(change['index'])
```

### 3. **Confidence Thresholds**

Only auto-apply high-confidence corrections:

```python
async def apply_if_confident(word, fix, alternates, confidence):
    if confidence >= 0.90:
        # Auto-apply spelling corrections
        await apply_quick_correction(word, fix, alternates, 'spelling')
    elif confidence >= 0.70:
        # Create suggestion for review
        await suggest_edit(word, fix, alternates, 'style')
    else:
        # Too uncertain - skip
        pass
```

### 4. **Limit Correction History**

Prevent memory bloat:

```python
# In LLM
MAX_CORRECTIONS = 100
corrections_applied = []

async def apply_correction(correction):
    corrections_applied.append(correction)

    # Keep only last 100
    if len(corrections_applied) > MAX_CORRECTIONS:
        corrections_applied.pop(0)
```

WareWoolf automatically keeps only last 100 corrections in `WoolfOTDocument`.

### 5. **Handle Network Failures**

```python
async def send_command(command, params):
    retries = 3

    for attempt in range(retries):
        try:
            await websocket.send(json.dumps({
                'type': 'execute-command',
                'command': command,
                'params': params
            }))
            return
        except Exception as e:
            if attempt == retries - 1:
                print(f"Failed to send command: {e}")
            await asyncio.sleep(1.0)
```

### 6. **Log Corrections for Learning**

```python
import logging

logging.basicConfig(filename='corrections.log', level=logging.INFO)

async def log_correction(original, correction, accepted):
    logging.info(json.dumps({
        'timestamp': time.time(),
        'original': original,
        'correction': correction,
        'accepted': accepted  # Did user keep it or revert?
    }))
```

### 7. **Respect User Preferences**

```python
user_preferences = {
    'auto_correct_spelling': True,
    'auto_correct_grammar': False,
    'suggest_style': True,
}

async def should_apply_auto(correction_type):
    if correction_type == 'spelling':
        return user_preferences['auto_correct_spelling']
    elif correction_type == 'grammar':
        return user_preferences['auto_correct_grammar']
    else:
        return False
```

---

## Troubleshooting

### Events Not Streaming

**Problem:** LLM not receiving change events

**Solutions:**
- Check iframe is loaded: `console.log(director)`
- Verify stream registered: `await director.registerStream()`
- Check WebSocket connection: `ws.readyState === WebSocket.OPEN`
- Check browser console for errors

### Commands Not Executing

**Problem:** LLM sends command but nothing happens

**Solutions:**
- Verify command syntax matches docs
- Check params use correct format (`'user-id'` not `'userId'`)
- Use `await director.run()` - don't forget await
- Check WareWoolf console for errors

### Corrections Applied Twice

**Problem:** Same word corrected multiple times

**Solutions:**
- Debounce: wait for typing to pause
- Track corrected positions to avoid re-checking
- Check for duplicate change events

### UI Not Showing Hover

**Problem:** Can't see revert/alternate options

**Solutions:**
- Implement UI code (not automatic)
- Use `get-correction-at` to check cursor position
- Render tooltip with correction info
- Add CSS for visual indicators

---

## Next Steps

### Extend Your LLM

1. **Grammar checking** - use language model for complex grammar
2. **Context-aware fixes** - analyze surrounding text
3. **Learn from user** - track which corrections are reverted
4. **Style consistency** - enforce style guide rules
5. **Multi-language** - support multiple languages

### Advanced Features

- **Voice typing integration** - correct voice-to-text errors
- **Markdown awareness** - don't correct code blocks
- **Domain-specific** - medical/legal term handling
- **Collaborative filters** - different rules per user type

---

## Resources

- **WOOLF_COMMANDS.md** - Complete command reference
- **OT_COLLABORATION_GUIDE.md** - Collaboration patterns
- **examples/rexxjs-scripts/** - Example scripts
- **CONTROL_BUS_IFRAME_PATTERNS.md** - Control bus details

---

## License

This guide is part of WareWoolf and shares its MIT license.

---

**Happy Auto-Correcting!** 🤖✍️
