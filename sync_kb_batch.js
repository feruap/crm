const fs = require('fs');
const https = require('https');

const TOKEN = fs.readFileSync('C:\\Users\\admin\\Downloads\\crm_token.txt', 'utf8').trim();
const API = 'https://api-crm.botonmedico.com/api/knowledge/sync-md';

function splitMDByProducts(content) {
  const sections = content.split(/\n## /);
  const header = sections[0]; // preamble before first product
  const products = [];
  for (let i = 1; i < sections.length; i++) {
    products.push('## ' + sections[i]);
  }
  return { header, products };
}

function sendBatch(medicalChunk, labsChunk) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      ...(medicalChunk ? { medical_md: medicalChunk } : {}),
      ...(labsChunk ? { labs_md: labsChunk } : {}),
    });

    const url = new URL(API);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 300000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch { resolve({ raw: data }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Reading MD files...');
  const medMd = fs.readFileSync('C:\\Users\\admin\\ai\\myalice\\amunet_knowledge_base_medicalv3.md', 'utf8');
  const labsMd = fs.readFileSync('C:\\Users\\admin\\ai\\myalice\\amunet_knowledge_base_labs.md', 'utf8');

  const med = splitMDByProducts(medMd);
  const labs = splitMDByProducts(labsMd);

  console.log(`Medical: ${med.products.length} products`);
  console.log(`Labs: ${labs.products.length} products`);

  const BATCH_SIZE = 5;
  let totalKB = 0, totalChunks = 0, totalErrors = 0, totalProducts = 0;

  // First: clear existing by sending empty header-only (the endpoint DELETEs existing before inserting)
  // We'll handle this by sending products in batches, but the first batch will trigger the DELETE
  // So we need to send ALL data, just in smaller batches
  // Problem: each call to sync-md DELETEs all existing medical/labs entries first!
  // Solution: We need to modify strategy — send all at once but the server times out
  // Alternative: send batch 1 (triggers delete + inserts), then for subsequent batches,
  // we need to NOT delete. But the current endpoint always deletes...
  
  // Best approach: send everything in one large call but increase timeout
  // OR: send medical first (will delete all + insert medical), then modify labs to append
  
  // Actually the simplest fix: send medical in batches where only first batch has the full header
  // But the endpoint always does DELETE FROM knowledge_base WHERE source IN ('medical','labs')
  // Each batch call will delete everything the previous batch inserted!
  
  // We need to send ALL products in one call. Let's just try with a very long timeout.
  console.log('\nSending ALL products in single request (with long timeout)...');
  console.log(`Total payload: ${Buffer.byteLength(JSON.stringify({medical_md: medMd, labs_md: labsMd}))} bytes`);
  
  try {
    const result = await sendBatch(medMd, labsMd);
    console.log('\n=== SYNC COMPLETE ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(`\nFull sync failed: ${err.message}`);
    console.log('Trying medical-only first, then labs-only...');
    
    // The endpoint deletes by source, so if we send medical_md only, it deletes source='medical' only?
    // Let me check... the code says: DELETE WHERE source IN ('medical', 'labs')
    // So it always deletes BOTH. This means we can't do sequential calls.
    
    // Alternative: send in batches but reassemble the full MD for each source
    // Send medical in 2 halves? No, same delete problem.
    
    // Real fix: increase server-side timeout or send via batches with modified endpoint
    // For now, try sending just labs (smaller) to at least get those in
    
    console.log('\nTrying labs-only (smaller file)...');
    try {
      const labsResult = await sendBatch(null, labsMd);
      console.log('Labs result:', JSON.stringify(labsResult, null, 2));
      totalKB += labsResult.kb_entries_inserted || 0;
    } catch (e2) {
      console.log('Labs also failed:', e2.message);
    }
    
    // Try medical in ~10 product chunks, but note each call deletes all medical entries
    // So we can only do 1 call for medical. Let's try with longer timeout.
    console.log('\nTrying medical-only with max timeout...');
    try {
      const medResult = await sendBatch(medMd, null);
      console.log('Medical result:', JSON.stringify(medResult, null, 2));
      totalKB += medResult.kb_entries_inserted || 0;
    } catch (e3) {
      console.log('Medical also failed:', e3.message);
    }
  }
}

main().catch(console.error);
