const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

const docTypes = {};
schema['STR_TBL_006'].forEach(r => {
   if(r[0] !== 'Field_001') docTypes[r[0]] = r[2];
});

console.log("Types map:", docTypes);

const counts = {};
schema['STR_TBL_010'].forEach(r => {
   if(r[1] !== 'Field_004') {
       const typeId = r[1];
       const typeName = docTypes[typeId] || `نوع ${typeId}`;
       counts[typeName] = (counts[typeName] || 0) + 1;
   }
});

console.log("Invoice type counts:", counts);
