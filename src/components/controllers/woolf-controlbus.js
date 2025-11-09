/**
 * WoolfControlBus - Control Bus Bridge for RexxJS Integration
 *
 * Provides iframe-based communication for remote control of WareWoolf
 * via postMessage API
 *
 * Follows RexxJS service architecture patterns from the calculator example
 */

/**
 * WoolfWorkerBridge - For the main application frame
 * Listens for commands from external frames and executes them
 */
class WoolfWorkerBridge {
  constructor(addressWoolf, serviceId = 'warewoolf') {
    this.addressWoolf = addressWoolf;
    this.serviceId = serviceId;
    this.enabled = false;
  }

  enable() {
    if (this.enabled) return;

    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);
    this.enabled = true;
    console.log('[WoolfWorkerBridge] Control bus enabled');
  }

  disable() {
    if (!this.enabled) return;

    window.removeEventListener('message', this.messageHandler);
    this.enabled = false;
    console.log('[WoolfWorkerBridge] Control bus disabled');
  }

  async handleMessage(event) {
    const { data } = event;

    // Handle different message types following RexxJS patterns

    // 1. Standard woolf-control messages
    if (data && data.type === 'woolf-control') {
      await this.handleControlMessage(event);
      return;
    }

    // 2. JSON-RPC 2.0 style messages
    if (data && data.jsonrpc === '2.0') {
      await this.handleJsonRpc(event);
      return;
    }

    // 3. INTERPRET_JS requests (for RexxJS INTERPRET_JS function)
    if (data && data.type === 'interpret-js-request') {
      await this.handleInterpretJs(event);
      return;
    }
  }

  async handleControlMessage(event) {
    const { command, params, requestId } = event.data;

    try {
      console.log('[WoolfWorkerBridge] Executing:', command, params);
      const result = await this.addressWoolf.run(command, params);

      // Send success response with service ID
      event.source.postMessage({
        type: 'woolf-control-response',
        requestId,
        serviceId: this.serviceId,
        success: true,
        result
      }, event.origin);

    } catch (error) {
      console.error('[WoolfWorkerBridge] Error:', error);

      // Send error response
      event.source.postMessage({
        type: 'woolf-control-response',
        requestId,
        serviceId: this.serviceId,
        success: false,
        error: error.message
      }, event.origin);
    }
  }

  async handleJsonRpc(event) {
    const { id, method, params } = event.data;

    try {
      const result = await this.addressWoolf.run(method, params || {});

      event.source.postMessage({
        jsonrpc: '2.0',
        id,
        serviceId: this.serviceId,
        result
      }, event.origin);

    } catch (error) {
      event.source.postMessage({
        jsonrpc: '2.0',
        id,
        serviceId: this.serviceId,
        error: {
          code: -32603,
          message: error.message
        }
      }, event.origin);
    }
  }

  async handleInterpretJs(event) {
    const { code, requestId } = event.data;

    try {
      // Execute JavaScript code and return result
      // Note: eval is used here for INTERPRET_JS pattern - use with caution
      const result = eval(code);

      event.source.postMessage({
        type: 'interpret-js-response',
        requestId,
        serviceId: this.serviceId,
        success: true,
        result
      }, event.origin);

    } catch (error) {
      event.source.postMessage({
        type: 'interpret-js-response',
        requestId,
        serviceId: this.serviceId,
        success: false,
        error: error.message
      }, event.origin);
    }
  }
}

/**
 * WoolfDirectorBridge - For the script/control frame
 * Sends commands to the main application frame
 */
class WoolfDirectorBridge {
  constructor(targetWindow, targetOrigin = '*', clientId = 'rexx-client') {
    this.targetWindow = targetWindow;
    this.targetOrigin = targetOrigin;
    this.clientId = clientId;
    this.requestCounter = 0;
    this.pendingRequests = new Map();
    this.responseHandler = this.handleResponse.bind(this);
    window.addEventListener('message', this.responseHandler);
  }

  /**
   * Execute a command on the worker frame
   * @param {string} command - Command name
   * @param {object} params - Command parameters
   * @returns {Promise<any>} Command result
   */
  async run(command, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;

      // Store the promise handlers
      this.pendingRequests.set(requestId, { resolve, reject });

      // Send the command
      this.targetWindow.postMessage({
        type: 'woolf-control',
        command,
        params,
        requestId
      }, this.targetOrigin);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Command timeout: ${command}`));
        }
      }, 30000);
    });
  }

  /**
   * Execute JavaScript in the worker frame (INTERPRET_JS pattern)
   * @param {string} code - JavaScript code to execute
   * @returns {Promise<any>} Result of execution
   */
  async interpretJs(code) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;

      this.pendingRequests.set(requestId, { resolve, reject });

      this.targetWindow.postMessage({
        type: 'interpret-js-request',
        code,
        requestId,
        clientId: this.clientId
      }, this.targetOrigin);

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('INTERPRET_JS timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Call method via JSON-RPC 2.0
   * @param {string} method - Method name
   * @param {object} params - Parameters
   * @returns {Promise<any>} Result
   */
  async rpc(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestCounter;

      this.pendingRequests.set(id, { resolve, reject });

      this.targetWindow.postMessage({
        jsonrpc: '2.0',
        id,
        method,
        params
      }, this.targetOrigin);

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 30000);
    });
  }

  handleResponse(event) {
    const { data } = event;

    // Handle different response types
    if (data && data.type === 'woolf-control-response') {
      this.handleControlResponse(data);
    } else if (data && data.type === 'interpret-js-response') {
      this.handleInterpretJsResponse(data);
    } else if (data && data.jsonrpc === '2.0') {
      this.handleJsonRpcResponse(data);
    }
  }

  handleControlResponse(data) {
    const { requestId, success, result, error } = data;

    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);

    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error || 'Unknown error'));
    }
  }

  handleInterpretJsResponse(data) {
    const { requestId, success, result, error } = data;

    const pending = this.pendingRequests.get(requestId);
    if (!pending) return;

    this.pendingRequests.delete(requestId);

    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error || 'INTERPRET_JS failed'));
    }
  }

  handleJsonRpcResponse(data) {
    const { id, result, error } = data;

    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    this.pendingRequests.delete(id);

    if (error) {
      pending.reject(new Error(error.message || 'RPC error'));
    } else {
      pending.resolve(result);
    }
  }

  destroy() {
    window.removeEventListener('message', this.responseHandler);
    this.pendingRequests.clear();
  }
}

/**
 * Setup control bus for iframe communication
 * @param {object} addressWoolf - The ADDRESS_WOOLF interface
 * @returns {WoolfWorkerBridge} The worker bridge instance
 */
function setupControlBus(addressWoolf) {
  const bridge = new WoolfWorkerBridge(addressWoolf);
  bridge.enable();
  return bridge;
}

// Export for both Node.js (Electron) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WoolfWorkerBridge,
    WoolfDirectorBridge,
    setupControlBus
  };
}

// Also make available globally for browser usage
if (typeof window !== 'undefined') {
  window.WoolfWorkerBridge = WoolfWorkerBridge;
  window.WoolfDirectorBridge = WoolfDirectorBridge;
  window.setupWoolfControlBus = setupControlBus;
}
