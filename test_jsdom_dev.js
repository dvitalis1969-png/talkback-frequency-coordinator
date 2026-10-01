import { JSDOM, VirtualConsole } from 'jsdom';
import fetch from 'node-fetch';

(async () => {
    const res = await fetch('http://localhost:3000/');
    const html = await res.text();
    
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", (err) => {
        console.error("BROWSER ERROR:", err);
    });
    virtualConsole.on("jsdomError", (err) => {
        // console.error("JSDOM ERROR:", err.message);
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

    // wait 3 seconds
    await new Promise(r => setTimeout(r, 3000));
    console.log("Finished running JSDOM dev.");
})();
