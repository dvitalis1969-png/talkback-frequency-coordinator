
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const zipPath = path.join(process.cwd(), 'SOURCE_BACKUP_v2.5.zip');

if (fs.existsSync(zipPath)) {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    
    console.log(`Zip file contents (${zipEntries.length} files):`);
    // Only show data files
    zipEntries.filter(e => e.entryName.includes('data/')).forEach(entry => {
        console.log(`- ${entry.entryName} (${entry.header.size} bytes)`);
    });
} else {
    console.log(`File not found: ${zipPath}`);
}
