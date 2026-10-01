const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// I will just do a string replace on exactly what I see in the file:
const match = `                        )}
                    </div>
                    <ProTipsBanner `;
const replacement = `                        )}
                    </div>)}
                    <ProTipsBanner `;

content = content.replace(match, replacement);

fs.writeFileSync('App.tsx', content);
