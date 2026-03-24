const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrzajerliyyddfyvggd.supabase.co';
const supabaseKey = 'REDACTED_SERVICE_ROLE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const egyptRegex = /Egypt|Cairo|Alexandria|Giza|Maadi|Heliopolis|Dokki|Nasr[ \t]City|Sheikh[ \t]Zayed|October/i;

async function filterCandidates() {
  console.log('🔍 Fetching candidates from recent sourcing run...');
  const { data: candidates, error } = await supabase
    .from('unvetted')
    .select('id, full_name, location, source')
    .eq('source', 'Deep Search');

  if (error) {
    console.error('Error fetching candidates:', error.message);
    return;
  }

  const inEgypt = [];
  const outsideEgypt = [];

  candidates.forEach(c => {
    if (egyptRegex.test(c.location)) {
      inEgypt.push(c);
    } else {
      outsideEgypt.push(c);
    }
  });

  console.log('--- EGYPT BASED ---');
  inEgypt.slice(0, 10).forEach(c => console.log(`🇪🇬 ${c.full_name} (${c.location})`));
  console.log(`Total Egypt: ${inEgypt.length}`);

  console.log('\n--- OUTSIDE EGYPT (TO BE REMOVED) ---');
  outsideEgypt.slice(0, 10).forEach(c => console.log(`🇸🇦/🌍 ${c.full_name} (${c.location})`));
  console.log(`Total to Remove: ${outsideEgypt.length}`);
}

filterCandidates();
