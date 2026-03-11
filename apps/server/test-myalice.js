const axios = require('axios');
const fs = require('fs');

const TOKEN = 'Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzcyODAwMDk5LCJpYXQiOjE3NzI3Nzg0OTksImp0aSI6IjA3ZDM2OTBlOWIxYjRlNzY5OTZhYmFlYWRkNjRkOWY3IiwidXNlcl9pZCI6IjU1NTUifQ.debHPyMclbaoUsUBFaRutWT0_W5RJoAfq3dwJdPlvrE';

async function main() {
    try {
        const res = await axios.get('https://prod-api.myalice.ai/edge/crm/projects/4672/tickets?limit=1&channels=all', {
            headers: {
                'Authorization': TOKEN,
                'Accept': 'application/json'
            }
        });

        const tickets = res.data.dataSource || [];
        const ticket = tickets[0];
        console.log(`Ticket ID: ${ticket.id}, Conv ID: ${ticket.conversation_id}`);

        const urlsToTry = [
            `https://prod-api.myalice.ai/edge/crm/projects/4672/tickets/${ticket.id}/messages`,
            `https://prod-api.myalice.ai/edge/crm/projects/4672/conversations/${ticket.id}/messages`,
            `https://prod-api.myalice.ai/edge/crm/projects/4672/tickets/${ticket.conversation_id}/messages`,
            `https://prod-api.myalice.ai/edge/crm/projects/4672/conversations/${ticket.conversation_id}/messages`,
            `https://prod-api.myalice.ai/edge/crm/projects/4672/chat/${ticket.id}/messages`,
            `https://prod-api.myalice.ai/edge/crm/projects/4672/chat/${ticket.conversation_id}/messages`,
            `https://api.myalice.ai/edge/crm/projects/4672/tickets/${ticket.id}/messages`
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
    } catch (e) { console.error(e) }
}
main();
