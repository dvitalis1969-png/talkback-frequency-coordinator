
async function test() {
  const url = `https://www.rabbitears.info/get_report.php?lat=34.09&lon=-118.41`;
  console.log("Testing RabbitEars get_report:", url);
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
