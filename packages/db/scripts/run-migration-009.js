#!/usr/bin/env node
/**
 * run-migration-009.js
 * Runs migration 009 (KB integration schema) + 009b (KB product seed) on the server.
 * Designed to run inside the Coolify container:
 *   NODE_PATH=/app/node_modules node /tmp/run-migration-009.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function runSQL(client, sql, label) {
  console.log(`\n--- Running: ${label} ---`);
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
      // Some statements like CREATE INDEX IF NOT EXISTS might fail harmlessly
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

    // Check current state
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'medical_products'
      ORDER BY ordinal_position
    `);
    console.log(`\nCurrent medical_products columns: ${colCheck.rows.length}`);
    console.log(colCheck.rows.map(r => r.column_name).join(', '));

    // Check existing products
    const prodCount = await client.query('SELECT COUNT(*) as c FROM medical_products');
    console.log(`\nExisting products: ${prodCount.rows[0].c}`);

    // Run migration 009 (schema changes)
    const migration009 = fs.readFileSync(path.join(__dirname, '../migrations/009_knowledge_base_integration.sql'), 'utf-8');
    await runSQL(client, migration009, 'Migration 009: Schema Extension');

    // Verify new columns exist
    const newColCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'medical_products'
      ORDER BY ordinal_position
    `);
    console.log(`\nPost-migration columns: ${newColCheck.rows.length}`);
    const newCols = newColCheck.rows.map(r => r.column_name);
    const expectedNew = ['pitch_medico', 'pitch_laboratorio', 'presentaciones', 'target_audience', 'palabras_clave'];
    for (const col of expectedNew) {
      console.log(`  ${col}: ${newCols.includes(col) ? '✓' : '✗ MISSING'}`);
    }

    // Check if knowledge_gaps table was created
    const kgCheck = await client.query(`
      SELECT COUNT(*) as c FROM information_schema.tables
      WHERE table_name = 'knowledge_gaps'
    `);
    console.log(`\nknowledge_gaps table: ${kgCheck.rows[0].c > 0 ? '✓ created' : '✗ MISSING'}`);

    // Run seed (009b)
    const seed = fs.readFileSync(path.join(__dirname, '../migrations/009b_seed_kb_products.sql'), 'utf-8');

    // The seed file has complex multi-line INSERT statements — run them differently
    // Split by the "-- Product:" comment markers
    const productBlocks = seed.split(/(?=-- Product:)/);
    let inserted = 0;
    let errors = 0;

    // First run the CREATE UNIQUE INDEX statement
    const preamble = productBlocks[0];
    if (preamble.trim()) {
      try {
        await client.query(preamble);
        console.log('\n✓ Unique index on url_tienda created');
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('\n✓ Unique index on url_tienda already exists');
        } else {
          console.error(`\n✗ Index error: ${err.message}`);
        }
      }
    }

    for (let i = 1; i < productBlocks.length; i++) {
      const block = productBlocks[i].trim();
      if (!block) continue;

      const nameMatch = block.match(/-- Product: (.+)/);
      const productName = nameMatch ? nameMatch[1] : `Block ${i}`;

      try {
        await client.query(block);
        inserted++;
        if (inserted % 10 === 0) console.log(`  Inserted ${inserted} products...`);
      } catch (err) {
        console.error(`  [FAIL] ${productName}: ${err.message.substring(0, 100)}`);
        errors++;
      }
    }

    console.log(`\n--- Seed Results ---`);
    console.log(`  Products inserted/updated: ${inserted}`);
    console.log(`  Errors: ${errors}`);

    // Final count
    const finalCount = await client.query('SELECT COUNT(*) as c FROM medical_products WHERE is_active = TRUE');
    console.log(`\n  Total active products in DB: ${finalCount.rows[0].c}`);

    // Show audience distribution
    const audienceCheck = await client.query(`
      SELECT
        CASE
          WHEN 'medico' = ANY(target_audience) AND 'laboratorio' = ANY(target_audience) THEN 'both'
          WHEN 'medico' = ANY(target_audience) THEN 'medico_only'
          WHEN 'laboratorio' = ANY(target_audience) THEN 'lab_only'
          ELSE 'none'
        END as audience,
        COUNT(*) as c
      FROM medical_products
      WHERE target_audience IS NOT NULL
      GROUP BY 1
    `);
    console.log('\n  Audience distribution:');
    for (const row of audienceCheck.rows) {
      console.log(`    ${row.audience}: ${row.c}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
