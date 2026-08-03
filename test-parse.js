var cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Start-Process -FilePath 'C:\\test.exe' -ArgumentList 'install' -Verb RunAs -WindowStyle Hidden\"";
var cleanCmd = cmd.trim();
var file = '';
var argsStr = '';
if (cleanCmd.charAt(0) === '"') {
  var closingQuoteIdx = cleanCmd.indexOf('"', 1);
  if (closingQuoteIdx !== -1) {
    file = cleanCmd.substring(1, closingQuoteIdx);
    argsStr = cleanCmd.substring(closingQuoteIdx + 1).trim();
  } else {
    file = cleanCmd;
  }
} else {
  var firstSpaceIdx = cleanCmd.indexOf(' ');
  if (firstSpaceIdx !== -1) {
    file = cleanCmd.substring(0, firstSpaceIdx);
    argsStr = cleanCmd.substring(firstSpaceIdx + 1).trim();
  } else {
    file = cleanCmd;
  }
}
var args = [];
if (argsStr) {
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < argsStr.length; i++) {
    var char = argsStr.charAt(i);
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) {
    args.push(current);
  }
}
console.log("FILE:", file);
console.log("ARGS:", args);
