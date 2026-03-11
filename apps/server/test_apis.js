const axios = require('axios');
(async () => {
    try {
        const login = await axios.post('http://localhost:3001/api/auth/login', { email: 'admin@myalice.ai', password: 'admin123' });
        const token = login.data.token;
        console.log('Got token');

        console.log('Fetching /api/automations...');
        const auto = await axios.get('http://localhost:3001/api/automations', { headers: { Authorization: `Bearer ${token}` } });
        console.log('Automations:', auto.data.length);

        console.log('Fetching /api/assignment-rules...');
        const rules = await axios.get('http://localhost:3001/api/assignment-rules', { headers: { Authorization: `Bearer ${token}` } });
        console.log('Rules:', rules.data.length);

        console.log('Fetching /api/channels...');
        const channels = await axios.get('http://localhost:3001/api/channels', { headers: { Authorization: `Bearer ${token}` } });
        console.log('Channels:', channels.data.length);

        console.log('Fetching /api/agents...');
        const agents = await axios.get('http://localhost:3001/api/agents', { headers: { Authorization: `Bearer ${token}` } });
        console.log('Agents:', agents.data.length);

    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
})();
