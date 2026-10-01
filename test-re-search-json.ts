
async function run() {
  const url = 'https://www.rabbitears.info/search.php?request=search&format=json&lat=40.71&lon=-74.01';
  console.log("Testing search.php?format=json:", url);
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
