const { spawn } = require('child_process');

const server = spawn('npm', ['run', 'dev', '-w', 'server'], { stdio: 'inherit', shell: true });
const web = spawn('npm', ['run', 'dev', '-w', 'web'], { stdio: 'inherit', shell: true });

server.on('close', (code) => process.exit(code));
web.on('close', (code) => process.exit(code));
