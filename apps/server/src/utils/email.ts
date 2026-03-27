import nodemailer from 'nodemailer';
import { db } from '../db';

async function getSmtpSettings(): Promise<Record<string, string>> {
    const result = await db.query(
        `SELECT key, value FROM settings WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','smtp_secure')`
    );
    const map: Record<string, string> = {};
    for (const r of result.rows) map[r.key] = r.value;
    return map;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
    const cfg = await getSmtpSettings();

    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
        throw new Error('SMTP no configurado. Ve a Ajustes → Email para configurarlo.');
    }

    const transporter = nodemailer.createTransport({
        host: cfg.smtp_host,
        port: parseInt(cfg.smtp_port || '587'),
        secure: cfg.smtp_secure === 'true',
        auth: {
            user: cfg.smtp_user,
            pass: cfg.smtp_pass,
        },
    });

    await transporter.sendMail({
        from: cfg.smtp_from || cfg.smtp_user,
        to,
        subject,
        html,
    });
}
