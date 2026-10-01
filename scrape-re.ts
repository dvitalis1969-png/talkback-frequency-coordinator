
async function scrapeRabbitEars() {
  const url = 'https://www.rabbitears.info/tvq.php?request=get_stations&lat=40.71&lon=-74.01';
  console.log("Scraping RabbitEars:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    console.log("Status:", resp.status);
    const text = await resp.text();
    // Look for station codes or channel names
    console.log("Length:", text.length);
    console.log("Contains 'Channel':", text.includes('Channel'));
    console.log("Snippet:", text.substring(text.indexOf('Channel'), text.indexOf('Channel') + 500).replace(/\n/g, ' '));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
scrapeRabbitEars();
