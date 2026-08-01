const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
let idx = code.indexOf("const DIST_DIR = path.join(ROOT_DIR, 'dist');");
let newCode = code.slice(0, idx) + '}\n' + code.slice(idx);
fs.writeFileSync('server_test.js', newCode);
