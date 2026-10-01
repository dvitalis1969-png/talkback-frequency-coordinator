
async function testReferer() {
  const url = 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.71&lon=-74.01';
  console.log("Testing FCC with Referer:", url);
  try {
    const resp = await fetch(url, {
      headers: {
        'Referer': 'https://www.fcc.gov/media/engineering/dtvmaps',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response (first 500):", text.substring(0, 500).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testReferer();
