
import fs from 'fs';
import path from 'path';

const newStations = [
  // New York (40.7, -74.0)
  { "name": "WFUT-DT (Ch 14)", "lat": 40.7484, "lng": -73.9857, "channels": [14], "erp": 500, "radius": 95 },
  { "name": "WPXN-DT (Ch 15)", "lat": 40.7484, "lng": -73.9857, "channels": [15], "erp": 670, "radius": 95 },
  { "name": "WNJU-DT (Ch 14)", "lat": 40.7127, "lng": -74.0059, "channels": [14], "erp": 590, "radius": 95 },
  { "name": "WNJW-DT (Ch 16)", "lat": 40.7484, "lng": -73.9857, "channels": [16], "erp": 510, "radius": 95 },
  { "name": "WABC-DT (Ch 20)", "lat": 40.7484, "lng": -73.9857, "channels": [20], "erp": 450, "radius": 90 },
  
  // Los Angeles (34.0, -118.2)
  { "name": "KBEH (Ch 14)", "lat": 34.2267, "lng": -118.0683, "channels": [14], "erp": 480, "radius": 100 },
  { "name": "KWHY-TV (Ch 20)", "lat": 34.2267, "lng": -118.0683, "channels": [20], "erp": 420, "radius": 100 },
  { "name": "KPXN-TV (Ch 15)", "lat": 34.2267, "lng": -118.0683, "channels": [15], "erp": 1000, "radius": 100 },
  
  // Chicago (41.8, -87.6)
  { "name": "WGN-TV (Ch 19)", "lat": 41.8817, "lng": -87.6272, "channels": [19], "erp": 650, "radius": 95 },
  { "name": "WTTW (Ch 20)", "lat": 41.8817, "lng": -87.6272, "channels": [20], "erp": 500, "radius": 95 },
  
  // Houston (29.7, -95.3)
  { "name": "KUHT (Ch 14)", "lat": 29.7604, "lng": -95.3698, "channels": [14], "erp": 500, "radius": 90 },
  { "name": "KRIV (Ch 16)", "lat": 29.7604, "lng": -95.3698, "channels": [16], "erp": 1000, "radius": 100 },
  
  // Phoenix (33.4, -112.0)
  { "name": "KPHO-TV (Ch 17)", "lat": 33.4484, "lng": -112.0740, "channels": [17], "erp": 1000, "radius": 100 },
  
  // Philadelphia (39.9, -75.1)
  { "name": "WCAU (Ch 14)", "lat": 39.9526, "lng": -75.1652, "channels": [14], "erp": 700, "radius": 95 },
  
  // Dallas (32.7, -96.7)
  { "name": "KDFW (Ch 14)", "lat": 32.7767, "lng": -96.7970, "channels": [14], "erp": 1000, "radius": 100 },
  { "name": "KXAS-TV (Ch 15)", "lat": 32.7767, "lng": -96.7970, "channels": [15], "erp": 1000, "radius": 100 }
];

async function updateAndPartition() {
    const filePath = path.join(process.cwd(), 'data', 'us_transmitters.json');
    let transmitters = [];
    if (fs.existsSync(filePath)) {
        transmitters = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    
    // Add new stations if they don't exist
    newStations.forEach(s => {
        if (!transmitters.find(t => t.name === s.name)) {
            transmitters.push(s);
        }
    });
    
    fs.writeFileSync(filePath, JSON.stringify(transmitters, null, 2));
    console.log(`Updated us_transmitters.json. Total count: ${transmitters.length}`);
    
    // Re-partition
    const partitionDir = path.join(process.cwd(), 'data', 'us_partitioned');
    if (!fs.existsSync(partitionDir)) fs.mkdirSync(partitionDir, { recursive: true });
    
    // Filter out old files? No, just overwrite or add.
    const partitions = {};
    transmitters.forEach(t => {
        const latGrid = Math.floor(t.lat / 2);
        const lngGrid = Math.floor(t.lng / 2);
        const key = `${latGrid}_${lngGrid}`;
        if (!partitions[key]) partitions[key] = [];
        partitions[key].push(t);
    });
    
    Object.entries(partitions).forEach(([key, data]) => {
        const pPath = path.join(partitionDir, `${key}.json`);
        fs.writeFileSync(pPath, JSON.stringify(data));
    });
    
    console.log(`Partitioned data into ${Object.keys(partitions).length} files.`);
}

updateAndPartition();
