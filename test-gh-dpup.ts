
async function test() {
  const url = `https://raw.githubusercontent.com/dpup/fcc-dtv-lookup/master/data/stations.json`;
  console.log("Testing GitHub URL (dpup):", url);
  try {
    const resp = await fetch(url);
    console.log("Status:", resp.status);
    if (!resp.ok) {
        console.log("Failed to fetch.");
        return;
    }
    const text = await resp.text();
    console.log("Length:", text.length);
    console.log("Snippet:", text.substring(0, 500));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
test();
