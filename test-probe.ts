async function run() {
  const configs = [
    { name: 'RabbitEars get_stations', url: 'https://www.rabbitears.info/api/xml.php?request=get_stations&lat=40.7128&lon=-74.0060' },
    { name: 'RabbitEars signal_search', url: 'https://www.rabbitears.info/api/xml.php?request=signal_search&lat=40.7128&lon=-74.0060' },
    { name: 'FCC DTV Maps lng', url: 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.7128&lng=-74.0060', referer: 'https://www.fcc.gov/media/engineering/dtvmaps' }
  ];

  for (const config of configs) {
    console.log(`--- Testing: ${config.name} ---`);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const headers: any = { 'User-Agent': 'Mozilla/5.0' };
      if (config.referer) headers['Referer'] = config.referer;
      
      const resp = await fetch(config.url, { signal: controller.signal, headers });
      clearTimeout(id);
      console.log("Status:", resp.status);
      const text = await resp.text();
      console.log("Response (first 200):", text.substring(0, 200).replace(/\n/g, ' '));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
run();
