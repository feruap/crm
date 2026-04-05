const fs = require('fs');
const https = require('https');

const TOKEN = fs.readFileSync('C:\\Users\\admin\\Downloads\\crm_token.txt', 'utf8').trim();
const API = 'https://api-crm.botonmedico.com/api/knowledge/sync-md';

function sendRequest(body) {
  return new Promise((resolve, reject) => {
    const jsonBody = JSON.stringify(body);
    const url = new URL(API);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(jsonBody),
      },
      timeout: 300000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(jsonBody);
    req.end();
  });
}

async function main() {
  const labsMd = fs.readFileSync('C:\\Users\\admin\\ai\\myalice\\amunet_knowledge_base_labs.md', 'utf8');
  console.log('Sending labs sync...');
  const result = await sendRequest({ labs_md: labsMd });
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
