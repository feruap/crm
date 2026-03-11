const { Pool } = require('pg');
async function run() {
    const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });
    try {
        await p.query("UPDATE ai_settings SET model_name = 'glm-4.7-flash' WHERE provider = 'z_ai'");
        console.log('Updated to glm-4.7-flash successfully.');
    } catch (e) {
        console.error(e.message);
    } finally {
        p.end();
    }
}
run();
