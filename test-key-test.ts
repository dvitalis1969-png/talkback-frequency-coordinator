
async function run() {
  const url = 'https://www.rabbitears.info/api/xml.php?method=getSignalReport&lat=40.71&lon=-74.01&ant_height=10&key=test';
  console.log("Testing with key=test:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response:", text.substring(0, 500).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
