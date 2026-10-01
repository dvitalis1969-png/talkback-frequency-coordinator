
async function testEndpoint() {
  const endpoint = process.env.US_TV_API_ENDPOINT;
  console.log("Endpoint value exists:", !!endpoint);
  if (endpoint) {
    // Only show start/end for security if it looks like a key
    console.log("Endpoint starts with:", endpoint.substring(0, 15));
    
    try {
      const url = endpoint.includes('?') ? `${endpoint}&lat=40.71&lon=-74.01` : endpoint;
      console.log("Testing full URL:", url);
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log("Status:", resp.status);
      const text = await resp.text();
      console.log("Response (first 100):", text.substring(0, 100).replace(/\n/g, ' '));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
testEndpoint();
