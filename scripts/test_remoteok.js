const axios = require('axios');

async function testRemoteOK() {
    const query = process.argv[2] || 'fullstack';
    const searchUrl = `https://remoteok.com/api?tag=${encodeURIComponent(query)}`;
    const REQUEST_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    };

    try {
        console.log(`Fetching ${searchUrl}...`);
        const { data } = await axios.get(searchUrl, {
            headers: REQUEST_HEADERS,
            timeout: 15000,
        });

        console.log('Data type:', typeof data);
        if (Array.isArray(data)) {
            console.log('Data length:', data.length);
            console.log('First item:', JSON.stringify(data[0], null, 2));
            
            const results = [];
            for (const item of data) {
                if (!item.position || !item.url) continue;
                results.push({
                    job_title: item.position,
                    company_name: item.company || null,
                    job_url: item.url,
                });
            }
            console.log('Parsed results count:', results.length);
            if (results.length > 0) {
                console.log('First result:', results[0]);
            }
        } else {
            console.log('Data is not an array:', data);
        }
    } catch (err) {
        console.error('API fetch failed:', err.message);
        if (err.response) {
            console.error('Response status:', err.response.status);
            console.error('Response data:', err.response.data);
        }
    }
}

testRemoteOK();
