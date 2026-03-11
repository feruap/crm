const { Pool } = require('pg');
async function run() {
    const p = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/myalice_clone' });
    try {
        await p.query("UPDATE ai_settings SET api_key_encrypted = '183a3da87bbd4bbea3732ca88de8bb16.gbebMDkBzjOAwAAB', model_name = 'glm-5' WHERE provider = 'z_ai' AND is_default = TRUE");
        console.log('Updated to glm-5 and new key in DB.');
    } catch (e) {
        console.error(e.message);
    } finally {
        p.end();
    }
}
run();
