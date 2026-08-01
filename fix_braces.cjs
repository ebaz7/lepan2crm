const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Remove the extra } at the very end
if (code.endsWith('}\n')) {
  code = code.substring(0, code.length - 2);
} else if (code.endsWith('}')) {
  code = code.substring(0, code.length - 1);
}

// Add }; to close setupDailyReports
code = code.replace('// --- SAYAN PRODUCTION REPORT ENDPOINTS ---', '};\n\n// --- SAYAN PRODUCTION REPORT ENDPOINTS ---');

// Call the functions at the end of setTimeout
const targetStr = `        } catch (err) {
            console.error("Background services initialization error:", err);
        }
    }, 1000);`;
const replacementStr = `        } catch (err) {
            console.error("Background services initialization error:", err);
        }
        setupAutoBackup();
        setupDailyReports();
    }, 1000);`;

code = code.replace(targetStr, replacementStr);
fs.writeFileSync('server.js', code);
console.log('Fixed braces!');
