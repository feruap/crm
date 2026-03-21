import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/widget-config
router.get('/', async (req: Request, res: Response) => {
    const livechatUrl = process.env.NEXT_PUBLIC_WEB_URL
        ? `${process.env.NEXT_PUBLIC_WEB_URL}/livechat`
        : (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001').replace('api-crm', 'crm').replace(/:\d+$/, '') + '/livechat';

    const result = await db.query('SELECT * FROM widget_configs WHERE is_active = TRUE LIMIT 1');
    if (result.rows.length === 0) {
        // Return default config
        return res.json({
            name: 'Mi Widget',
            channels: [],
            bg_color: '#5A59D5',
            text_color: '#FFFFFF',
            welcome_text: '¿Cómo podemos ayudarte?',
            position: 'right',
            is_active: true,
            livechat_url: livechatUrl
        });
    }
    res.json({ ...result.rows[0], livechat_url: livechatUrl });
});

// PUT /api/widget-config
router.put('/', requireAuth, async (req: Request, res: Response) => {
    const { name, channels, bg_color, text_color, welcome_text, position, is_active } = req.body;

    const existing = await db.query('SELECT id FROM widget_configs LIMIT 1');

    if (existing.rows.length > 0) {
        const result = await db.query(
            `UPDATE widget_configs 
             SET name = $1, channels = $2, bg_color = $3, text_color = $4, 
                 welcome_text = $5, position = $6, is_active = $7, 
                 embed_code_version = embed_code_version + 1, updated_at = NOW()
             WHERE id = $8
             RETURNING *`,
            [name, JSON.stringify(channels), bg_color, text_color, welcome_text, position, is_active, existing.rows[0].id]
        );
        res.json(result.rows[0]);
    } else {
        const result = await db.query(
            `INSERT INTO widget_configs (name, channels, bg_color, text_color, welcome_text, position, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, JSON.stringify(channels), bg_color, text_color, welcome_text, position, is_active]
        );
        res.json(result.rows[0]);
    }
});

// GET /api/widget-config/embed-code
router.get('/embed-code', async (req: Request, res: Response) => {
    const result = await db.query('SELECT embed_code_version FROM widget_configs LIMIT 1');
    const version = result.rows[0]?.embed_code_version || 1;
    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

    const code = `
<!-- MyAlice LeadClick Widget -->
<script>
  window.myAliceConfig = {
    apiUrl: "${serverUrl}",
    v: ${version}
  };
</script>
<script src="${serverUrl}/widget.js" async></script>
<!-- End MyAlice LeadClick Widget -->
    `.trim();

    res.json({ code });
});

export default router;
