import { db } from './src/db';

async function main() {
    try {
        await db.query(`
            INSERT INTO system_config (key, value) 
            VALUES 
                ('wc_url', 'https://www.amunet.com.mx'),
                ('wc_key', 'ck_e6bcac9f4e303917743d58334e49c7dc2cbbd016'),
                ('wc_secret', 'cs_774487218e32c07bbfe9061bbd7ad1ba6cace27e')
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        `);
        console.log('Woocommerce config updated successfully via pg!');
    } catch (e) {
        console.error(e);
    } finally {
        await db.end();
    }
}

main().catch(console.error).finally(() => process.exit(0));
