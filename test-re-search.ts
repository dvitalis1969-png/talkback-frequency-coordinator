
async function test() {
  const url = `https://www.rabbitears.info/search.php?request=search&lat=34.0901&lon=-118.4065&height=30`;
  console.log("Testing RabbitEars Search:", url);
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Length:", text.length);
    console.log("Snippet:", text.substring(0, 500).replace(/\n/g, ' '));
    console.log("Contains 'id=':", text.includes('id='));
    // Look for station URLs like tvq.php?request=items&facid=...
    const matches = text.match(/tvq\.php\?request=items&facid=[0-9]+/g);
    console.log("Matches found:", matches?.length);
    if (matches) console.log("First matches:", matches.slice(0, 5));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
