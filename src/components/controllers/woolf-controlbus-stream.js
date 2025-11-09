/**
 * WareWoolf Control Bus with Event Streaming
 * Extends the basic control bus to support real-time event streaming
 * for remote LLM connections
 */

/**
 * Enhanced Worker Bridge with Event Streaming
 * Used by WareWoolf to send events to remote LLMs via iframe
 */
class WoolfWorkerBridgeStream {
  constructor(addressWoolf, serviceId = 'warewoolf') {
    this.addressWoolf = addressWoolf;
    this.serviceId = serviceId;
    this.eventStreams = new Map(); // streamId -> { targetWindow, origin, filters }
    this.streamIdCounter = 0;
  }

  /**
   * Register a remote client for event streaming
   * @param {Window} targetWindow - The iframe window to send events to
   * @param {string} origin - The origin for postMessage security
   * @param {object} filters - Optional filters for events
   * @returns {number} Stream ID for this subscription
   */
  registerEventStream(targetWindow, origin, filters = {}) {
    const streamId = ++this.streamIdCounter;

    this.eventStreams.set(streamId, {
      targetWindow,
      origin,
      filters,
      active: true
    });

    // Subscribe to document changes
    const subscriptionId = this.addressWoolf.otDoc.subscribeToChanges(
      `stream-${streamId}`,
      (change) => {
        this.sendChangeEvent(streamId, change);
      }
    );

    this.eventStreams.get(streamId).subscriptionId = subscriptionId;

    // Send initial state
    this.sendInitialState(streamId);

    return streamId;
  }

  /**
   * Unregister an event stream
   */
  unregisterEventStream(streamId) {
    const stream = this.eventStreams.get(streamId);
    if (!stream) return;

    // Unsubscribe from changes
    if (stream.subscriptionId) {
      this.addressWoolf.otDoc.unsubscribeFromChanges(stream.subscriptionId);
    }

    // Mark as inactive
    stream.active = false;
    this.eventStreams.delete(streamId);
  }

  /**
   * Send initial document state to new stream
   */
  sendInitialState(streamId) {
    const stream = this.eventStreams.get(streamId);
    if (!stream || !stream.active) return;

    const state = {
      type: 'woolf-initial-state',
      serviceId: this.serviceId,
      streamId,
      timestamp: Date.now(),
      state: {
        version: this.addressWoolf.otDoc.getVersion(),
        documentId: this.addressWoolf.otDoc.documentId,
        length: this.addressWoolf.otDoc.quill.getLength(),
        activeUsers: Array.from(this.addressWoolf.otDoc.activeUsers.values()),
        metadata: this.addressWoolf.otDoc.getMetadata()
      }
    };

    stream.targetWindow.postMessage(state, stream.origin);
  }

  /**
   * Send a change event to subscribers
   */
  sendChangeEvent(streamId, change) {
    const stream = this.eventStreams.get(streamId);
    if (!stream || !stream.active) return;

    // Apply filters if any
    if (stream.filters.userId && change.userId !== stream.filters.userId) {
      return; // Skip events from other users if filtered
    }

    const event = {
      type: 'woolf-change-event',
      serviceId: this.serviceId,
      streamId,
      timestamp: Date.now(),
      change
    };

    stream.targetWindow.postMessage(event, stream.origin);
  }

  /**
   * Send cursor/selection update events
   */
  sendCursorEvent(userId, cursor) {
    for (const [streamId, stream] of this.eventStreams) {
      if (!stream.active) continue;

      const event = {
        type: 'woolf-cursor-event',
        serviceId: this.serviceId,
        streamId,
        timestamp: Date.now(),
        userId,
        cursor
      };

      stream.targetWindow.postMessage(event, stream.origin);
    }
  }

  /**
   * Send suggestion events (when LLM creates suggestion)
   */
  sendSuggestionEvent(suggestion) {
    for (const [streamId, stream] of this.eventStreams) {
      if (!stream.active) continue;

      const event = {
        type: 'woolf-suggestion-event',
        serviceId: this.serviceId,
        streamId,
        timestamp: Date.now(),
        suggestion
      };

      stream.targetWindow.postMessage(event, stream.origin);
    }
  }

