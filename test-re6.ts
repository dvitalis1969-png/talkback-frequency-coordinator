async function run() {
  try {
    const url = 'https://www.rabbitears.info/search.php?request=search&lat=40.7128&lon=-74.0060&type=xml';
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
