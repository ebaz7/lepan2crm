const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
let depth = 0;
let lastLines = [];
let lines = code.split('\n');
for(let i=0; i<lines.length; i++) {
  let line = lines[i];
  for(let j=0; j<line.length; j++) {
    if(line[j] === '{') depth++;
    else if(line[j] === '}') depth--;
  }
}
console.log("Final depth:", depth);
