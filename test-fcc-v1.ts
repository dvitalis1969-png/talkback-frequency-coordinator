
async function testV1() {
  const url = 'https://data.fcc.gov/api/dtv-maps/v1.0/stations.json?lat=40.71&lon=-74.01';
  console.log("Testing FCC v1.0 API:", url);
  try {
    const resp = await fetch(url);
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response:", text.substring(0, 500).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testV1();
