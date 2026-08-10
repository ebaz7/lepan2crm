import zipfile
try:
    with zipfile.ZipFile('farvardin_sales.xlsx', 'r') as z:
        print("Files inside farvardin_sales.xlsx:")
        print(z.namelist())
except Exception as e:
    print("Error:", e)
