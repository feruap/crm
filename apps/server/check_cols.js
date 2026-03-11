const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });

async function checkCols(table) {
    const res = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
    console.log(table, ":", res.rows);
}

Promise.all([
    checkCols('assignment_rules'),
    checkCols('teams'),
    checkCols('team_members')
]).finally(() => p.end());
