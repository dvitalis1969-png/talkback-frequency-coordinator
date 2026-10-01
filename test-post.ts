
async function testPost() {
  const url = 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json';
  console.log("Testing POST to:", url);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.fcc.gov/media/engineering/dtvmaps'
      },
      body: 'lat=40.71&lon=-74.01'
    });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response starts with:", text.substring(0, 500).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testPost();
