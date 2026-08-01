import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { resolveImageUrl } from './apiService';
import { FileOpener } from '@capacitor-community/file-opener';

/**
 * Downloads a file from the URL and saves it to the device, then opens it.
 * If the file is already downloaded and allowCache is true, it simply opens it without re-downloading.
 */
export const checkFileExists = async (fileName: string): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
        const stat = await Filesystem.stat({ path: fileName, directory: Directory.Documents });
        return !!stat;
    } catch {
        return false;
    }
};

export const downloadAndOpenFile = async (
    url: string, 
    fileName: string, 
    onProgress?: (p: number) => void,
    allowCache: boolean = true
) => {
    try {
        let fetchUrl = resolveImageUrl(url);
        
        // If it's literally a blob: URL (from createObjectURL), just download it directly
        // But normally blob URLs aren't passed to this function.
        
        let shouldDownload = true;
        let fileUri = '';

        if (Capacitor.isNativePlatform()) {
            if (allowCache) {
                try {
                    const stat = await Filesystem.stat({ path: fileName, directory: Directory.Documents });
                    if (stat) {
                        shouldDownload = false;
                        fileUri = stat.uri;
                    }
                } catch (e) {
                    // File does not exist, proceed to download
                }
            }

            if (shouldDownload) {
                if (onProgress) onProgress(10);
                
                try {
                    const downloadResult = await Filesystem.downloadFile({
                        url: fetchUrl,
                        path: fileName,
                        directory: Directory.Documents
                    });
                    
                    fileUri = downloadResult.path || ''; // Ensure uri is saved
                } catch (e) {
                    console.error('Filesystem.downloadFile error:', e);
                    // Fallback to fetch if downloadFile fails for some reason
                    const response = await fetch(fetchUrl);
                    const blob = await response.blob();
                    if (onProgress) onProgress(80);
                    
                    const base64data = await blobToBase64(blob);
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: base64data,
                        directory: Directory.Documents
                    });
                    fileUri = result.uri;
                }
                
                if (onProgress) onProgress(100);
            } else {
                if (onProgress) onProgress(100);
            }

            // At this point we have fileUri for the device, let's open it
            try {
                await FileOpener.open({ filePath: fileUri });
            } catch (openErr) {
                console.error("Error opening file:", openErr);
                alert('فایل با موفقیت ذخیره شد اما امکان باز کردن مستقیم آن وجود ندارد (در پوشه Documents ذخیره شده است).');
            }
            
        } else {
            // Web environment
            if (onProgress) onProgress(100);
            const a = document.createElement('a');
            a.href = fetchUrl;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (err) {
        console.error('Download error:', err);
        alert('خطا در دریافت و ذخیره فایل');
    }
};

export const saveBlobAndOpenFile = async (blob: Blob, fileName: string) => {
    if (Capacitor.isNativePlatform()) {
        try {
            const base64data = await blobToBase64(blob);
            const result = await Filesystem.writeFile({
                path: fileName,
                data: base64data,
                directory: Directory.Documents
            });
            await FileOpener.open({ filePath: result.uri });
        } catch (err) {
            console.error('Error saving/opening blob:', err);
            alert('خطا در ذخیره و باز کردن فایل.');
        }
    } else {
        // Web environment
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        
        // Use a small delay before clicking and revoking to ensure some browsers don't cancel it
        setTimeout(() => {
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 1000);
        }, 100);
    }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
            const result = reader.result as string;
            // Strip the 'data:...base64,' prefix to get only the raw base64 data
            const base64Data = result.split(',')[1];
            resolve(base64Data);
        };
        reader.readAsDataURL(blob);
    });
};
