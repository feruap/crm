import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// GET /api/settings/business-hours
router.get('/', async (_req: Request, res: Response) => {
    const hours = await db.query(`SELECT * FROM business_hours ORDER BY day_of_week ASC`);
    const settings = await db.query(`SELECT key, value FROM business_settings`);

    const settingsMap: Record<string, string> = {};
    for (const row of settings.rows) settingsMap[row.key] = row.value;

    res.json({
        hours: hours.rows.map(h => ({
            ...h,
            day_name: DAY_NAMES[h.day_of_week],
            open_time:  h.open_time?.slice(0, 5),   // HH:MM
            close_time: h.close_time?.slice(0, 5),
        })),
        timezone:              settingsMap.timezone              ?? 'America/Mexico_City',
        after_hours_message:   settingsMap.after_hours_message   ?? '',
        auto_reply_enabled:    settingsMap.auto_reply_enabled    === 'true',
    });
});

// PATCH /api/settings/business-hours  — update one or all days + settings
router.patch('/', async (req: Request, res: Response) => {
    const { hours, timezone, after_hours_message, auto_reply_enabled } = req.body;

    // Update each day if provided
    if (Array.isArray(hours)) {
        for (const h of hours) {
            await db.query(
                `UPDATE business_hours
                 SET is_open = $1, open_time = $2, close_time = $3
                 WHERE day_of_week = $4`,
                [h.is_open, h.open_time, h.close_time, h.day_of_week]
            );
        }
    }

    // Update settings
    if (timezone !== undefined) {
        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('timezone', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [timezone]
        );
    }
    if (after_hours_message !== undefined) {
        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('after_hours_message', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [after_hours_message]
        );
    }
    if (auto_reply_enabled !== undefined) {
        await db.query(
            `INSERT INTO business_settings (key, value) VALUES ('auto_reply_enabled', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [auto_reply_enabled ? 'true' : 'false']
        );
    }

    res.json({ ok: true });
});

export default router;
