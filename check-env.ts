const mask = (s: string | undefined) => s ? s.slice(0, 4) + '...' + s.slice(-4) : 'undefined';
console.log("GEMINI_API_KEY:", mask(process.env.GEMINI_API_KEY));
console.log("FESTIVAL_GEMINI_KEY:", mask(process.env.FESTIVAL_GEMINI_KEY));
