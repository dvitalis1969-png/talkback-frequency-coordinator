
console.log("Checking US_TV_API_ENDPOINT...");
const val = process.env.US_TV_API_ENDPOINT;
console.log("Value exists:", !!val);
if (val) {
  console.log("Length:", val.length);
  console.log("Start:", val.substring(0, 15));
  console.log("End:", val.substring(val.length - 15));
  console.log("Is it a URL?:", val.startsWith('http'));
}
