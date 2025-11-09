# Control Bus iframe Patterns for WareWoolf

## Overview

This document describes the RexxJS control bus architecture patterns incorporated into WareWoolf, based on the proven patterns from the RexxJS calculator multi-instance example.

## Architecture Inspiration

The implementation follows patterns established in:
- `test-harness-multi-instance.html` - Multi-instance message broker
- `mostly-rexx-calculator-app.html` - Service with multiple protocols
- `calculator-automation.rexx` - Automated control via INTERPRET_JS

## Key Patterns Implemented

### 1. Service Identification Pattern

**Problem**: In multi-instance scenarios, messages need to be routed to the correct service.

**Solution**: Each service has a unique `serviceId` that's included in all responses.

```javascript
class WoolfWorkerBridge {
  constructor(addressWoolf, serviceId = 'warewoolf') {
    this.serviceId = serviceId;
    // ...
  }

  async handleControlMessage(event) {
    // Include serviceId in response
    event.source.postMessage({
      type: 'woolf-control-response',
      serviceId: this.serviceId,  // Identifies which service responded
      success: true,
      result
    }, event.origin);
  }
}
```

**Benefits**:
- Enables multiple WareWoolf instances in the same page
- Message broker can route responses correctly
- Clients can verify they're talking to the right service

**Example Usage**:
```html
<!-- Multiple instances with different service IDs -->
<iframe id="woolf-1" data-service-id="warewoolf-1"></iframe>
<iframe id="woolf-2" data-service-id="warewoolf-2"></iframe>
```

---

### 2. Multiple Protocol Support

**Problem**: Different use cases require different communication patterns.

**Solution**: Support multiple protocols for flexibility:

#### Protocol A: Simple Control Messages
```javascript
{
  type: 'woolf-control',
  command: 'get-word-count',
  params: {},
  requestId: 1
}
```

**Use case**: Simple command-response pattern, easy to understand and debug.

#### Protocol B: JSON-RPC 2.0
```javascript
{
  jsonrpc: '2.0',
  id: 1,
  method: 'get-word-count',
  params: {}
}
```

**Use case**: Standard RPC protocol, compatible with existing tools and libraries.

#### Protocol C: INTERPRET_JS
```javascript
{
  type: 'interpret-js-request',
  code: 'document.querySelector(".ql-editor").textContent',
  requestId: 1
}
```

**Use case**: Direct DOM inspection and manipulation from RexxJS scripts.

**Implementation**:
```javascript
async handleMessage(event) {
  const { data } = event;

  // Route to appropriate handler based on message type
  if (data && data.type === 'woolf-control') {
    await this.handleControlMessage(event);
  } else if (data && data.jsonrpc === '2.0') {
    await this.handleJsonRpc(event);
  } else if (data && data.type === 'interpret-js-request') {
    await this.handleInterpretJs(event);
  }
}
```

---

### 3. INTERPRET_JS Pattern

**Inspiration**: Calculator automation script uses `INTERPRET_JS()` to read DOM state.

**Pattern**: Allow RexxJS scripts to execute JavaScript in the target frame and receive results.

**Example from calculator automation**:
```rexx
/* Read calculator display */
LET display_value = INTERPRET_JS("document.getElementById('box').textContent")
```

**WareWoolf implementation**:
```rexx
/* Read editor content */
LET content = INTERPRET_JS("document.querySelector('.ql-editor').textContent")
say "Current content:" content

/* Check editor focus */
LET has_focus = INTERPRET_JS("document.activeElement.classList.contains('ql-editor')")
say "Editor focused:" has_focus

/* Get editor dimensions */
LET width = INTERPRET_JS("document.querySelector('.ql-editor').offsetWidth")
say "Editor width:" width "px"
```

**Why this is powerful**:
- Scripts can inspect any DOM state
- No need to expose every possible query as a command
- Enables exploratory automation (like an AI learning the interface)
- Matches RexxJS philosophy of tight JavaScript integration

