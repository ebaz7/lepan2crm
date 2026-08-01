fetch('http://localhost:3000/api/sayan-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT * FROM ACT_TBL_003 WHERE Field_004 LIKE N'%بدهی%' OR Field_004 LIKE N'%اشخاص%' OR Field_004 LIKE N'%مشتری%'" })
})
.then(res => res.json())
.then(data => console.log('ACT_TBL_003:', JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
