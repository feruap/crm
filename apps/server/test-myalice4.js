const axios = require('axios');

const TOKEN = 'Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzcyODAwMDk5LCJpYXQiOjE3NzI3Nzg0OTksImp0aSI6IjA3ZDM2OTBlOWIxYjRlNzY5OTZhYmFlYWRkNjRkOWY3IiwidXNlcl9pZCI6IjU1NTUifQ.debHPyMclbaoUsUBFaRutWT0_W5RJoAfq3dwJdPlvrE';

async function main() {
    const proj = '4672';
    const t_id = '65859137'; // id
    const c_id = 'wamid.HBgNNTIxMjQ2MjE2MjU2MBUCABIYFDNBNjJCQ0QzNkQxNzIwNjU0Q0QyAA=='; // conversation_id

    const paths = [
        `/edge/crm/projects/${proj}/tickets/${t_id}/messages`,
        `/edge/crm/projects/${proj}/tickets/${t_id}/messages/`,
        `/edge/crm/projects/${proj}/tickets/${c_id}/messages`,
        `/edge/crm/projects/${proj}/tickets/${c_id}/messages/`,
        `/edge/crm/tickets/${t_id}/messages`,
        `/edge/crm/tickets/${c_id}/messages`,
        `/edge/crm/messages/${t_id}`,
        `/edge/crm/messages/${c_id}`,
        `/edge/crm/messages?ticket_id=${t_id}`,
        `/edge/crm/messages?conversation_id=${c_id}`,
        `/edge/crm/projects/${proj}/messages/${t_id}`,
        `/edge/crm/projects/${proj}/messages?ticket_id=${t_id}`,
        `/edge/app/projects/${proj}/tickets/${t_id}/messages`
    ];

    for (const p of paths) {
        const url = `https://prod-api.myalice.ai${p}`;
        console.log(`Trying: ${url}`);
        try {
            const res = await axios.get(url, { headers: { 'Authorization': TOKEN } });
            console.log(`\n\nSUCCESS! ${url}\nData keys: ${Object.keys(res.data)}, Array length: ${res.data.length || res.data?.dataSource?.length}\n\n`);
            return;
        } catch (e) {
            // failed
        }
    }
    console.log("All failed.");
}
main();
