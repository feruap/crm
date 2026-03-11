const axios = require('axios');
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const db = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testSync() {
    try {
        await db.connect();
        console.log('--- Iniciando Prueba de Sincronización Google Ads ---');

        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
        let developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;

        const rtRow = await db.query("SELECT value FROM business_settings WHERE key = 'google_refresh_token'");
        const refreshToken = rtRow.rows[0]?.value;

        if (!refreshToken) {
            console.error('❌ ERROR: No se encontró google_refresh_token en la base de datos.');
            return;
        }

        console.log('✅ Refresh Token encontrado.');

        // 1. Obtener Access Token
        console.log('Refrescando Access Token...');
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token',
            new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenRes.data.access_token;
        console.log('✅ Access Token obtenido.');

        // 2. Listar Clientes
        console.log('Consultando cuentas de clientes accesibles...');
        const customersRes = await axios.get('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'developer-token': developerToken
            }
        });

        const accounts = customersRes.data.resourceNames || [];
        console.log(`✅ Cuentas encontradas: ${accounts.length}`);

        for (const account of accounts) {
            const customerId = account.replace('customers/', '');
            console.log(`Consultando campañas para la cuenta: ${customerId}...`);

            const searchRes = await axios.post(
                `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
                {
                    query: `SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED'`
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'developer-token': developerToken,
                        'login-customer-id': customerId
                    }
                }
            );

            const campaigns = searchRes.data.results || [];
            console.log(`   - Encontradas ${campaigns.length} campañas activas.`);
            campaigns.forEach(c => console.log(`     * [${c.campaign.id}] ${c.campaign.name} (${c.campaign.status})`));
        }

        console.log('--- Prueba Finalizada con Éxito ---');

    } catch (error) {
        console.error('❌ ERROR DURANTE LA PRUEBA:');
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    } finally {
        await db.end();
    }
}

testSync();
