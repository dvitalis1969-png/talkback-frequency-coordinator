
import AdmZip from 'adm-zip';
import fs from 'fs';

function checkZip() {
  const zipPath = './SOURCE_BACKUP_v2.5.zip';
  if (!fs.existsSync(zipPath)) {
    console.log("Zip not found");
    return;
  }
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  console.log("Entries found:", entries.length);
  const envEntry = entries.find(e => e.entryName.includes('.env'));
  if (envEntry) {
    console.log("Found .env in zip:", envEntry.entryName);
    console.log("Content preview:", envEntry.getData().toString('utf8').substring(0, 100));
  } else {
    console.log("No .env found in zip.");
  }
}
checkZip();
