async function run() {
  const urls = [
    'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.7128&lon=-74.0060',
    'https://data.fcc.gov/api/dtv-maps/stations.json?lat=40.7128&lon=-74.0060&dist=65',
    'https://www.rabbitears.info/search.php?request=xml&lat=40.7128&lon=-74.0060',
    'https://www.rabbitears.info/search.php?request=search&lat=40.7128&lon=-74.0060&format=xml',
    'https://www.rabbitears.info/search.php?lat=40.7128&lon=-74.0060&type=xml'
  ];
  for (const url of urls) {
    console.log("Testing:", url);
    try {
      const resp = await fetch(url);
      console.log("Status:", resp.status);
      if (resp.ok) {
        const text = await resp.text();
        console.log("Response starts with:", text.substring(0, 100));
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
run();
