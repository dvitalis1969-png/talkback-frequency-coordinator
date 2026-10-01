
async function scrapeRabbitEarsData() {
  const url = 'https://www.rabbitears.info/tvq.php?request=items&lat=34.09&lon=-118.41&action=search';
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await resp.text();
    const hasTable = text.includes('<table');
    console.log("Has Table:", hasTable);
    if (hasTable) {
       const tablePart = text.substring(text.indexOf('<table'));
       console.log("Table content (start):", tablePart.substring(0, 1000).replace(/\n/g, ' '));
    } else {
       console.log("No table found. Length:", text.length);
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
scrapeRabbitEarsData();
