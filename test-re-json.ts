async function run() {
  const url = 'https://www.rabbitears.info/search.php?request=search&lat=40.71&lon=-74.01&format=json';
  console.log("Testing search.php with format=json:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Response:", text.substring(0, 1000).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
