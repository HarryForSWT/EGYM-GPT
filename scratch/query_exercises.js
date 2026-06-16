const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valParts] = line.split('=');
    const val = valParts.join('=').trim();
    if (key) env[key.trim()] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('exercises').select('id, name, type, muscle_group');
  if (error) {
    console.error('Error fetching exercises:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
