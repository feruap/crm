const axios = require('axios');

const TOKEN = 'Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzcyODAwMDk5LCJpYXQiOjE3NzI3Nzg0OTksImp0aSI6IjA3ZDM2OTBlOWIxYjRlNzY5OTZhYmFlYWRkNjRkOWY3IiwidXNlcl9pZCI6IjU1NTUifQ.debHPyMclbaoUsUBFaRutWT0_W5RJoAfq3dwJdPlvrE';

async function main() {
    const urlsToTry = [
        `https://prod-api.myalice.ai/edge/crm/projects/4672/tickets/65859137/messages`,
        `https://prod-api.myalice.ai/edge/crm/projects/4672/conversations/wamid.HBgNNTIxMjQ2MjE2MjU2MBUCABIYFDNBNjJCQ0QzNkQxNzIwNjU0Q0QyAA==/messages`,
        `https://prod-api.myalice.ai/edge/crm/projects/4672/tickets/wamid.HBgNNTIxMjQ2MjE2MjU2MBUCABIYFDNBNjJCQ0QzNkQxNzIwNjU0Q0QyAA==/messages`,
        `https://prod-api.myalice.ai/edge/crm/projects/4672/chat/65859137/messages`
    ];

    for (const url of urlsToTry) {
        console.log(`Trying: ${url}`);
        try {
            const msgRes = await axios.get(url, { headers: { 'Authorization': TOKEN } });
            console.log(`SUCCESS!: Array is length ${msgRes.data.length || msgRes.data?.dataSource?.length} or raw keys: ${Object.keys(msgRes.data)}`);
            break;
        } catch (e) {
            console.log(`FAILED: ${e.response ? e.response.statusText : e.message}`);
        }
    }
}
main();
