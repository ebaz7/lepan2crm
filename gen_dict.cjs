const fs = require('fs');

const mapping = fs.readFileSync('mapping.txt', 'utf8').split('\n').filter(Boolean).map(line => {
    if (!line.includes(' => ')) return '';
    const [tbl, vals] = line.split(' => ');
    if (!vals) return '';
    return `  '${tbl}': '${vals.replace(/'/g, "\\'")}',\n  'dbo.${tbl}': '${vals.replace(/'/g, "\\'")}',`;
}).filter(Boolean);

const output = `${mapping.join('\n')}`;

fs.writeFileSync('new_dict.txt', output);
