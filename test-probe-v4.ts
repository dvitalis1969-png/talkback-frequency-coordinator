async function run() {
  const configs = [
    { name: 'RabbitEars signals', url: 'https://www.rabbitears.info/api/signals.php?lat=40.71&lon=-74.01' },
    { name: 'RabbitEars json', url: 'https://www.rabbitears.info/api/json.php?lat=40.71&lon=-74.01' },
    { name: 'RabbitEars search3', url: 'https://www.rabbitears.info/search3.php?lat=40.71&lon=-74.01&type=xml' }
  ];

  for (const config of configs) {
    console.log(`--- Testing: ${config.name} ---`);
    try {
      const resp = await fetch(config.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log("Status:", resp.status);
      const text = await resp.text();
      console.log("Response starts with:", text.substring(0, 100).replace(/\n/g, ' '));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
run();
