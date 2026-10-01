async function run() {
  const url = 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.7128&lon=-74.0060';
  console.log("Testing:", url);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response starts with:", text.substring(0, 200));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
