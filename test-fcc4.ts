async function run() {
  try {
    const url = 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations?lat=40.7128&lon=-74.0060';
    console.log("Checking URL:", url);
    const response = await fetch(url);
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.substring(0, 500));
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
