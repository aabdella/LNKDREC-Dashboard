const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'REDACTED_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const egyptRegex = /Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October/i;

async function cleanup() {
  const { data: candidates, error } = await supabase
    .from('unvetted')
    .select('id, location')
    .eq('source', 'Deep Search');

  if (error) return console.error(error.message);

  const toDelete = candidates.filter(c => !egyptRegex.test(c.location)).map(c => c.id);
  
  if (toDelete.length > 0) {
    const { error: delError } = await supabase.from('unvetted').delete().in('id', toDelete);
    if (delError) console.error(delError.message);
    else console.log(`🗑️ Deleted ${toDelete.length} candidates outside Egypt.`);
  } else {
    console.log('✅ No candidates found outside Egypt to delete.');
  }
}
cleanup();
