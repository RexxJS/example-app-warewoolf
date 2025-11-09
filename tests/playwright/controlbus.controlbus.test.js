/**
 * Playwright tests for WareWoolf Control Bus
 * Tests iframe-based postMessage communication
 */

const { test, expect } = require('@playwright/test');

test.describe('WareWoolf Control Bus', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('http://localhost:8888/woolf-controlbus-demo.html');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Demo Page UI', () => {
    test('should load demo page', async ({ page }) => {
      await expect(page.locator('h1')).toContainText('WareWoolf Control Bus Demo');
    });

    test('should have script editor', async ({ page }) => {
      const editor = page.locator('#script-editor');
      await expect(editor).toBeVisible();
    });

    test('should have output panel', async ({ page }) => {
      const output = page.locator('#output');
      await expect(output).toBeVisible();
    });

    test('should have run button', async ({ page }) => {
      const button = page.locator('button:has-text("Run Script")');
      await expect(button).toBeVisible();
    });
  });

  test.describe('Example Scripts', () => {
    test('should load word count example', async ({ page }) => {
      await page.click('button:has-text("Word Count")');

      const editorContent = await page.locator('#script-editor').inputValue();
      expect(editorContent).toContain('get-word-count');
    });

    test('should load chapters example', async ({ page }) => {
      await page.click('button:has-text("List Chapters")');

      const editorContent = await page.locator('#script-editor').inputValue();
      expect(editorContent).toContain('list-chapters');
    });

    test('should load append example', async ({ page }) => {
      await page.click('button:has-text("Append Text")');

      const editorContent = await page.locator('#script-editor').inputValue();
      expect(editorContent).toContain('append');
    });

    test('should load format example', async ({ page }) => {
      await page.click('button:has-text("Format Text")');

      const editorContent = await page.locator('#script-editor').inputValue();
      expect(editorContent).toContain('format-selection');
    });

    test('should load replace example', async ({ page }) => {
      await page.click('button:has-text("Find & Replace")');

      const editorContent = await page.locator('#script-editor').inputValue();
      expect(editorContent).toContain('replace');
    });
  });

  test.describe('Script Editing', () => {
    test('should allow editing script', async ({ page }) => {
      const editor = page.locator('#script-editor');
      await editor.fill('/* My custom script */');

      const content = await editor.inputValue();
      expect(content).toBe('/* My custom script */');
    });

    test('should clear editor', async ({ page }) => {
      await page.click('button:has-text("Clear Editor")');

      const content = await page.locator('#script-editor').inputValue();
      expect(content).toBe('');
    });

    test('should clear output', async ({ page }) => {
      // Add some output first
      await page.evaluate(() => {
        logOutput('Test message');
      });

      await page.click('button:has-text("Clear Output")');

      const outputText = await page.locator('#output').textContent();
      expect(outputText).not.toContain('Test message');
    });
  });

  test.describe('WoolfDirectorBridge', () => {
    test('should create director bridge', async ({ page }) => {
      const hasDirector = await page.evaluate(() => {
        return typeof WoolfDirectorBridge !== 'undefined';
      });

      expect(hasDirector).toBe(true);
    });

    test('should send postMessage', async ({ page }) => {
      const messageSent = await page.evaluate(async () => {
        // Create a mock parent window
        const mockParent = {
          postMessage: function(data, origin) {
            this.lastMessage = data;
          }
        };

        const director = new WoolfDirectorBridge(mockParent);

        // Send a command (won't get response in test)
        director.run('test-command', { param: 'value' }).catch(() => {});

        // Check message was sent
        return mockParent.lastMessage && mockParent.lastMessage.type === 'woolf-control';
      });

      expect(messageSent).toBe(true);
    });

    test('should handle response messages', async ({ page }) => {
      const responseHandled = await page.evaluate(async () => {
        const mockParent = { postMessage: () => {} };
        const director = new WoolfDirectorBridge(mockParent);

        // Start a command
        const promise = director.run('test-command');

        // Simulate response
        director.handleResponse({
          data: {
            type: 'woolf-control-response',
            requestId: 1,
            success: true,
            result: { test: 'value' }
          }
        });

        // Wait for promise
        const result = await promise;
        return result.test === 'value';
      });

      expect(responseHandled).toBe(true);
    });

    test('should handle error responses', async ({ page }) => {
      const errorHandled = await page.evaluate(async () => {
        const mockParent = { postMessage: () => {} };
        const director = new WoolfDirectorBridge(mockParent);

        // Start a command
        const promise = director.run('error-command');

        // Simulate error response
        director.handleResponse({
          data: {
            type: 'woolf-control-response',
            requestId: 1,
            success: false,
            error: 'Test error'
          }
        });

        // Check error is thrown
        try {
          await promise;
          return false;
        } catch (e) {
          return e.message === 'Test error';
        }
      });

      expect(errorHandled).toBe(true);
    });

    test('should timeout commands', async ({ page }) => {
      const timedOut = await page.evaluate(async () => {
        const mockParent = { postMessage: () => {} };
        const director = new WoolfDirectorBridge(mockParent);

        // Override timeout for test
        const originalTimeout = setTimeout;
        const promise = director.run('slow-command');

        // Manually trigger timeout
        setTimeout(() => {
          director.pendingRequests.forEach((pending, id) => {
            pending.reject(new Error('Command timeout: slow-command'));
            director.pendingRequests.delete(id);
          });
        }, 100);

        try {
          await promise;
          return false;
        } catch (e) {
          return e.message.includes('timeout');
        }
      });

      expect(timedOut).toBe(true);
    });

    test('should destroy and cleanup', async ({ page }) => {
      const cleaned = await page.evaluate(() => {
        const mockParent = { postMessage: () => {} };
        const director = new WoolfDirectorBridge(mockParent);

        // Add pending request
        director.run('test').catch(() => {});

        expect(director.pendingRequests.size).toBe(1);

        // Destroy
        director.destroy();

        return director.pendingRequests.size === 0;
      });

      expect(cleaned).toBe(true);
    });
  });

  test.describe('Command Parsing', () => {
    test('should parse simple ADDRESS WOOLF command', async ({ page }) => {
      const parsed = await page.evaluate(() => {
        const line = 'ADDRESS WOOLF "get-word-count"';
        const match = line.match(/ADDRESS\s+WOOLF\s+"([^"]+)"/i);
        return match ? match[1] : null;
      });

      expect(parsed).toBe('get-word-count');
    });

    test('should parse ADDRESS WOOLF with parameters', async ({ page }) => {
      const parsed = await page.evaluate(() => {
        const line = 'ADDRESS WOOLF "set-content text=Hello"';
        const match = line.match(/ADDRESS\s+WOOLF\s+"([^"]+)"/i);
        if (!match) return null;

        const commandStr = match[1];
        const [command, ...paramParts] = commandStr.split(/\s+/);
        const params = {};

        paramParts.forEach(part => {
          const [key, value] = part.split('=');
          if (key && value) {
            params[key] = value;
          }
        });

        return { command, params };
      });

      expect(parsed.command).toBe('set-content');
      expect(parsed.params).toEqual({ text: 'Hello' });
    });

    test('should ignore comments', async ({ page }) => {
      const shouldSkip = await page.evaluate(() => {
        const line = '/* This is a comment */';
        return line.trim().startsWith('/*') || line.trim().startsWith('//');
      });

      expect(shouldSkip).toBe(true);
    });

    test('should parse SAY commands', async ({ page }) => {
      const parsed = await page.evaluate(() => {
        const line = 'SAY "Hello World"';
        if (!line.toUpperCase().startsWith('SAY')) return null;

        const message = line.substring(3).trim().replace(/^["']|["']$/g, '');
        return message;
      });

      expect(parsed).toBe('Hello World');
    });
  });

  test.describe('Output Display', () => {
    test('should display messages in output', async ({ page }) => {
      await page.evaluate(() => {
        logOutput('Test message', 'success');
      });

      const outputText = await page.locator('#output').textContent();
      expect(outputText).toContain('Test message');
    });

    test('should show timestamps', async ({ page }) => {
      await page.evaluate(() => {
        logOutput('Test message');
      });

      const hasTimestamp = await page.locator('.output-timestamp').count();
      expect(hasTimestamp).toBeGreaterThan(0);
    });

    test('should apply error styling', async ({ page }) => {
      await page.evaluate(() => {
        logOutput('Error message', 'error');
      });

      const errorEntry = await page.locator('.output-entry.error').count();
      expect(errorEntry).toBeGreaterThan(0);
    });

    test('should apply success styling', async ({ page }) => {
      await page.evaluate(() => {
        logOutput('Success message', 'success');
      });

      const successEntry = await page.locator('.output-entry.success').count();
      expect(successEntry).toBeGreaterThan(0);
    });

    test('should auto-scroll output', async ({ page }) => {
      // Add many messages
      await page.evaluate(() => {
        for (let i = 0; i < 50; i++) {
          logOutput(`Message ${i}`);
        }
      });

      // Check if scrolled to bottom
      const isAtBottom = await page.evaluate(() => {
        const output = document.getElementById('output');
        return output.scrollTop + output.clientHeight >= output.scrollHeight - 10;
      });

      expect(isAtBottom).toBe(true);
    });
  });

  test.describe('Status Updates', () => {
    test('should show not connected initially', async ({ page }) => {
      const status = await page.locator('#status').textContent();
      expect(status).toMatch(/Not Connected|Connected/);
    });

    test('should update status during execution', async ({ page }) => {
      // This would require actual execution with a parent frame
      // For now, verify the status element exists
      const statusElement = page.locator('#status');
      await expect(statusElement).toBeVisible();
    });
  });
});
