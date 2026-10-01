async function run() {
  const url = 'https://www.rabbitears.info/api/xml.php?method=getSignalReport&lat=40.7128&lon=-74.0060&ant_height=10';
  console.log("Testing RabbitEars:", url);
  try {
    const resp = await fetch(url);
    console.log("Status:", resp.status);
    if (resp.status === 200) {
      const text = await resp.text();
      console.log("Response:", text.substring(0, 1000));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }

  const fccUrl = 'https://www.fcc.gov/media/engineering/dtvmaps/api/stations.json?lat=40.7128&lon=-74.0060';
  console.log("Testing FCC with Referer:", fccUrl);
  try {
    const resp = await fetch(fccUrl, {
      headers: {
        'Referer': 'https://www.fcc.gov/media/engineering/dtvmaps'
      }
    });
    console.log("FCC Status:", resp.status);
    if (resp.status === 200) {
       const text = await resp.text();
       console.log("FCC Response:", text.substring(0, 500));
    }
  } catch (e) {
    console.log("FCC Error:", e.message);
  }
}
run();
