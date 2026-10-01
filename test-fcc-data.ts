
async function test() {
  const lat = 34.0901;
  const lon = -118.4065;
  const url = `https://data.fcc.gov/api/dtv-maps/stations.json?lat=${lat}&lon=${lon}&dist=65`;
  console.log("Testing FCC Data API:", url);
  try {
    const resp = await fetch(url);
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response:", text.substring(0, 500));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
