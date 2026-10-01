
const keys = ['FESTIVAL_AI_KEY', 'FESTIVAL_GEMINI_KEY', 'APP_GEMINI_API_KEY'];
keys.forEach(k => {
  const val = process.env[k];
  console.log(`${k}:`, val ? `Exists (len ${val.length}, starts with ${val.substring(0, 4)})` : 'Missing');
});
