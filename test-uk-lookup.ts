
async function test() {
  const lat = 51.501;
  const lng = -0.141;
  const url = `http://localhost:3000/api/lookup/uk-tv?lat=${lat}&lng=${lng}`;
  console.log("Testing UK Lookup:", url);
  try {
    const resp = await fetch(url);
    console.log("Status:", resp.status);
    const data = await resp.json();
    console.log("Occupied channels:", Object.keys(data.occupied).length);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
