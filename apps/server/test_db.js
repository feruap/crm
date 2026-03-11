const { Client } = require('pg');

const client = new Client({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'myalice_clone',
    password: 'postgres',
    port: 5432
});

client.connect()
    .then(() => {
        console.log('Connected!');
        return client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    })
    .then(res => {
        console.log(res.rows);
        client.end();
    })
    .catch(err => {
        console.error('Connection error', err.stack);
        client.end();
    });
