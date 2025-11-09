/**
 * WoolfControlBus - Control Bus Bridge for RexxJS Integration
 *
 * Provides iframe-based communication for remote control of WareWoolf
 * via postMessage API
 */

/**
 * WoolfWorkerBridge - For the main application frame
 * Listens for commands from external frames and executes them
 */
class WoolfWorkerBridge {
  constructor(addressWoolf) {
    this.addressWoolf = addressWoolf;
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
    // Validate message structure
    if (!event.data || event.data.type !== 'woolf-control') {
      return;
    }

    const { command, params, requestId } = event.data;

    try {
      console.log('[WoolfWorkerBridge] Executing:', command, params);
      const result = await this.addressWoolf.run(command, params);

      // Send success response
      event.source.postMessage({
        type: 'woolf-control-response',
        requestId,
        success: true,
        result
      }, event.origin);

    } catch (error) {
      console.error('[WoolfWorkerBridge] Error:', error);

      // Send error response
      event.source.postMessage({
        type: 'woolf-control-response',
        requestId,
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
  constructor(targetWindow, targetOrigin = '*') {
    this.targetWindow = targetWindow;
    this.targetOrigin = targetOrigin;
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

  handleResponse(event) {
    if (!event.data || event.data.type !== 'woolf-control-response') {
      return;
    }

    const { requestId, success, result, error } = event.data;

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return; // Response for unknown request
    }

    this.pendingRequests.delete(requestId);

    if (success) {
      pending.resolve(result);
    } else {
      pending.reject(new Error(error || 'Unknown error'));
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
