async function run() {
  try {
    const url = 'https://www.rabbitears.info/api/xml.php?request=search&zip=10001';
    console.log("Checking URL:", url);
    const response = await fetch(url);
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text.substring(0, 1000));
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