**Security considerations**:
```javascript
async handleInterpretJs(event) {
  const { code, requestId } = event.data;

  try {
    // NOTE: eval is intentional for INTERPRET_JS pattern
    // In production, consider:
    // 1. Sandboxing the evaluation context
    // 2. Whitelisting allowed operations
    // 3. Rate limiting requests
    const result = eval(code);

    event.source.postMessage({
      type: 'interpret-js-response',
      requestId,
      success: true,
      result
    }, event.origin);
  } catch (error) {
    // Return errors to caller
    event.source.postMessage({
      type: 'interpret-js-response',
      requestId,
      success: false,
      error: error.message
    }, event.origin);
  }
}
```

---

### 4. Message Broker Pattern

**Inspiration**: `test-harness-multi-instance.html` central broker routing messages.

**Problem**: Multiple client-service pairs need isolated communication.

**Solution**: Central message broker with service topology configuration.

**Service Topology**:
```javascript
const serviceTopology = {
  // Client A talks to Service 1
  'rexx-alpha': { iframe: 'rexx-alpha', targetService: 'warewoolf-1' },

  // Client B talks to Service 2
  'rexx-beta': { iframe: 'rexx-beta', targetService: 'warewoolf-2' },

  // Service 1 responds to Client A
  'warewoolf-1': { iframe: 'warewoolf-1', clientTarget: 'rexx-alpha' },

  // Service 2 responds to Client B
  'warewoolf-2': { iframe: 'warewoolf-2', clientTarget: 'rexx-beta' }
};
```

**Broker Implementation**:
```javascript
window.addEventListener('message', function(event) {
  const { data, source } = event;

  // Identify source frame by comparing window references
  let sourceId = null;
  for (const [id, config] of Object.entries(serviceTopology)) {
    const iframe = document.getElementById(config.iframe);
    if (iframe?.contentWindow === source) {
      sourceId = id;
      break;
    }
  }

  if (!sourceId) return; // Unknown source

  const sourceConfig = serviceTopology[sourceId];

  // Route request: client → service
  if (sourceConfig.targetService) {
    const targetId = sourceConfig.targetService;
    const targetFrame = document.getElementById(
      serviceTopology[targetId].iframe
    );
    targetFrame.contentWindow.postMessage(data, '*');
  }

  // Route response: service → client
  else if (sourceConfig.clientTarget) {
    const targetId = sourceConfig.clientTarget;
    const targetFrame = document.getElementById(
      serviceTopology[targetId].iframe
    );
    targetFrame.contentWindow.postMessage(data, '*');
  }
});
```

