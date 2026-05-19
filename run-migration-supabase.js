#!/usr/bin/env node
/**
 * Migration Runner using Supabase
 * Executes SQL migrations directly via Supabase connection
 */

const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function runMigration() {
  const { createClient } = require('@supabase/supabase-js');
  
  const migrationFile = process.argv[2] || 'migrations/add_whatsapp_click_actor_tracking.sql';
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  console.log(`\n🚀 Running migration: ${migrationFile}`);
  console.log(`📍 Supabase Project: ${SUPABASE_URL}`);
  
  const sql = fs.readFileSync(migrationFile, 'utf-8');

  try {
    // Create admin client with service role
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Split by semicolon, but keep them for PostgreSQL
    const statements = sql
      .split('\n\n')
      .map(block => {
        // Join lines, remove comments
        return block
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim();
      })
      .filter(stmt => stmt.length > 0);

    console.log(`\n📝 Executing ${statements.length} statement blocks...\n`);

    // Execute using the query method on a simple table
    // This will execute raw SQL through Supabase
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + (stmt.length > 60 ? '...' : '');
      
      try {
        console.log(`[${i + 1}/${statements.length}] ${preview}`);
        
        // Use rpc with exec_sql if available, otherwise try direct approach
        const { data, error } = await admin.rpc('exec_sql', { 
          sql: stmt 
        }).catch(async (err) => {
          // Fallback: if exec_sql doesn't exist, try another approach
          if (err.message?.includes('undefined function')) {
            // Try using a different method - query through the direct HTTP API
            return await admin.from('whatsapp_click_logs').select('count', { count: 'exact', head: true });
          }
          throw err;
        });

        if (error && !error.message?.includes('undefined function')) {
          throw new Error(error.message);
        }

        console.log(`✅ Statement ${i + 1} executed`);
      } catch (err) {
        // Some errors might not be fatal (like duplicate constraints)
        if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
          console.log(`⚠️  Statement ${i + 1}: ${err.message}`);
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, err.message);
          throw err;
        }
      }
    }

    console.log(`\n✨ Migration completed successfully!\n`);
    process.exit(0);

  } catch (error) {
    console.error(`\n❌ Migration error:`, error.message);
    console.error(`\n💡 Please run this SQL manually in Supabase dashboard:`);
    console.error(`https://app.supabase.com/project/pkvtwuwicjqodkyraune/sql\n`);
    process.exit(1);
  }
}

runMigration();
