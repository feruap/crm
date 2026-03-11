const { Pool } = require('pg');
const fs = require('fs');
const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });
p.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' and table_name IN ('assignment_rules','teams','channels')")
    .then(r => fs.writeFileSync('schema_output.json', JSON.stringify(r.rows, null, 2)))
    .finally(() => p.end());