**Benefits**:
- Centralized routing logic
- Instance isolation (clients can't talk to each other)
- Easy to add more client-service pairs
- Single source of truth for topology

---

### 5. DirectorBridge and WorkerBridge Pattern

**Inspiration**: Separation of concerns in calculator architecture.

**Pattern**: Two complementary classes handle different sides of communication.

#### WoolfWorkerBridge (Service Side)
**Role**: Receives and executes commands in the service frame.

```javascript
class WoolfWorkerBridge {
  constructor(addressWoolf, serviceId) {
    this.addressWoolf = addressWoolf;
    this.serviceId = serviceId;
  }

  enable() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  async handleMessage(event) {
    // Process incoming command
    // Execute via ADDRESS_WOOLF
    // Send response back
  }
}
```

**Usage in WareWoolf**:
```javascript
// In render.js
const handler = setupRexxJSControl(context);
const bridge = new WoolfWorkerBridge(window.ADDRESS_WOOLF, 'warewoolf');
bridge.enable();
```

#### WoolfDirectorBridge (Client Side)
**Role**: Sends commands and handles responses.

```javascript
class WoolfDirectorBridge {
  constructor(targetWindow, targetOrigin, clientId) {
    this.targetWindow = targetWindow;
    this.pendingRequests = new Map();
  }

  async run(command, params) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;
      this.pendingRequests.set(requestId, { resolve, reject });

      this.targetWindow.postMessage({
        type: 'woolf-control',
        command,
        params,
        requestId
      }, this.targetOrigin);
    });
  }

  handleResponse(event) {
    const { requestId, result, error } = event.data;
    const pending = this.pendingRequests.get(requestId);

    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error));
    }
  }
}
```

**Usage**:
```javascript
// In client frame
const director = new WoolfDirectorBridge(
  parentWindow,
  '*',
  'rexx-client-1'
);

const result = await director.run('get-word-count', {});
console.log('Word count:', result.total);
```

**Why this separation?**
- Clear separation of concerns
- Worker doesn't need to know about clients
- Director handles all promise/async complexity
- Each side can be tested independently

---

### 6. Request/Response Correlation

**Problem**: Multiple simultaneous requests need to match with responses.

**Solution**: Request ID system with promise-based API.

```javascript
class WoolfDirectorBridge {
  constructor() {
    this.requestCounter = 0;
    this.pendingRequests = new Map(); // requestId → { resolve, reject }
  }

  async run(command, params) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;

      // Store promise handlers
      this.pendingRequests.set(requestId, { resolve, reject });

      // Send request with ID
      this.targetWindow.postMessage({
        type: 'woolf-control',
        command,
        params,
        requestId  // Correlation ID
      }, this.targetOrigin);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Timeout: ${command}`));
        }
      }, 30000);
    });
  }

  handleResponse(event) {
    const { requestId, success, result, error } = event.data;

    // Match response to request
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return; // Late or duplicate response

    this.pendingRequests.delete(requestId);

    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error));
    }
  }
}
```

**Benefits**:
- Requests can be sent in any order
- Responses matched correctly regardless of order
- Timeout handling per request
- Clean async/await API for users

---

## Automation Pattern Examples

### Calculator-Style Automation

From `calculator-automation.rexx`:
```rexx
/* Read current state */
LET display = INTERPRET_JS("document.getElementById('box').textContent")

/* Perform operations */
CALL button_number(5)
CALL button_operator('+')
CALL button_number(3)
CALL button_equals()

/* Verify result */
LET result = INTERPRET_JS("document.getElementById('box').textContent")
CHECKPOINT "Addition result" result
```

### WareWoolf Automation Equivalent

From `warewoolf-automation.rexx`:
```rexx
/* Read current state */
LET content = INTERPRET_JS("document.querySelector('.ql-editor').textContent")

/* Perform operations */
ADDRESS WOOLF "set-content text=Chapter 1"
ADDRESS WOOLF "append text=First paragraph"
ADDRESS WOOLF "append text=Second paragraph"

/* Verify result */
ADDRESS WOOLF "get-word-count"
stats = rc
CHECKPOINT "Word count" stats.total
```

### Key Similarities
1. **INTERPRET_JS for inspection** - Read DOM state
2. **Command execution** - Trigger operations
3. **CHECKPOINT for validation** - Verify results
4. **Procedural flow** - Step-by-step automation

---

## Multi-Protocol Client Example

Demonstrating all three protocols:

```javascript
const director = new WoolfDirectorBridge(targetWindow);

// Protocol 1: Simple control
const chapters = await director.run('list-chapters');

// Protocol 2: JSON-RPC
const stats = await director.rpc('get-word-count', {});

// Protocol 3: INTERPRET_JS
const editorText = await director.interpretJs(
  'document.querySelector(".ql-editor").textContent'
);