  /**
   * Handle incoming messages (commands from remote LLM)
   */
  async handleMessage(event) {
    const { data } = event;

    // Stream registration request
    if (data && data.type === 'woolf-stream-register') {
      const streamId = this.registerEventStream(
        event.source,
        event.origin,
        data.filters
      );

      event.source.postMessage({
        type: 'woolf-stream-registered',
        serviceId: this.serviceId,
        streamId,
        success: true
      }, event.origin);
      return;
    }

    // Stream unregister request
    if (data && data.type === 'woolf-stream-unregister') {
      this.unregisterEventStream(data.streamId);

      event.source.postMessage({
        type: 'woolf-stream-unregistered',
        serviceId: this.serviceId,
        streamId: data.streamId,
        success: true
      }, event.origin);
      return;
    }

    // Regular command execution (delegate to standard control bus)
    if (data && data.type === 'woolf-control') {
      const { command, params, requestId } = data;

      try {
        const result = await this.addressWoolf.run(command, params);

        event.source.postMessage({
          type: 'woolf-response',
          requestId,
          serviceId: this.serviceId,
          success: true,
          result
        }, event.origin);
      } catch (error) {
        event.source.postMessage({
          type: 'woolf-response',
          requestId,
          serviceId: this.serviceId,
          success: false,
          error: error.message
        }, event.origin);
      }
    }
  }
}

/**
 * Enhanced Director Bridge for Remote LLM Clients
 * Used by remote LLM in iframe to receive events and send commands
 */
class WoolfDirectorBridgeStream {
  constructor(targetWindow, origin = '*') {
    this.targetWindow = targetWindow;
    this.origin = origin;
    this.requestIdCounter = 0;
    this.pendingRequests = new Map();
    this.streamId = null;
    this.eventHandlers = new Map(); // event type -> Set of callbacks

    // Listen for messages
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Register for event stream
   * @param {object} filters - Optional filters for events
   * @returns {Promise<number>} Stream ID
   */
  async registerStream(filters = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestIdCounter;

      this.pendingRequests.set(requestId, { resolve, reject });

      this.targetWindow.postMessage({
        type: 'woolf-stream-register',
        requestId,
        filters
      }, this.origin);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Stream registration timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Unregister from event stream
   */
  async unregisterStream() {
    if (!this.streamId) return;

    this.targetWindow.postMessage({
      type: 'woolf-stream-unregister',
      streamId: this.streamId
    }, this.origin);

    this.streamId = null;
  }

  /**
   * Add event listener for specific event types
   * @param {string} eventType - 'change', 'cursor', 'suggestion', 'initial-state'
   * @param {Function} callback - Handler function
   */
  on(eventType, callback) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType).add(callback);
  }

  /**
   * Remove event listener
   */
  off(eventType, callback) {
    if (this.eventHandlers.has(eventType)) {
      this.eventHandlers.get(eventType).delete(callback);
    }
  }

  /**
   * Execute a command and get result
   * @param {string} command - Command name
   * @param {object} params - Command parameters
   * @returns {Promise<any>} Command result
   */
  async run(command, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++this.requestIdCounter;

      this.pendingRequests.set(requestId, { resolve, reject });

      this.targetWindow.postMessage({
        type: 'woolf-control',
        command,
        params,
        requestId
      }, this.origin);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Command timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(event) {
    const { data } = event;

    // Stream registered response
    if (data && data.type === 'woolf-stream-registered') {
      this.streamId = data.streamId;
      // Resolve any pending registration request
      for (const [reqId, pending] of this.pendingRequests) {
        pending.resolve(data.streamId);
        this.pendingRequests.delete(reqId);
      }
      return;
    }

    // Initial state event
    if (data && data.type === 'woolf-initial-state') {
      this.emitEvent('initial-state', data.state);
      return;
    }

    // Change event
    if (data && data.type === 'woolf-change-event') {
      this.emitEvent('change', data.change);
      return;
    }

    // Cursor event
    if (data && data.type === 'woolf-cursor-event') {
      this.emitEvent('cursor', {
        userId: data.userId,
        cursor: data.cursor
      });
      return;
    }

    // Suggestion event
    if (data && data.type === 'woolf-suggestion-event') {
      this.emitEvent('suggestion', data.suggestion);
      return;
    }

    // Command response
    if (data && data.type === 'woolf-response') {
      const pending = this.pendingRequests.get(data.requestId);
      if (pending) {
        if (data.success) {
          pending.resolve(data.result);
        } else {
          pending.reject(new Error(data.error));
        }
        this.pendingRequests.delete(data.requestId);
      }
      return;
    }
  }

  /**
   * Emit event to registered handlers
   */
  emitEvent(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      for (const callback of this.eventHandlers.get(eventType)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventType} handler:`, error);
        }
      }
    }
  }
}

// Export for use in WareWoolf and remote clients
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WoolfWorkerBridgeStream,
    WoolfDirectorBridgeStream
  };
}
