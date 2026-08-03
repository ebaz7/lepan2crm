import fs from 'fs';
import path from 'path';

// 1. Patch @capgo/capacitor-share-target build.gradle
const filePath = path.join(process.cwd(), 'node_modules/@capgo/capacitor-share-target/android/build.gradle');

try {
  if (fs.existsSync(filePath)) {
    console.log(`Patching @capgo/capacitor-share-target/android/build.gradle at: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the problematic AGP version 8.13.0 with stable 8.2.1
    if (content.includes("classpath 'com.android.tools.build:gradle:8.13.0'")) {
      content = content.replace(
        "classpath 'com.android.tools.build:gradle:8.13.0'",
        "classpath 'com.android.tools.build:gradle:8.2.1'"
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Successfully patched build.gradle to use AGP 8.2.1!');
    } else {
      console.log('AGP 8.13.0 classpath not found, or already patched.');
    }
  } else {
    console.log('@capgo/capacitor-share-target build.gradle not found at expected path.');
  }
} catch (error) {
  console.error('Error while patching @capgo/capacitor-share-target build.gradle:', error);
}

// 2. Patch node-windows
try {
  const daemonPath = path.join(process.cwd(), 'node_modules/node-windows/lib/daemon.js');
  if (fs.existsSync(daemonPath)) {
    console.log(`Patching node-windows/lib/daemon.js at: ${daemonPath}`);
    let content = fs.readFileSync(daemonPath, 'utf8');
    let modified = false;
    
    // Clean up any old absolute paths first
    if (content.includes("C:\\\\Windows\\\\System32\\\\net.exe START")) {
      content = content.replaceAll("C:\\\\Windows\\\\System32\\\\net.exe START", "net.exe START");
      modified = true;
    }
    if (content.includes("C:\\Windows\\System32\\net.exe START")) {
      content = content.replaceAll("C:\\Windows\\System32\\net.exe START", "net.exe START");
      modified = true;
    }
    if (content.includes("C:\\\\WindowsSystem32\\\\net.exe START")) {
      content = content.replaceAll("C:\\\\WindowsSystem32\\\\net.exe START", "net.exe START");
      modified = true;
    }
    if (content.includes("C:\\WindowsSystem32\\net.exe START")) {
      content = content.replaceAll("C:\\WindowsSystem32\\net.exe START", "net.exe START");
      modified = true;
    }
    if (content.includes("C:\\\\Windows\\\\System32\\\\net.exe STOP")) {
      content = content.replaceAll("C:\\\\Windows\\\\System32\\\\net.exe STOP", "net.exe STOP");
      modified = true;
    }
    if (content.includes("C:\\Windows\\System32\\net.exe STOP")) {
      content = content.replaceAll("C:\\Windows\\System32\\net.exe STOP", "net.exe STOP");
      modified = true;
    }
    if (content.includes("C:\\\\WindowsSystem32\\\\net.exe STOP")) {
      content = content.replaceAll("C:\\\\WindowsSystem32\\\\net.exe STOP", "net.exe STOP");
      modified = true;
    }
    if (content.includes("C:\\WindowsSystem32\\net.exe STOP")) {
      content = content.replaceAll("C:\\WindowsSystem32\\net.exe STOP", "net.exe STOP");
      modified = true;
    }

    // Apply the clean net.exe patch
    if (content.includes("NET START")) {
      content = content.replaceAll("NET START", "net.exe START");
      modified = true;
    }
    if (content.includes("NET STOP")) {
      content = content.replaceAll("NET STOP", "net.exe STOP");
      modified = true;
    }

    // Restore elevate check in execute method instead of PermError throwing
    const permErrorBlock = `          } else {
            console.log(PermError);
            throw PermError;
          }`;
    const restoredElevateBlock = `          } else {
            if (typeof options === 'function') {
              callback = options;
              options = {};
            }
            wincmd.elevate(cmd, options, callback);
          }`;
    if (content.includes(permErrorBlock)) {
      content = content.replace(permErrorBlock, restoredElevateBlock);
      modified = true;
      console.log('Successfully restored elevation support in daemon.js execution.');
    }
    
    if (modified) {
      fs.writeFileSync(daemonPath, content, 'utf8');
      console.log('Successfully patched node-windows daemon.js!');
    } else {
      console.log('node-windows daemon.js already patched or no matches found.');
    }
  }

  const cmdPath = path.join(process.cwd(), 'node_modules/node-windows/lib/cmd.js');
  if (fs.existsSync(cmdPath)) {
    console.log(`Patching node-windows/lib/cmd.js at: ${cmdPath}`);
    let content = fs.readFileSync(cmdPath, 'utf8');
    let modified = false;
    
    // Clean up any old absolute paths first
    if (content.includes("C:\\\\Windows\\\\System32\\\\net.exe SESSION")) {
      content = content.replaceAll("C:\\\\Windows\\\\System32\\\\net.exe SESSION", "net.exe SESSION");
      modified = true;
    }
    if (content.includes("C:\\Windows\\System32\\net.exe SESSION")) {
      content = content.replaceAll("C:\\Windows\\System32\\net.exe SESSION", "net.exe SESSION");
      modified = true;
    }
    if (content.includes("C:\\\\WindowsSystem32\\\\net.exe SESSION")) {
      content = content.replaceAll("C:\\\\WindowsSystem32\\\\net.exe SESSION", "net.exe SESSION");
      modified = true;
    }
    if (content.includes("C:\\WindowsSystem32\\net.exe SESSION")) {
      content = content.replaceAll("C:\\WindowsSystem32\\net.exe SESSION", "net.exe SESSION");
      modified = true;
    }

    const searchString = `  isAdminUser: function (callback) {
    exec('NET SESSION', function (err, so, se) {
      if (se.length !== 0) {
        bin.elevate('NET SESSION', function (_err, _so, _se) {`;

    const replacementString = `  isAdminUser: function (callback) {
    exec('net.exe SESSION', function (err, so, se) {
      if (err || se.length !== 0) {
        callback(false);
      } else {
        callback(true);
      }
    });
  },`;

    if (content.includes("bin.elevate('NET SESSION'")) {
      const startIdx = content.indexOf("isAdminUser: function");
      const endIdx = content.indexOf("},", startIdx);
      if (startIdx !== -1 && endIdx !== -1) {
        const fullFunc = content.substring(startIdx, endIdx + 2);
        content = content.replace(fullFunc, replacementString);
        modified = true;
        console.log('Successfully patched cmd.js to avoid elev.cmd loop during isAdmin check.');
      }
    }
    
    if (modified) {
      fs.writeFileSync(cmdPath, content, 'utf8');
      console.log('Successfully patched node-windows cmd.js!');
    } else {
      console.log('node-windows cmd.js already patched or no matches found.');
    }
  }

  const binariesPath = path.join(process.cwd(), 'node_modules/node-windows/lib/binaries.js');
  if (fs.existsSync(binariesPath)) {
    console.log(`Patching node-windows/lib/binaries.js at: ${binariesPath}`);
    let content = fs.readFileSync(binariesPath, 'utf8');
    let modified = false;

    // Replace the entire elevate block from elevate: function up to sudo: function
    const startPattern = "  elevate: function";
    const endPattern = "  sudo: function";
    const startIdx = content.indexOf(startPattern);
    const endIdx = content.indexOf(endPattern);
    if (startIdx !== -1 && endIdx !== -1) {
      const originalBlock = content.substring(startIdx, endIdx);
      const replacementBlock = `  elevate: function (cmd, options, callback) {
    var p = params(options, callback);
    exec('net.exe SESSION', function (err, so, se) {
      var isAdmin = !err && (!se || se.length === 0);
      if (isAdmin) {
        exec(cmd, p.options, p.callback);
      } else {
        // Robust PowerShell-based elevation (eliminates buggy elevate.cmd and elevate.vbs)
        var cleanCmd = cmd.trim();
        var exe = '';
        var args = '';
        if (cleanCmd.charAt(0) === '"') {
          var closingQuoteIdx = cleanCmd.indexOf('"', 1);
          if (closingQuoteIdx !== -1) {
            exe = cleanCmd.substring(1, closingQuoteIdx);
            args = cleanCmd.substring(closingQuoteIdx + 1).trim();
          } else {
            exe = cleanCmd;
          }
        } else {
          var firstSpaceIdx = cleanCmd.indexOf(' ');
          if (firstSpaceIdx !== -1) {
            exe = cleanCmd.substring(0, firstSpaceIdx);
            args = cleanCmd.substring(firstSpaceIdx + 1).trim();
          } else {
            exe = cleanCmd;
          }
        }
        var escapedExe = exe.replace(/'/g, "''");
        var escapedArgs = args.replace(/'/g, "''");
        var psCmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command \\"Start-Process -FilePath '" + escapedExe + "' -ArgumentList '" + escapedArgs + "' -Verb RunAs -WindowStyle Hidden\\"";
        exec(psCmd, p.options, p.callback);
      }
    });
  },

`;
      content = content.replace(originalBlock, replacementBlock);
      modified = true;
      console.log('Successfully patched binaries.js to use modern PowerShell-based elevate.');
    }

    if (modified) {
      fs.writeFileSync(binariesPath, content, 'utf8');
      console.log('Successfully patched node-windows binaries.js!');
    } else {
      console.log('node-windows binaries.js already patched or no matches found.');
    }
  }

  const eventlogPath = path.join(process.cwd(), 'node_modules/node-windows/lib/eventlog.js');
  if (fs.existsSync(eventlogPath)) {
    console.log(`Patching node-windows/lib/eventlog.js at: ${eventlogPath}`);
    let content = fs.readFileSync(eventlogPath, 'utf8');
    let modified = false;

    // We replace the entire write function to bypass eventcreate (buggy on modern Windows, triggers buggy elevate.cmd popups)
    // and instead write directly to console.log safely.
    const searchStrStart = "var write = function (log, src, type, msg, id, callback) {";
    const searchStrEnd = "var logger = function (config) {";
    const startIdx = content.indexOf(searchStrStart);
    if (startIdx !== -1) {
      const endIdx = content.indexOf(searchStrEnd, startIdx);
      if (endIdx !== -1) {
        // Replace everything from start of write function to start of logger function
        const originalBlock = content.substring(startIdx, endIdx);
        const replacementBlock = `var write = function (log, src, type, msg, id, callback) {
  if (msg == null) { return };
  if (msg.trim().length == 0) { return };
  console.log("[" + (type || 'INFO') + "] " + msg);
  if (callback) {
    process.nextTick(callback);
  }
};

`;
        content = content.replace(originalBlock, replacementBlock);
        modified = true;
        console.log('Successfully patched eventlog.js to use safe console write bypassing eventcreate.');
      }
    }

    if (modified) {
      fs.writeFileSync(eventlogPath, content, 'utf8');
      console.log('Successfully patched node-windows eventlog.js!');
    } else {
      console.log('node-windows eventlog.js already patched or no matches found.');
    }
  }
} catch (error) {
  console.error('Error while patching node-windows:', error);
}
