
import fs from 'fs';
import path from 'path';

function checkSize() {
  const p1 = './data/us_transmitters.json';
  const p2 = './data/us_partitioned';
  if (fs.existsSync(p1)) {
    console.log(`${p1} size:`, (fs.statSync(p1).size / (1024 * 1024)).toFixed(2), "MB");
  } else {
    console.log(`${p1} missing`);
  }
  if (fs.existsSync(p2)) {
    const files = fs.readdirSync(p2);
    console.log(`${p2} contains`, files.length, "partitions");
    if (files.length > 0) {
      console.log(`First partition size:`, (fs.statSync(path.join(p2, files[0])).size / 1024).toFixed(2), "KB");
    }
  }
}
checkSize();
