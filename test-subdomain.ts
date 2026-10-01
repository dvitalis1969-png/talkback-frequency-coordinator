
async function testSubdomain() {
  const configs = [
    { name: 'FCC Subdomain', url: 'https://dtvmaps.fcc.gov/api/stations.json?lat=40.71&lon=-74.01' },
    { name: 'FCC Engineering', url: 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.71&lon=-74.01' },
    { name: 'RabbitEars Signals V2', url: 'https://www.rabbitears.info/api/xml.php?method=getSignalReport&lat=40.71&lon=-74.01' }
  ];

  for (const config of configs) {
    console.log(`--- Testing: ${config.name} ---`);
    try {
      const resp = await fetch(config.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log("Status:", resp.status);
      const text = await resp.text();
      console.log("Response starts with:", text.substring(0, 150).replace(/\n/g, ' '));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
testSubdomain();
