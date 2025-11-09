/**
 * Unit tests for WoolfControlBus
 * Tests the iframe-based control bus bridges
 */

const { WoolfWorkerBridge, WoolfDirectorBridge } = require('../../src/components/controllers/woolf-controlbus');

describe('WoolfWorkerBridge', () => {
  let bridge;
  let mockAddressWoolf;

  beforeEach(() => {
    // Create mock ADDRESS_WOOLF
    mockAddressWoolf = {
      run: jest.fn(async (command, params) => {
        if (command === 'get-word-count') {
          return { total: 1000, chapters: 5 };
        }
        if (command === 'error-command') {
          throw new Error('Test error');
        }
        return { success: true };
      })
    };

    bridge = new WoolfWorkerBridge(mockAddressWoolf);

    // Mock window.addEventListener
    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
  });

  afterEach(() => {
    delete global.window;
  });

  test('enable registers message handler', () => {
    bridge.enable();
    expect(global.window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(bridge.enabled).toBe(true);
  });

  test('enable does nothing if already enabled', () => {
    bridge.enable();
    bridge.enable();
    expect(global.window.addEventListener).toHaveBeenCalledTimes(1);
  });

  test('disable removes message handler', () => {
    bridge.enable();
    bridge.disable();
    expect(global.window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    expect(bridge.enabled).toBe(false);
  });

  test('handleMessage ignores invalid messages', async () => {
    bridge.enable();

    const event = {
      data: { type: 'other-message' },
      source: { postMessage: jest.fn() }
    };

    await bridge.handleMessage(event);
    expect(event.source.postMessage).not.toHaveBeenCalled();
  });

  test('handleMessage executes valid command', async () => {
    bridge.enable();

    const mockPostMessage = jest.fn();
    const event = {
      data: {
        type: 'woolf-control',
        command: 'get-word-count',
        params: {},
        requestId: 123
      },
      source: { postMessage: mockPostMessage },
      origin: 'http://localhost'
    };

    await bridge.handleMessage(event);

    expect(mockAddressWoolf.run).toHaveBeenCalledWith('get-word-count', {});
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'woolf-control-response',
      requestId: 123,
      success: true,
      result: { total: 1000, chapters: 5 }
    }, 'http://localhost');
  });

  test('handleMessage handles command errors', async () => {
    bridge.enable();

    const mockPostMessage = jest.fn();
    const event = {
      data: {
        type: 'woolf-control',
        command: 'error-command',
        params: {},
        requestId: 456
      },
      source: { postMessage: mockPostMessage },
      origin: 'http://localhost'
    };

    await bridge.handleMessage(event);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'woolf-control-response',
      requestId: 456,
      success: false,
      error: 'Test error'
    }, 'http://localhost');
  });
});

describe('WoolfDirectorBridge', () => {
  let bridge;
  let mockWindow;

  beforeEach(() => {
    // Mock target window
    mockWindow = {
      postMessage: jest.fn()
    };

    // Mock global window for event listener
    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    bridge = new WoolfDirectorBridge(mockWindow, 'http://localhost');
  });

  afterEach(() => {
    bridge.destroy();
    delete global.window;
  });

  test('constructor registers response handler', () => {
    expect(global.window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  test('run sends command via postMessage', async () => {
    const promise = bridge.run('get-word-count', { format: 'text' });

    expect(mockWindow.postMessage).toHaveBeenCalledWith({
      type: 'woolf-control',
      command: 'get-word-count',
      params: { format: 'text' },
      requestId: 1
    }, 'http://localhost');

    // Simulate response
    bridge.handleResponse({
      data: {
        type: 'woolf-control-response',
        requestId: 1,
        success: true,
        result: { total: 1000 }
      }
    });

    const result = await promise;
    expect(result).toEqual({ total: 1000 });
  });

  test('run increments request counter', async () => {
    bridge.run('command1');
    bridge.run('command2');

    expect(mockWindow.postMessage).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ requestId: 1 }),
      'http://localhost'
    );
    expect(mockWindow.postMessage).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ requestId: 2 }),
      'http://localhost'
    );
  });

  test('handleResponse resolves correct promise', async () => {
    const promise1 = bridge.run('command1');
    const promise2 = bridge.run('command2');

    // Respond to second request first
    bridge.handleResponse({
      data: {
        type: 'woolf-control-response',
        requestId: 2,
        success: true,
        result: 'result2'
      }
    });

    const result2 = await promise2;
    expect(result2).toBe('result2');

    // Respond to first request
    bridge.handleResponse({
      data: {
        type: 'woolf-control-response',
        requestId: 1,
        success: true,
        result: 'result1'
      }
    });

    const result1 = await promise1;
    expect(result1).toBe('result1');
  });

  test('handleResponse rejects on error', async () => {
    const promise = bridge.run('error-command');

    bridge.handleResponse({
      data: {
        type: 'woolf-control-response',
        requestId: 1,
        success: false,
        error: 'Command failed'
      }
    });

    await expect(promise).rejects.toThrow('Command failed');
  });

  test('handleResponse ignores invalid responses', async () => {
    const promise = bridge.run('test-command');

    // Send invalid response
    bridge.handleResponse({
      data: {
        type: 'other-type',
        requestId: 1
      }
    });

    // Promise should still be pending
    expect(bridge.pendingRequests.has(1)).toBe(true);

    // Resolve properly
    bridge.handleResponse({
      data: {
        type: 'woolf-control-response',
        requestId: 1,
        success: true,
        result: 'ok'
      }
    });

    await expect(promise).resolves.toBe('ok');
  });

  test('run times out after 30 seconds', async () => {
    jest.useFakeTimers();

    const promise = bridge.run('slow-command');

    // Fast-forward time
    jest.advanceTimersByTime(30000);

    await expect(promise).rejects.toThrow('Command timeout: slow-command');

    jest.useRealTimers();
  });

  test('destroy clears pending requests', async () => {
    const promise = bridge.run('test-command');

    expect(bridge.pendingRequests.size).toBe(1);

    bridge.destroy();

    expect(bridge.pendingRequests.size).toBe(0);
    expect(global.window.removeEventListener).toHaveBeenCalled();
  });
});
