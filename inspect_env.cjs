console.log("Env vars:", Object.keys(process.env).filter(k => k.toLowerCase().includes('bot') || k.toLowerCase().includes('telegram') || k.toLowerCase().includes('bale') || k.toLowerCase().includes('sayan') || k.toLowerCase().includes('token')));
console.log("TELEGRAM_BOT_TOKEN exists:", !!process.env.TELEGRAM_BOT_TOKEN);
console.log("BALE_BOT_TOKEN exists:", !!process.env.BALE_BOT_TOKEN);
