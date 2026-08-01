const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Remove the wrongly placed }; before SAYAN PRODUCTION REPORT ENDPOINTS
code = code.replace('};\n\n// --- SAYAN PRODUCTION REPORT ENDPOINTS ---', '\n// --- SAYAN PRODUCTION REPORT ENDPOINTS ---');

// 2. Add }; to close setupDailyReports right after the first cron.schedule ends
const targetStr = `        }
    });

// Helper to build Persian captioned production report`;

const replacementStr = `        }
    });
}; // End of setupDailyReports

// Helper to build Persian captioned production report`;

code = code.replace(targetStr, replacementStr);

fs.writeFileSync('server.js', code);
console.log('Fixed braces properly!');
