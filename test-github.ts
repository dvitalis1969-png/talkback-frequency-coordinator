
async function testGithubData() {
  const urls = [
    'https://raw.githubusercontent.com/stabbylambda/antennas/master/data/stations.json',
    'https://raw.githubusercontent.com/stabbylambda/antennas/master/data/rabbitears.json'
  ];
  for (const url of urls) {
    console.log("Checking GitHub:", url);
    try {
      const resp = await fetch(url);
      console.log("Status:", resp.status);
      if (resp.ok) {
        const text = await resp.text();
        console.log("Length:", text.length);
        console.log("Preview:", text.substring(0, 200));
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}
testGithubData();
