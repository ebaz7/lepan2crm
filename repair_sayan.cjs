const fs = require('fs');

let c = fs.readFileSync('current_sayan.txt', 'utf8');

// The file currently has ReportVisualizer that never ends, and then bleeds into fetchTableData.
// First, let's extract the TABLE_DICTIONARY if it is there? No, it's missing too?
// Wait, is TABLE_DICTIONARY missing? Let's check!
