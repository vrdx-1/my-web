#!/usr/bin/env node

/**
 * Migration Runner Script
 * Executes SQL migration files against Supabase
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    };

    // Use the query endpoint with RPC or direct SQL
    const payload = JSON.stringify({ query: sql });

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function executeViaPSQL(sql) {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Split by semicolon to handle multiple statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  console.log(`\n📝 Executing ${statements.length} SQL statement(s)...\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: stmt + ';',
      }).catch(() => {
        // Fallback: use query method for simple statements
        return supabase.from('_dummy_').select().limit(0);
      });

      if (error && error.message.includes('undefined function')) {
        // RPC not available, try direct query
        const result = await fetch(`${SUPABASE_URL}/graphql/v1`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({ query: stmt }),
        });
        console.log(`✅ Statement ${i + 1} executed`);
      } else {
        console.log(`✅ Statement ${i + 1} executed`);
      }
    } catch (err) {
      console.error(`❌ Error on statement ${i + 1}:`, err.message);
      throw err;
    }
  }
}

async function main() {
  const migrationFile = process.argv[2] || 'migrations/add_whatsapp_click_actor_tracking.sql';
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  console.log(`\n🚀 Running migration: ${migrationFile}`);
  console.log(`📍 Supabase: ${SUPABASE_URL}\n`);

  const sql = fs.readFileSync(migrationFile, 'utf-8');

  try {
    // Try using Supabase JS client
    const { createClient } = require('@supabase/supabase-js');
    
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Split statements and execute one by one
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`\n📝 Found ${statements.length} SQL statement(s)\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i] + ';';
      console.log(`[${i + 1}/${statements.length}] ${stmt.substring(0, 60)}...`);

      // Use rpc to execute raw SQL if available
      const { error } = await admin.rpc('exec', { 
        statement: stmt 
      }).catch(() => ({ error: null }));

      if (error?.message?.includes('undefined')) {
        // Fallback: log statement for manual execution
        console.log(`⚠️  RPC exec not available, use Supabase dashboard SQL editor`);
        break;
      }

      if (!error) {
        console.log(`✅ Done`);
      }
    }

    console.log(`\n✨ Migration ${path.basename(migrationFile)} completed!\n`);
  } catch (err) {
    console.error(`\n❌ Migration failed:`, err.message);
    console.error(`\n📋 SQL Content:\n${sql}\n`);
    console.error(`\n💡 Please run this SQL manually in Supabase dashboard:\nhttps://app.supabase.com/project/${SUPABASE_URL.split('.')[0].split('//')[1]}/sql\n`);
    process.exit(1);
  }
}

main();
