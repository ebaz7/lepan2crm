const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
let lines = code.split('\n');
let depth = 0;
for(let i=0; i<lines.length; i++) {
  let line = lines[i];
  for(let j=0; j<line.length; j++) {
    if(line[j] === '{') depth++;
    else if(line[j] === '}') depth--;
  }
  if (i === 370) console.log('depth at 370:', depth); // start of sendDaily
  if (i === 564) console.log('depth at 564:', depth); // end of sendDaily
  if (i === 600) console.log('depth at 600:', depth);
  if (i === 620) console.log('depth at 620:', depth);
}
