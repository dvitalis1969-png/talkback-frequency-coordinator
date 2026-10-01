import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs';
import path from 'path';

(async () => {
    const html = fs.readFileSync('dist/index.html', 'utf8');
    
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", (err) => {
        console.error("BROWSER ERROR:", err);
    });
    virtualConsole.on("jsdomError", (err) => {
        console.error("JSDOM ERROR:", err.message);
    });
    virtualConsole.on("log", (msg) => {
        console.log("BROWSER LOG:", msg);
    });

    const dom = new JSDOM(html, {
        runScripts: "dangerously",
        resources: "usable",
        url: "http://localhost:3000/",
        virtualConsole
    });

    // wait 2 seconds for scripts to load and run
    await new Promise(r => setTimeout(r, 2000));
    console.log("Finished running JSDOM.");
})();
