const fs = require('fs');
fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT Field_001, Field_003, Field_004 FROM STR_TBL_006" })
})
.then(res => res.json())
.then(data => {
  console.log("STR_TBL_006:");
  data.forEach(t => console.log(`${t.Field_001} | ${t.Field_003} | ${t.Field_004}`));
});
