async function run() {
  const configs = [
    { name: 'RabbitEars transmitters', url: 'https://www.rabbitears.info/search.php?request=get_transmitters&lat=40.71&lon=-74.01' },
    { name: 'FCC JSON PHP', url: 'https://www.fcc.gov/media/engineering/dtvmaps/dtvmaps-json.php?lat=40.71&lon=-74.01' },
    { name: 'RabbitEars API V2', url: 'https://www.rabbitears.info/api/xml.php?method=getStations&lat=40.71&lon=-74.01' }
  ];

  for (const config of configs) {
    console.log(`--- Testing: ${config.name} ---`);
    try {
      const resp = await fetch(config.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
      console.log("Status:", resp.status);
      const text = await resp.text();
      console.log("Response starts with:", text.substring(0, 150).replace(/\n/g, ' '));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
run();
