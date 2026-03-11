import { Router } from 'express';
import { db } from '../db';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const pRes = await db.query('SELECT * FROM pipelines ORDER BY created_at ASC');
        const sRes = await db.query('SELECT * FROM pipeline_stages ORDER BY pipeline_id, order_index ASC');

        const pipelines = pRes.rows.map(p => ({
            ...p,
            stages: sRes.rows.filter(s => s.pipeline_id === p.id)
        }));

        res.json(pipelines);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: 'DB error' });
    }
});

// Create pipeline
router.post('/', async (req, res) => {
    const { name, description } = req.body;
    try {
        const r = await db.query(
            'INSERT INTO pipelines (name, description) VALUES ($1, $2) RETURNING *',
            [name, description]
        );
        const pipeline = r.rows[0];
        // Create default stages
        await db.query(
            `INSERT INTO pipeline_stages (pipeline_id, name, color, order_index) VALUES 
            ($1, 'Nuevo', '#e2e8f0', 0),
            ($1, 'En proceso', '#bfdbfe', 1),
            ($1, 'Ganado', '#bbf7d0', 2)`,
            [pipeline.id]
        );
        res.json(pipeline);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Create stage
router.post('/:id/stages', async (req, res) => {
    const { id } = req.params;
    const { name, color, order_index } = req.body;
    try {
        const r = await db.query(
            'INSERT INTO pipeline_stages (pipeline_id, name, color, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, name, color, order_index || 0]
        );
        res.json(r.rows[0]);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Sync Kanban columns and roles from WooCommerce
router.post('/sync-woocommerce', async (req, res) => {
    try {
        const wcUrl = process.env.WC_URL;
        const bridgeSecret = process.env.WP_MYALICE_SECRET;

        if (!wcUrl || !bridgeSecret) {
            res.status(400).json({ error: 'Configuración WC_URL o WP_MYALICE_SECRET faltante en .env' });
            return;
        }

        // Llamada al endpoint bridge que debe leer opciones de 'kanban-for-woocommerce' (wp_options o el propio plugin)
        const response = await fetch(`${wcUrl}/wp-json/myalice/v1/kanban-columns`, {
            headers: { 'X-MyAlice-Secret': bridgeSecret }
        });

        if (!response.ok) {
            throw new Error(`Error en el bridge de WP: ${response.status}`);
        }

        const data: any = await response.json();
        // data.columns => [{ id, title, color, order }]
        // data.permissions => { role: ['move_cards', ...] }

        if (!data.columns || data.columns.length === 0) {
            res.json({ message: 'No se encontraron columnas de kanban en WooCommerce' });
            return;
        }

        // Upsert el pipeline "WooCommerce Kanban"
        let pRes = await db.query(`SELECT id FROM pipelines WHERE name = 'WooCommerce Kanban' LIMIT 1`);
        let pipelineId;

        if (pRes.rows.length === 0) {
            const insRes = await db.query(
                `INSERT INTO pipelines (name, description) VALUES ('WooCommerce Kanban', 'Sincronizado desde WooCommerce') RETURNING id`
            );
            pipelineId = insRes.rows[0].id;
        } else {
            pipelineId = pRes.rows[0].id;
        }

        // Limpiar los stages actuales de este pipeline
        await db.query(`DELETE FROM pipeline_stages WHERE pipeline_id = $1`, [pipelineId]);

        // Insertar los que vienen de WC
        for (const col of data.columns) {
            await db.query(
                `INSERT INTO pipeline_stages (pipeline_id, name, color, order_index) VALUES ($1, $2, $3, $4)`,
                [pipelineId, col.title, col.color || '#e2e8f0', col.order || Number(col.id)]
            );
        }

        // Si existen permisos mapearlos (Simulación de permisos guardando en configuraciones)
        if (data.permissions) {
            await db.query(
                `INSERT INTO business_settings (key, value) VALUES ('kanban_permissions', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
                [JSON.stringify(data.permissions)]
            );
        }

        res.json({ ok: true, synced_columns: data.columns.length, pipelineId });
    } catch (err: any) {
        console.error('Error sincronizando kanban:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
