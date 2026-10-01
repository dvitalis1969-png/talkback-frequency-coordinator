
async function test() {
  const lat = 34.0901;
  const lng = -118.4065;
  const url = `https://api.fcc.gov/dtvmaps/services/reporting/stations/nearby?lat=${lat}&lon=${lng}`;
  console.log("Testing FCC API:", url);
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
