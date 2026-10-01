const fs = require('fs');
let code = fs.readFileSync('services/rfService.ts', 'utf8');

const injection = `
                    // Specific Custom Ranges Duplex
                    if (cfg.customRanges && cfg.customRanges.length > 0) {
                        for (let crIdx = 0; crIdx < cfg.customRanges.length; crIdx++) {
                            const range = cfg.customRanges[crIdx];
                            if (range.customPairCount && range.customPairCount > 0) {
                                const rcTx = [];
                                const rcRx = [];
                                if (range.txMin !== undefined && range.txMax !== undefined) {
                                    for (let f = range.txMin; f <= range.txMax; f += 0.0125) {
                                        const freqVal = parseFloat(f.toFixed(5));
                                        if (!isForbidden(freqVal)) rcTx.push(freqVal);
                                    }
                                }
                                if (range.rxMin !== undefined && range.rxMax !== undefined) {
                                    for (let f = range.rxMin; f <= range.rxMax; f += 0.0125) {
                                        const freqVal = parseFloat(f.toFixed(5));
                                        if (!isForbidden(freqVal)) rcRx.push(freqVal);
                                    }
                                }
                                
                                const rcCand = [];
                                if (rcTx.length > 0 && rcRx.length > 0) {
                                    const shuffTx = [...rcTx].sort(() => Math.random() - 0.5);
                                    const shuffRx = [...rcRx].sort(() => Math.random() - 0.5);
                                    for (let j = 0; j < Math.min(shuffTx.length, 3000); j++) {
                                        rcCand.push({ tx: shuffTx[j], rx: shuffRx[j % shuffRx.length] });
                                    }
                                }
                                const shuffledRc = rcCand.sort(() => Math.random() - 0.5);
                                
                                const targetSpec = range.customPairCount;
                                const groupNameStr = \`\${cfg.name} (Custom \${crIdx + 1})\`;
                                for (const cand of shuffledRc) {
                                    if (current.filter(p => p.tx > 0 && p.rx > 0 && p.groupName === groupNameStr).length >= targetSpec) break;
                                    if (checkPairCompZonal(cand, current, i)) {
                                        current.push({
                                            id: \`ZP-\${i}-\${current.length}-\${Math.random().toString(36).substring(2, 5)}\`,
                                            label: \`\${cfg.name.slice(0,2).toUpperCase()} CP-\${crIdx + 1}-\${current.filter(p => p.tx > 0 && p.rx > 0 && p.groupName === groupNameStr).length + 1}\`,
                                            tx: cand.tx, rx: cand.rx, txBw: 0.0125, rxBw: 0.0125, groupName: groupNameStr, locked: false, active: true
                                        });
                                    }
                                }
                            }
                        }
                    }

                    // Custom Duplex`;

code = code.replace('                    // Custom Duplex', injection);
fs.writeFileSync('services/rfService.ts', code);
console.log('Done replacement 2');
