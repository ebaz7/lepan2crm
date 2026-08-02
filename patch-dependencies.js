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

// 2. Patch node-windows to bypass local folder/file "NET" conflicts
try {
  const daemonPath = path.join(process.cwd(), 'node_modules/node-windows/lib/daemon.js');
  if (fs.existsSync(daemonPath)) {
    console.log(`Patching node-windows/lib/daemon.js at: ${daemonPath}`);
    let content = fs.readFileSync(daemonPath, 'utf8');
    let modified = false;
    
    if (content.includes("NET START")) {
      content = content.replaceAll("NET START", "C:\\\\Windows\\\\System32\\\\net.exe START");
      modified = true;
    }
    if (content.includes("NET STOP")) {
      content = content.replaceAll("NET STOP", "C:\\\\Windows\\\\System32\\\\net.exe STOP");
      modified = true;
    }
    if (content.includes("C:\\Windows\\System32\\net.exe START")) {
      content = content.replaceAll("C:\\Windows\\System32\\net.exe START", "C:\\\\Windows\\\\System32\\\\net.exe START");
      modified = true;
    }
    if (content.includes("C:\\Windows\\System32\\net.exe STOP")) {
      content = content.replaceAll("C:\\Windows\\System32\\net.exe STOP", "C:\\\\Windows\\\\System32\\\\net.exe STOP");
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(daemonPath, content, 'utf8');
      console.log('Successfully patched node-windows daemon.js with absolute paths to net.exe!');
    } else {
      console.log('node-windows daemon.js already patched or no matches found.');
    }
  }

  const cmdPath = path.join(process.cwd(), 'node_modules/node-windows/lib/cmd.js');
  if (fs.existsSync(cmdPath)) {
    console.log(`Patching node-windows/lib/cmd.js at: ${cmdPath}`);
    let content = fs.readFileSync(cmdPath, 'utf8');
    let modified = false;
    
    if (content.includes("NET SESSION")) {
      content = content.replaceAll("NET SESSION", "C:\\\\Windows\\\\System32\\\\net.exe SESSION");
      modified = true;
    }
    if (content.includes("C:\\Windows\\System32\\net.exe SESSION")) {
      content = content.replaceAll("C:\\Windows\\System32\\net.exe SESSION", "C:\\\\Windows\\\\System32\\\\net.exe SESSION");
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(cmdPath, content, 'utf8');
      console.log('Successfully patched node-windows cmd.js with absolute paths to net.exe!');
    } else {
      console.log('node-windows cmd.js already patched or no matches found.');
    }
  }
} catch (error) {
  console.error('Error while patching node-windows:', error);
}
