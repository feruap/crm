const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });
p.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    .then(r => console.log(r.rows.map(row => row.table_name)))
    .finally(() => p.end());
