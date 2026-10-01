
async function checkEnv() {
  const keys = Object.keys(process.env);
  console.log("Available environment variables:", keys.filter(k => !k.startsWith('NODE_') && !k.startsWith('XDG_')));
  
  if (process.env.RABBIT_EARS_API_KEY) {
    console.log("Found RABBIT_EARS_API_KEY");
  } else if (process.env.VITE_RABBIT_EARS_API_KEY) {
    console.log("Found VITE_RABBIT_EARS_API_KEY");
  } else {
    console.log("No RabbitEars key found in process.env");
  }
}
checkEnv();
