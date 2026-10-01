async function run() {
  const url = 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.7128&lon=-74.0060';
  console.log("Testing FCC with Referer:", url);
  try {
    const resp = await fetch(url, {
      headers: {
        'Referer': 'https://www.fcc.gov/media/engineering/dtvmaps',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    console.log("Status:", resp.status);
    if (resp.ok) {
      const text = await resp.text();
      console.log("Response starts with:", text.substring(0, 500));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }

  const reUrl = 'https://www.rabbitears.info/ssearch.php?lat=40.7128&lon=-74.0060';
  console.log("Testing RabbitEars ssearch:", reUrl);
  try {
    const resp = await fetch(reUrl);
    console.log("RE Status:", resp.status);
    if (resp.ok) {
      const text = await resp.text();
      console.log("RE Response starts with:", text.substring(0, 500));
    }
  } catch (e) {
    console.log("RE Error:", e.message);
  }
}
run();
