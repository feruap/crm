const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });
p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'campaigns'")
    .then(r => console.log(JSON.stringify(r.rows, null, 2)))
    .finally(() => p.end());
