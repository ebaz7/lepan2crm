const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
let lines = code.split('\n');
let depth = 0;
let prevDepth = 0;
for(let i=0; i<lines.length; i++) {
  let line = lines[i];
  for(let j=0; j<line.length; j++) {
    if(line[j] === '{') depth++;
    else if(line[j] === '}') depth--;
  }
  if (depth > prevDepth && depth === 1) {
     console.log("Became 1 at", i, line);
  }
  prevDepth = depth;
}
