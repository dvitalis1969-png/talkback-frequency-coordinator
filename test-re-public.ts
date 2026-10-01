
async function test() {
  const url = `https://www.rabbitears.info/api.php?request=getsignalreport&lat=34.09&lon=-118.41&format=json`;
  console.log("Testing RabbitEars Public API:", url);
  try {
    const resp = await fetch(url);
    console.log("Status:", resp.status);
    const text = await resp.text();
    console.log("Length:", text.length);
    console.log("Snippet:", text.substring(0, 500));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
