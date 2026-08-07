import { execSync } from 'child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('====================================================');
console.log('   🤖 Android APK Build & Setup (Node.js Core) 🤖  ');
console.log('====================================================\n');

try {
    const isWindows = process.platform === 'win32';
    const gradleDir = join(process.cwd(), 'android');

    // 1. Build Web Assets
    console.log('📦 Step 1/4: Building Web Application (React + Vite)...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Web build finished successfully.\n');

    // 2. Sync with Capacitor
    console.log('🔄 Step 2/4: Syncing assets with Android project (Capacitor)...');
    execSync('npx cap sync android', { stdio: 'inherit' });
    console.log('✅ Capacitor assets synchronized.\n');

    // Auto-create/validate local.properties
    const localPropertiesPath = join(gradleDir, 'local.properties');
    let requiresWrite = !existsSync(localPropertiesPath);
    let sdkPath = '';

    // Define candidates
    if (isWindows) {
        const userSpecificSdk = 'C:\\Users\\Factorythird\\AppData\\Local\\Android\\Sdk';
        const defaultWinSdk = join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local', 'Android', 'Sdk');
        
        const candidates = [
            userSpecificSdk,
            defaultWinSdk,
            'C:\\Android\\Sdk',
            process.env.ANDROID_HOME,
            process.env.ANDROID_SDK_ROOT
        ];

        for (const candidate of candidates) {
            if (candidate && existsSync(candidate)) {
                sdkPath = candidate;
                break;
            }
        }
        
        // If we didn't find them, but the user says it's at userSpecificSdk, fallback to using it
        if (!sdkPath) {
            sdkPath = userSpecificSdk;
        }
    } else if (process.platform === 'darwin') {
        const candidates = [
            join(process.env.HOME || '/', 'Library', 'Android', 'sdk'),
            process.env.ANDROID_HOME,
            process.env.ANDROID_SDK_ROOT
        ];
        for (const candidate of candidates) {
            if (candidate && existsSync(candidate)) {
                sdkPath = candidate;
                break;
            }
        }
    } else {
        const candidates = [
            join(process.env.HOME || '/', 'Android', 'Sdk'),
            process.env.ANDROID_HOME,
            process.env.ANDROID_SDK_ROOT
        ];
        for (const candidate of candidates) {
            if (candidate && existsSync(candidate)) {
                sdkPath = candidate;
                break;
            }
        }
    }

    if (existsSync(localPropertiesPath)) {
        const content = readFileSync(localPropertiesPath, 'utf8');
        const lines = content.split(/\r?\n/);
        const sdkLine = lines.find(line => line.trim().startsWith('sdk.dir'));
        if (sdkLine) {
            const currentVal = sdkLine.split('=')[1]?.trim() || '';
            const unescapedVal = currentVal.replace(/\\:/g, ':').replace(/\\\\/g, '\\');
            
            // If the configured sdk.dir doesn't exist on disk, we need to rewrite/update it!
            if (!unescapedVal || !existsSync(unescapedVal)) {
                console.log(`⚠️ Existing sdk.dir in local.properties (${unescapedVal}) is invalid or non-existent.`);
                requiresWrite = true;
            } else {
                console.log(`✅ Valid Android SDK already configured in local.properties: ${unescapedVal}`);
                sdkPath = unescapedVal;
                requiresWrite = false;
            }
        } else {
            requiresWrite = true;
        }
    }

    if (requiresWrite) {
        if (sdkPath) {
            console.log(`✨ Selected Android SDK path for construction: ${sdkPath}`);
            // Use forward slashes to solve any double path separator issues cleanly in properties file
            const formattedPath = sdkPath.replace(/\\/g, '/');
            writeFileSync(localPropertiesPath, `sdk.dir=${formattedPath}\n`);
            console.log(`✅ Updated android/local.properties securely with 'sdk.dir=${formattedPath}'\n`);
        } else {
            console.log('⚠️ Could not locate a valid, existing Android SDK directory on your system.');
            console.log('But we will configure C:/Users/Factorythird/AppData/Local/Android/Sdk as a manual fallback.\n');
            sdkPath = 'C:\\Users\\Factorythird\\AppData\\Local\\Android\\Sdk';
            writeFileSync(localPropertiesPath, `sdk.dir=C:/Users/Factorythird/AppData/Local/Android/Sdk\n`);
        }
    }

    // 3. Assemble APK via Gradle
    const isRelease = process.argv.includes('--release');
    
    // 2.5. Automatic Signing Keystore Generation (if release)
    if (isRelease) {
        const keystorePath = join(gradleDir, 'app', 'release-key.keystore');
        if (!existsSync(keystorePath)) {
            console.log('🔑 Keystore file not found. Generating automatic release keystore...');
            try {
                let keytoolCmd = 'keytool';
                if (process.env.JAVA_HOME) {
                    const javaKeytool = join(process.env.JAVA_HOME, 'bin', isWindows ? 'keytool.exe' : 'keytool');
                    if (existsSync(javaKeytool)) {
                        keytoolCmd = `"${javaKeytool}"`;
                    }
                }
                const genKeyCmd = `${keytoolCmd} -genkeypair -v -keystore "${keystorePath}" -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000 -storepass 123456 -keypass 123456 -dname "CN=Sayan, OU=Debagaran, O=Debagaran, L=Tehran, S=Tehran, C=IR"`;
                console.log(`🚀 Generating key with: ${genKeyCmd}`);
                execSync(genKeyCmd, { stdio: 'inherit' });
                console.log('✅ Automatically generated release-key.keystore successfully.\n');
            } catch (err) {
                console.warn('⚠️ Warning: Automatic key generation failed. Make sure Java JDK is installed and keytool is in your system PATH.');
                console.warn(err instanceof Error ? err.message : String(err));
            }
        } else {
            console.log('✅ release-key.keystore already exists inside android/app.\n');
        }
    }

    const buildType = isRelease ? 'Release' : 'Debug';
    const taskName = `assemble${buildType}`;
    
    console.log(`⚙️  Step 3/4: Building Android ${buildType} APK using Gradle... (This may take a moment)`);
    
    const gradlewName = isWindows ? 'gradlew.bat' : 'gradlew';
    const gradlewPath = join(gradleDir, gradlewName);

    let gradleCmd = '';
    if (existsSync(gradlewPath)) {
        gradleCmd = isWindows ? `gradlew.bat ${taskName}` : `./gradlew ${taskName}`;
    } else {
        console.log('ℹ️  Gradle wrapper not found, trying system gradle...');
        gradleCmd = `gradle ${taskName}`;
    }

    console.log(`🚀 Executing: ${gradleCmd} inside ./android`);
    
    // Set explicit environment variables (ANDROID_HOME & ANDROID_SDK_ROOT) for execution subprocess
    const extraEnv = {};
    if (sdkPath) {
        extraEnv.ANDROID_HOME = sdkPath;
        extraEnv.ANDROID_SDK_ROOT = sdkPath;
    }
    
    // Execute gradle assemble task
    execSync(gradleCmd, { 
        cwd: gradleDir, 
        stdio: 'inherit',
        env: {
            ...process.env,
            ...extraEnv
        }
    });
    console.log('✅ Gradle compilation finished.\n');

    // 4. Locating and copying APK to root
    console.log('📂 Step 4/4: Locating compiled APK file...');
    const apkSubDir = isRelease ? 'release' : 'debug';
    const primaryApkName = isRelease ? 'app-release-unsigned.apk' : 'app-debug.apk';
    const secondaryApkName = isRelease ? 'app-release.apk' : 'app-debug.apk';
    
    const primaryApkPath = join(gradleDir, 'app', 'build', 'outputs', 'apk', apkSubDir, primaryApkName);
    const secondaryApkPath = join(gradleDir, 'app', 'build', 'outputs', 'apk', apkSubDir, secondaryApkName);
    const rootApkPath = join(process.cwd(), isRelease ? 'payment-system-release.apk' : 'payment-system-latest.apk');

    let selectedApkPath = null;
    if (existsSync(primaryApkPath)) {
        selectedApkPath = primaryApkPath;
    } else if (existsSync(secondaryApkPath)) {
        selectedApkPath = secondaryApkPath;
    }

    if (selectedApkPath) {
        copyFileSync(selectedApkPath, rootApkPath);
        console.log('====================================================');
        console.log(`🎉 SUCCESS! ${buildType.toUpperCase()} APK BUILT SUCCESSFULLY! 🎉`);
        console.log(`📁 Saved to: ${rootApkPath}`);
        console.log('====================================================');
    } else {
        console.warn(`⚠️ Warning: APK build finished, but output file (${primaryApkName} or ${secondaryApkName}) was not found in:`);
        console.log(`   - ${primaryApkPath}`);
        console.log(`   - ${secondaryApkPath}`);
        console.log('Please check your Android Studio configuration or ./android build files.');
    }

} catch (error) {
    console.error('\n❌ Build failed with error:');
    console.error(error instanceof Error ? error.message : String(error));
    console.log('\n💡 Tip: Make sure JDK (Java Development Kit) 17 is installed on your machine and configured in your environment.');
    process.exit(1);
}
