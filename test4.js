const freqs = [484.5, 499.5, 514.5, 529.5, 544.5];
for (const f of freqs) {
    const rem = f % 0.5;
    const dist = Math.min(rem, 0.5 - rem);
    console.log(`Freq: ${f}, dist to 0.5MHz: ${dist}`);
}
