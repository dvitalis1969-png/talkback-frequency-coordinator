
async function testLMS() {
  const url = 'https://enterpriseefiling.fcc.gov/dataentry/api/facility/search?facilityType=TV';
  console.log("Testing FCC LMS API:", url);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    console.log("Status:", resp.status);
    const json = await resp.json();
    console.log("Response structure:", Object.keys(json));
    if (json.results) {
      console.log("Results count:", json.results.length);
      console.log("First result sample:", JSON.stringify(json.results[0], null, 2));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testLMS();
