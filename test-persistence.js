// Persistence test for chat endpoint auto-fill
const { syncPlaywright } = require('playwright');
(async () => {
  const SERVER_PORT = 9877;
  const UI_DIR = "S:/Archivist-Agent/ui";
  const { spawn } = require('child_process');
  // Start HTTP server via Python simple server? Use node http-server? We'll reuse same test script's server code.
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
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
  const server = http.createServer(handler).listen(SERVER_PORT);
  const p = syncPlaywright();
  const browser = p.chromium.launch({ headless: true });
  const page = browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto(`http://127.0.0.1:${SERVER_PORT}`);
  await page.waitForLoadState('networkidle');
  // Fill API key with OpenAI style
  await page.fill('#chat-api-key', 'sk-testkey123');
  // Wait for auto-fill (short timeout)
  await page.waitForTimeout(500);
  const endpointVal = await page.inputValue('#chat-endpoint');
  console.log('Endpoint after input:', endpointVal);
  // Click save settings button
  await page.click('#btn-chat-save-settings');
  // Wait for save status to settle
  await page.waitForTimeout(1000);
  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');
  const endpointAfterReload = await page.inputValue('#chat-endpoint');
  console.log('Endpoint after reload:', endpointAfterReload);
  await browser.close();
  server.close();
})();
