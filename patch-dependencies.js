import fs from 'fs';
import path from 'path';

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
