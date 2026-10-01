async function run() {
  const url = 'https://www.rabbitears.info/api/xml.php';
  console.log("Testing base URL existence:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Status:", resp.status);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();
