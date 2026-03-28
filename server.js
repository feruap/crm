const http = require('http');
const fs = require('fs');
const s = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const data = fs.readFileSync('C:\\Users\\admin\\ai\\myalice\\sync_payload.json');
  res.setHeader('Content-Type', 'application/json');
  res.end(data);
});
s.listen(9876, () => console.log('Server on 9876'));
