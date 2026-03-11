const { Pool } = require('pg');
const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });

async function checkCols(table) {
    const res = await p.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
    return { table, cols: res.rows };
}

Promise.all([
    checkCols('assignment_rules'),
    checkCols('teams')
]).then(res => console.log(JSON.stringify(res, null, 2))).catch(e => console.error(e)).finally(() => p.end());