console.log('Chapters:', chapters.length);
console.log('Words:', stats.total);
console.log('Content:', editorText);
```

---

## Test Harness Pattern

Based on `test-harness-multi-instance.html`:

**File**: `test-harness-multi-instance.html`

**Architecture**:
```
┌─────────────────────────────────────────┐
│         Parent Page (Broker)            │
│                                         │
│  ┌──────────┐         ┌──────────┐     │
│  │ Rexx     │────────>│WareWoolf │     │
│  │ Alpha    │<────────│    1     │     │
│  └──────────┘         └──────────┘     │
│                                         │
│  ┌──────────┐         ┌──────────┐     │
│  │ Rexx     │────────>│WareWoolf │     │
│  │ Beta     │<────────│    2     │     │
│  └──────────┘         └──────────┘     │
└─────────────────────────────────────────┘
```

**Features**:
- Independent client-service pairs
- Centralized message routing
- Visual debugging (log panels)
- Test buttons for each protocol
- Demonstrates instance isolation

---

## Security Considerations

### 1. INTERPRET_JS Security

**Risk**: Arbitrary code execution in the service frame.

**Mitigations**:
```javascript
// Option 1: Whitelist safe operations
const SAFE_OPERATIONS = [
  'document.querySelector',
  'document.getElementById',
  'textContent',
  'offsetWidth',
  'offsetHeight'
];

function isSafeCode(code) {
  // Check if code only uses whitelisted operations
  return SAFE_OPERATIONS.some(op => code.includes(op));
}

// Option 2: Sandbox with limited scope
function sandboxedEval(code) {
  const sandbox = {
    document: {
      querySelector: document.querySelector.bind(document),
      // Only expose specific methods
    }
  };

  const fn = new Function('sandbox', `with(sandbox) { return ${code}; }`);
  return fn(sandbox);
}

