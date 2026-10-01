const name = "Shure Axient Digital";
const band = "G56 (470-636 MHz)";
const parts = name.split(" ");
const make = parts[0];
const model = parts.slice(1).join(" ");
const b = band.split(" ")[0];
console.log(make, model, b);
