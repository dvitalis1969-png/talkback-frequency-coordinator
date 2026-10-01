async function run() {
  const configs = [
    { name: 'FCC No-API', url: 'https://www.fcc.gov/media/engineering/dtvmaps/stations.json?lat=40.71&lon=-74.01' },
    { name: 'RabbitEars tvq', url: 'https://www.rabbitears.info/tvq.php?request=get_stations&lat=40.71&lon=-74.01' },
    { name: 'RabbitEars direct xml', url: 'https://www.rabbitears.info/xml.php?lat=40.71&lon=-74.01' },
    { name: 'FCC Data API', url: 'https://data.fcc.gov/api/dtv-maps/stations.json?lat=40.71&lon=-74.01' }
  ];

  for (const config of configs) {
    console.log(`--- Testing: ${config.name} ---`);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(config.url, { signal: controller.signal });
      clearTimeout(id);
      console.log("Status:", resp.status);
      const text = await resp.text();
      console.log("Response starts with:", text.substring(0, 150).replace(/\n/g, ' '));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
run();
