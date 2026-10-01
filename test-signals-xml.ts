async function run() {
  const url = 'https://www.rabbitears.info/signals.php?request=xml&lat=40.71&lon=-74.01';
  console.log("Testing signals.php with request=xml:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response:", text.substring(0, 200).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