// Option 3: Rate limiting
const rateLimiter = {
  requests: new Map(),
  maxPerSecond: 10,

  check(clientId) {
    const now = Date.now();
    const requests = this.requests.get(clientId) || [];
    const recent = requests.filter(t => now - t < 1000);

    if (recent.length >= this.maxPerSecond) {
      throw new Error('Rate limit exceeded');
    }

    recent.push(now);
    this.requests.set(clientId, recent);
  }
};
```

### 2. Origin Validation

```javascript
async handleMessage(event) {
  // Validate origin in production
  const allowedOrigins = [
    'http://localhost:8888',
    'https://yourdomain.com'
  ];

  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Rejected message from', event.origin);
    return;
  }

  // Process message
}
```

### 3. Message Validation

```javascript
function validateMessage(data) {
  // Check required fields
  if (!data.type || !data.requestId) {
    throw new Error('Invalid message structure');
  }

  // Validate command names
  const validCommands = [
    'get-content', 'set-content', 'list-chapters',
    // ... etc
  ];

  if (!validCommands.includes(data.command)) {
    throw new Error(`Unknown command: ${data.command}`);
  }

  // Validate parameter types
  if (data.params && typeof data.params !== 'object') {
    throw new Error('Params must be an object');
  }
}
```

---

## Performance Considerations

### 1. Timeout Management

```javascript
async run(command, params) {
  return new Promise((resolve, reject) => {
    const requestId = ++this.requestCounter;
    this.pendingRequests.set(requestId, { resolve, reject });

    // Send message
    this.targetWindow.postMessage({...}, this.targetOrigin);

    // Configurable timeout
    const timeout = this.getTimeout(command);
    setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Timeout: ${command}`));
      }
    }, timeout);
  });
}

getTimeout(command) {
  // Longer timeout for expensive operations
  const slowCommands = ['export-docx', 'compile'];
  return slowCommands.includes(command) ? 60000 : 30000;
}
```

### 2. Request Batching

```javascript
class BatchedDirector extends WoolfDirectorBridge {
  constructor(...args) {
    super(...args);
    this.batchQueue = [];
    this.batchTimer = null;
  }

  async runBatched(command, params) {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ command, params, resolve, reject });

      // Flush batch after 50ms or 10 commands
      if (this.batchQueue.length >= 10) {
        this.flushBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.flushBatch(), 50);
      }
    });
  }

  flushBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0);
    clearTimeout(this.batchTimer);
    this.batchTimer = null;

    // Send as single batched message
    this.targetWindow.postMessage({
      type: 'woolf-batch',
      requests: batch.map(({ command, params }) => ({ command, params }))
    }, this.targetOrigin);
  }
}
```

---

## Testing Patterns

### 1. Unit Testing Message Handlers

```javascript
describe('WoolfWorkerBridge', () => {
  test('handles control message', async () => {
    const mockAddressWoolf = {
      run: jest.fn(async () => ({ success: true }))
    };

    const bridge = new WoolfWorkerBridge(mockAddressWoolf, 'test-service');

    const event = {
      data: {
        type: 'woolf-control',
        command: 'get-word-count',
        params: {},
        requestId: 1
      },
      source: {
        postMessage: jest.fn()
      },
      origin: 'http://localhost'
    };

    await bridge.handleMessage(event);

    expect(mockAddressWoolf.run).toHaveBeenCalledWith('get-word-count', {});
    expect(event.source.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'woolf-control-response',
        requestId: 1,
        serviceId: 'test-service',
        success: true
      }),
      'http://localhost'
    );
  });
});
```

### 2. Integration Testing with Playwright

```javascript
test('multi-protocol communication', async ({ page }) => {
  await page.goto('http://localhost:8888/test-harness-multi-instance.html');

  // Test standard protocol
  await page.click('button:has-text("Test Alpha")');
  await expect(page.locator('#log-alpha')).toContainText('Success');

  // Test JSON-RPC
  await page.click('button:has-text("Test JSON-RPC")');
  await expect(page.locator('#log-broker')).toContainText('JSON-RPC result');

  // Test INTERPRET_JS
  await page.click('button:has-text("Test INTERPRET_JS")');
  await expect(page.locator('#log-broker')).toContainText('INTERPRET_JS result');
});
```

---

## Migration Guide

### From Simple Messaging to Full Pattern

**Step 1**: Add service ID
```javascript
// Before
const bridge = new WoolfWorkerBridge(addressWoolf);

// After
const bridge = new WoolfWorkerBridge(addressWoolf, 'my-service-id');
```

**Step 2**: Support multiple protocols
```javascript
// Add JSON-RPC support
const result = await director.rpc('get-word-count', {});

// Add INTERPRET_JS support
const value = await director.interpretJs('document.title');
```

**Step 3**: Add message broker for multi-instance
```javascript
// Create topology
const topology = {
  'client-1': { targetService: 'service-1' },
  'service-1': { clientTarget: 'client-1' }
};

// Add broker
window.addEventListener('message', routeMessage);
```

---

## Best Practices

1. **Always include serviceId** - Even for single instance, future-proof your code
2. **Use request IDs** - Enable concurrent requests
3. **Implement timeouts** - Prevent hanging requests
4. **Validate messages** - Check structure before processing
5. **Log routing decisions** - Makes debugging multi-instance scenarios easier
6. **Handle errors gracefully** - Return error responses, don't just log
7. **Document your protocols** - Show examples of each message type
8. **Test all protocols** - Don't just test the one you use most
9. **Consider security** - Validate origins, sanitize INTERPRET_JS
10. **Monitor performance** - Track request/response times

---

## Further Reading

- **RexxJS Documentation**: https://rexxjs.org
- **JSON-RPC 2.0 Spec**: https://www.jsonrpc.org/specification
- **PostMessage API**: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- **RexxJS Calculator Example**: https://github.com/RexxJS/RexxJS/tree/main/core/tests/web

---

## Summary

The WareWoolf control bus implements proven patterns from the RexxJS ecosystem:

✅ **Service Identification** - Multiple instances, correct routing
✅ **Multiple Protocols** - Standard, JSON-RPC, INTERPRET_JS
✅ **Message Broker** - Central routing for complex topologies
✅ **Director/Worker** - Clear separation of concerns
✅ **Request Correlation** - Promise-based async API
✅ **Automation Support** - Calculator-style scripting

These patterns enable:
- Multi-instance deployments
- Flexible integration options
- Robust error handling
- Excellent debugging experience
- Clean, testable code

The implementation stays true to RexxJS philosophy while adapting patterns to WareWoolf's document-centric domain.
