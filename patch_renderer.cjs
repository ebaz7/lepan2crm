const fs = require('fs');
let code = fs.readFileSync('backend/renderer.js', 'utf8');

code = code.replace(
  /if \(cellIdx === 3\) \{/g,
  `if (cellIdx === 3 && title.includes("بدهکار")) {`
);

fs.writeFileSync('backend/renderer.js', code);
console.log('patched renderer');
