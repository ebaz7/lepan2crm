const axios = require('axios');
async function run() {
  const query = `
    SELECT TOP 10
      RTRIM(LTRIM(t11.Field_005)) as ItemCode,
      RTRIM(LTRIM(t_group.GroupName)) as GroupName,
      RTRIM(LTRIM(t_group.SubGroupName)) as SubGroupName
    FROM STR_TBL_011 t11
    LEFT JOIN (
        SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, 
               MIN(t02_sub.Field_003) as SubGroupName,
               MIN(COALESCE(t02_parent.Field_003, t02_sub.Field_003)) as GroupName
        FROM IND_TBL_021 t21_sub
        LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
        LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
        GROUP BY t21_sub.Field_004
    ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
    WHERE t11.Field_005 LIKE '04%'
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("SQL Results:", JSON.stringify(res.data.data, null, 2));
  } catch(e) { console.error(e.message); }
}
run();
