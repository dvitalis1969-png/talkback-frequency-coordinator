
console.log("All environment variable names:");
Object.keys(process.env).sort().forEach(k => {
  console.log(`- ${k}`);
});
