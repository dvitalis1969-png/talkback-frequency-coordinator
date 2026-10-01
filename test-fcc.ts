async function run() {
  try {
    const lat = 40.7128;
    const lon = -74.0060;
    const dist = 65;
    const url = `https://data.fcc.gov/api/dtv-maps/stations.json?lat=${lat}&lon=${lon}&dist=${dist}`;
    console.log("Checking URL:", url);
    const response = await fetch(url);
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response (first 500 chars):", text.substring(0, 500));
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
