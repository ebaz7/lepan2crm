const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const docTypes = {};
schema['STR_TBL_006'].forEach(r => { if(r[0] !== 'Field_001') docTypes[r[0]] = r[2]; });

schema['STR_TBL_010'].forEach(r => {
   if(r[1] !== 'Field_004') {
       const typeId = r[1];
       const typeName = docTypes[typeId] || `نوع ${typeId}`;
       let isReturn = false;
       if (typeName.includes('برگشت') || typeName.includes('مرجوع') || typeName.includes('برگشتی')) {
            isReturn = true;
       }
       console.log(`Type: ${typeName}, IsReturn: ${isReturn}`);
   }
});
