const https = require('https');

function testModel(modelName) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: "Say 'working'" }],
      max_tokens: 5
    });

    const options = {
      hostname: 'integrate.api.nvidia.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
            resolve({ success: true, model: modelName, response: parsed.choices[0].message.content.trim() });
          } else {
            resolve({ success: false, model: modelName, error: 'Invalid response format' });
          }
        } catch (e) {
          resolve({ success: false, model: modelName, error: 'JSON parse error: ' + e.message });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, model: modelName, error: 'Request error: ' + e.message });
    });

    req.write(data);
    req.end();
  });
}

async function testModels() {
  // Models to test based on what we know works and from the API list
  const modelsToTest = [
    "nvidia/llama-3.1-nemotron-70b-instruct",  // from hardcoded list
    "nvidia/llama-3.3-nemotron-super-49b-v1",  // from hardcoded list
    "z-ai/glm-5.1",                           // user said this works
    "nvidia/openai/gpt-oss-120b",             // user said this works
    "nvidia/llama-3.1-nemotron-51b-instruct", // from API list
    "nvidia/nemotron-4-340b-instruct",        // from API list
    "nvidia/nemotron-mini-4b-instruct",       // from API list
    "nvidia/llama-3.1-nemotron-nano-8b-v1",   // from API list
    "nvidia/llama3-chatqa-1.5-70b",           // from API list
    "nvidia/nemotron-3-super-120b-a12b"       // from API list
  ];

  console.log('Testing NVIDIA models with your API key...');
  console.log('='.repeat(50));

  const results = [];
  for (const model of modelsToTest) {
    try {
      const result = await testModel(model);
      results.push(result);
      if (result.success) {
        console.log(`✓ ${model.padEnd(45)} | ${result.response}`);
      } else {
        console.log(`✗ ${model.padEnd(45)} | FAILED`);
      }
    } catch (error) {
      results.push({ success: false, model: model, error: error.message });
      console.log(`✗ ${model.padEnd(45)} | EXCEPTION`);
    }
  }

  console.log('='.repeat(50));
  console.log(`Summary: ${results.filter(r => r.success).length}/${results.length} models working`);

  const working = results.filter(r => r.success);
  if (working.length > 0) {
    console.log('\nWorking models:');
    working.forEach(r => {
      console.log(`  - ${r.model}: "${r.response}"`);
    });
  }

  return results;
}

testModels().catch(console.error);