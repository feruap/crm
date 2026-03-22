#!/usr/bin/env node
/**
 * run-migration-013.js
 * Runs migration 013 (superadmin + password reset + mail config) on the server.
 * Also sets feruap's password properly using the app's hashing function.
 *
 * Designed to run inside the Coolify container:
 *   NODE_PATH=/app/node_modules node /tmp/run-migration-013.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

// Same hash function as the app uses
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

async function runSQL(client, sql, label) {
  console.log(`\n--- Running: ${label} ---`);
  // Split carefully — avoid splitting inside function bodies
  const statements = sql.split(';').filter(s => s.trim().length > 0);
  let success = 0;
  let failed = 0;

  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    try {
      await client.query(trimmed);
      success++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  [SKIP] ${trimmed.substring(0, 80)}... (already exists)`);
        success++;
      } else {
        console.error(`  [FAIL] ${trimmed.substring(0, 80)}...`);
        console.error(`         ${err.message}`);
        failed++;
      }
    }
  }
  console.log(`  Completed: ${success} ok, ${failed} failed`);
  return { success, failed };
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connected to database');

    // Check current roles
    const roleCheck = await client.query(`
      SELECT role, COUNT(*) as c FROM agents GROUP BY role
    `);
    console.log('\nCurrent role distribution:');
    for (const r of roleCheck.rows) {
      console.log(`  ${r.role}: ${r.c}`);
    }

    // Run migration 013
    const migrationPath = path.join(__dirname, '../migrations/013_superadmin_password_reset_mail.sql');
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    await runSQL(client, migration, 'Migration 013: Superadmin + Password Reset + Mail Config');

    // Now set feruap's password properly
    const feruapPassword = 'feruap2026';
    const hashedPassword = hashPassword(feruapPassword);

    const updateResult = await client.query(`
      UPDATE agents SET password_hash = $1 WHERE email = 'feruap@gmail.com'
      RETURNING id, name, email, role
    `, [hashedPassword]);

    if (updateResult.rows.length > 0) {
      const a = updateResult.rows[0];
      console.log(`\n✓ feruap password set: ${a.name} (${a.email}) — role: ${a.role}`);
    } else {
      console.log('\n⚠ feruap@gmail.com not found in agents table');
    }

    // Insert default mail config
    const mailCheck = await client.query('SELECT COUNT(*) as c FROM system_mail_config');
    if (parseInt(mailCheck.rows[0].c) === 0) {
      await client.query(`
        INSERT INTO system_mail_config (email, password_encrypted, smtp_host, smtp_port, smtp_encryption, imap_host, imap_port, imap_encryption)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'crm-master@amunet.com.mx',
        'Tx40Amun2026Sec',
        'mail.amunet.com.mx',
        465,
        'SSL/TLS',
        'mail.amunet.com.mx',
        993,
        'SSL/TLS'
      ]);
      console.log('\n✓ Default mail config inserted (crm-master@amunet.com.mx)');
    } else {
      console.log('\n✓ Mail config already exists');
    }

    // Verify final state
    const finalRoles = await client.query(`
      SELECT role, COUNT(*) as c FROM agents GROUP BY role
    `);
    console.log('\nFinal role distribution:');
    for (const r of finalRoles.rows) {
      console.log(`  ${r.role}: ${r.c}`);
    }

    // Check new columns exist
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'agents' AND column_name IN ('reset_token', 'reset_token_expires')
    `);
    console.log(`\nPassword reset columns: ${colCheck.rows.map(r => r.column_name).join(', ') || 'MISSING'}`);

    // Check system_mail_config
    const mailExists = await client.query(`
      SELECT COUNT(*) as c FROM information_schema.tables WHERE table_name = 'system_mail_config'
    `);
    console.log(`system_mail_config table: ${mailExists.rows[0].c > 0 ? '✓ created' : '✗ MISSING'}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
