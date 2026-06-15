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
  const { data: existing } = await supabase.from('exercises').select('name').eq('type', 'classic');
  const existingNames = existing ? existing.map(e => e.name) : [];
  
  const toInsert = [];
  if (!existingNames.includes('Klimmzüge')) {
    toInsert.push({ name: 'Klimmzüge', muscle_group: 'Rücken', type: 'classic', default_reps: 12 });
  }
  if (!existingNames.includes('Schulterdrücken (Kurzhantel)')) {
    toInsert.push({ name: 'Schulterdrücken (Kurzhantel)', muscle_group: 'Schulter', type: 'classic', default_reps: 12 });
  }

  if (toInsert.length > 0) {
    const { data, error } = await supabase.from('exercises').insert(toInsert).select();
    if (error) {
      console.error('Error inserting classic exercises:', error);
    } else {
      console.log('Successfully inserted exercises:', data);
    }
  } else {
    console.log('Classic exercises already exist.');
  }
}

run();
