
async function test() {
  const lat = 34.0901;
  const lng = -118.4065;
  const fccUrl = `https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=${lat}&lon=${lng}`;
  
  console.log("Testing FCC with Referer:", fccUrl);
  try {
    const resp = await fetch(fccUrl, {
      headers: {
        'Referer': 'https://www.fcc.gov/media/engineering/dtvmaps',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response (first 500):", text.substring(0, 500));
    const json = JSON.parse(text);
    console.log("Stations found:", json.stations?.length);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
