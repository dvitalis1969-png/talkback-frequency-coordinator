
async function scrapeRabbitEars() {
  const url = 'https://www.rabbitears.info/tvq.php?request=items&lat=34.09&lon=-118.41&action=search';
  console.log("Scraping RabbitEars for 90210:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Length:", text.length);
    if (text.includes('Channel')) {
        console.log("Snippet near Channel:", text.substring(text.indexOf('Channel'), text.indexOf('Channel') + 500).replace(/\n/g, ' '));
    } else {
        console.log("No 'Channel' found. Top 500 chars:", text.substring(0, 500).replace(/\n/g, ' '));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
scrapeRabbitEars();
