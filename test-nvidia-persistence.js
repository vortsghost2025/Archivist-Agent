// Persistence test for NVIDIA chat endpoint auto-fill using Playwright async API
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const UI_DIR = "S:/Archivist-Agent/ui";
const SERVER_PORT = 9879;

function startServer() {
  const handler = (req, res) => {
    let filePath = path.join(UI_DIR, req.url === '/' ? 'index.html' : req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
      } else {
        res.writeHead(200);
        res.end(data);
      }
    });
  };
  return http.createServer(handler).listen(SERVER_PORT);
}

(async () => {
  const server = startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`http://127.0.0.1:${SERVER_PORT}`);
  await page.waitForLoadState('networkidle');
  // Fill API key with NVIDIA style (any key not matching OpenAI/Anthropic patterns)
  await page.fill('#chat-api-key', 'nvapi-testkey123');
  // Wait for auto-fill to trigger
  await page.waitForTimeout(500);
  const endpointVal = await page.inputValue('#chat-endpoint');
  console.log('Endpoint after input:', endpointVal);
  // Click save settings
  await page.click('#btn-chat-toggle-settings');
  await page.waitForTimeout(200);
  await page.click('#btn-chat-save-settings');
  await page.waitForTimeout(1000);
  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');
  const endpointAfterReload = await page.inputValue('#chat-endpoint');
  console.log('Endpoint after reload:', endpointAfterReload);
  await browser.close();
  server.close();
})();