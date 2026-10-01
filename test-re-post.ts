
async function testREPost() {
  const url = 'https://www.rabbitears.info/tvq.php';
  console.log("Testing RabbitEars POST to:", url);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: 'request=get_stations&lat=40.71&lon=-74.01'
    });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Length:", text.length);
    const hasStation = text.includes('Station');
    console.log("Has Station:", hasStation);
    if (hasStation) {
      console.log("Snippet:", text.substring(text.indexOf('Station'), text.indexOf('Station') + 500).replace(/\n/g, ' '));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testREPost();
