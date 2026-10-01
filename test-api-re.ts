async function run() {
  try {
    const url = 'https://api.rabbitears.info/v1/search';
    console.log("Checking URL:", url);
    const response = await fetch(url);
    console.log("Status:", response.status);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
