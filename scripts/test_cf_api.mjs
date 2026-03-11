import fetch from 'node-fetch';

const CF_ACCOUNT_ID = '51aee885fbff69595ec806189f5de591';
const CF_API_TOKEN = 'L4a0dJChoKZGpChtCcIJAWMQjLcbLAtyiuD7yGs4';

async function testCF() {
  console.log('Testing Cloudflare Browser Rendering API...');
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/crawl`;
  
  try {
    // 1. Create Job
    const postResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: "https://example.com",
        limit: 1
      })
    });
    
    const postData = await postResp.json();
    console.log('POST Response:', JSON.stringify(postData, null, 2));
    
    if (postData.success) {
      const jobId = postData.result;
      console.log('Job ID:', jobId);
      
      // 2. Poll Job (immediately)
      const getResp = await fetch(`${url}/${jobId}`, {
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
      });
      const getData = await getResp.json();
      console.log('GET Response:', JSON.stringify(getData, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testCF();