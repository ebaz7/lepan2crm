const axios = require('axios');
async function run() {
  const query = `
    DECLARE @SearchStr NVARCHAR(100) = N'اسپاندکس'
    DECLARE @Results TABLE (TableName NVARCHAR(256), ColumnName NVARCHAR(256), SampleValue NVARCHAR(MAX))

    DECLARE @TableName NVARCHAR(256)
    DECLARE @ColumnName NVARCHAR(256)
    DECLARE @Sql NVARCHAR(MAX)

    DECLARE col_cursor CURSOR FOR
    SELECT t.name, c.name
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.types y ON c.user_type_id = y.user_type_id
    WHERE y.name IN ('varchar', 'char', 'nvarchar', 'nchar', 'text', 'ntext')
      AND t.name NOT LIKE 'sys%'

    OPEN col_cursor
    FETCH NEXT FROM col_cursor INTO @TableName, @ColumnName

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Sql = 'SELECT TOP 1 ''' + @TableName + ''', ''' + @ColumnName + ''', CAST(' + QUOTENAME(@ColumnName) + ' AS NVARCHAR(MAX)) FROM ' + QUOTENAME(@TableName) + ' WHERE ' + QUOTENAME(@ColumnName) + ' LIKE N''%'' + @SearchStr + N''%'''
        BEGIN TRY
            INSERT INTO @Results (TableName, ColumnName, SampleValue)
            EXEC sp_executesql @Sql, N'@SearchStr NVARCHAR(100)', @SearchStr = @SearchStr
        END TRY
        BEGIN CATCH
            -- Ignore errors
        END CATCH
        FETCH NEXT FROM col_cursor INTO @TableName, @ColumnName
    END

    CLOSE col_cursor
    DEALLOCATE col_cursor

    SELECT * FROM @Results
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("Search results across all tables for 'اسپاندکس':", JSON.stringify(res.data.data, null, 2));
  } catch(e) {
    console.error(e.message);
  }
}
run();
