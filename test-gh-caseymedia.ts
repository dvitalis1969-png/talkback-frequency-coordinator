
async function test() {
  const url = `https://raw.githubusercontent.com/caseymediallc/fcc-dtv-lookup/main/stations.json`;
  console.log("Testing GitHub URL (caseymedia):", url);
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
