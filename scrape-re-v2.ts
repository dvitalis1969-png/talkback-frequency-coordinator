
async function scrapeRabbitEarsData() {
  const url = 'https://www.rabbitears.info/tvq.php?request=get_stations&lat=40.71&lon=-74.01';
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await resp.text();
    const hasTable = text.includes('<table');
    console.log("Has Table:", hasTable);
    if (hasTable) {
      console.log("Table snippet:", text.substring(text.indexOf('<table'), text.indexOf('<table') + 1000).replace(/\n/g, ' '));
    } else {
       console.log("No table found. Looking for 'Station':", text.includes('Station'));
       console.log("Snippet near 'Station':", text.substring(text.indexOf('Station') - 100, text.indexOf('Station') + 400).replace(/\n/g, ' '));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
scrapeRabbitEarsData();
