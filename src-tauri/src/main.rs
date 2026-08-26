#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;
use serde::{Serialize, Deserialize};
use tauri::{Manager, WindowBuilder, WindowUrl};

// The server config schema stored in AppData
#[derive(Serialize, Deserialize, Clone, Debug)]
struct ClientConfig {
    local_server_url: String,
    cloud_server_url: String,
    update_url: String,
    auto_check_updates: bool,
    timeout_ms: u64,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            local_server_url: "http://localhost:3000".to_string(),
            cloud_server_url: "https://ais-dev-wjlf3a3s2y7mgngiaxufff-97484218589.us-east1.run.app".to_string(),
            update_url: "".to_string(),
            auto_check_updates: true,
            timeout_ms: 1200,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct UpdateCheckResult {
    has_update: bool,
    current_version: String,
    latest_version: String,
    download_url: String,
    release_notes: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct TauriUpdateManifest {
    version: Option<String>,
    notes: Option<String>,
    pub_date: Option<String>,
    platforms: Option<serde_json::Value>,
}

// Custom tauri command to retrieve the current resolved and saved servers
#[tauri::command]
fn get_client_config(handle: tauri::AppHandle) -> ClientConfig {
    get_or_create_config(&handle)
}

// Custom tauri command to update local server IP, cloud URL or update endpoint
#[tauri::command]
fn save_client_config(handle: tauri::AppHandle, config: ClientConfig) -> Result<(), String> {
    let config_dir = handle.path_resolver().app_config_dir().unwrap_or_else(|| PathBuf::from("."));
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let config_file = config_dir.join("config.json");
    let mut file = File::create(config_file).map_err(|e| e.to_string())?;
    let json_data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    file.write_all(json_data.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

// Custom tauri command to check update directly via HTTP feed
#[tauri::command]
fn check_desktop_update(handle: tauri::AppHandle, custom_url: Option<String>) -> UpdateCheckResult {
    let config = get_or_create_config(&handle);
    let app_version = handle.package_info().version.to_string();
    
    let target_endpoint = if let Some(u) = custom_url {
        if !u.trim().is_empty() { u } else { config.update_url.clone() }
    } else {
        config.update_url.clone()
    };

    let resolved_url = if !target_endpoint.trim().is_empty() {
        target_endpoint
    } else {
        // Fallback to local or cloud updater.json endpoint
        if check_connection(&config.local_server_url, 800) {
            format!("{}/api/desktop/updater.json", config.local_server_url.trim_end_matches('/'))
        } else {
            format!("{}/api/desktop/updater.json", config.cloud_server_url.trim_end_matches('/'))
        }
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(5))
        .build();

    match client {
        Ok(c) => {
            match c.get(&resolved_url).send() {
                Ok(response) => {
                    if response.status().is_success() {
                        if let Ok(manifest) = response.json::<TauriUpdateManifest>() {
                            let latest_ver = manifest.version.unwrap_or_else(|| app_version.clone());
                            let notes = manifest.notes.unwrap_or_default();
                            
                            let mut dl_url = "".to_string();
                            if let Some(platforms) = manifest.platforms {
                                if let Some(win) = platforms.get("windows-x86_64") {
                                    if let Some(u) = win.get("url").and_then(|v| v.as_str()) {
                                        dl_url = u.to_string();
                                    }
                                }
                            }
                            
                            let has_update = latest_ver != app_version;
                            UpdateCheckResult {
                                has_update,
                                current_version: app_version,
                                latest_version: latest_ver,
                                download_url: dl_url,
                                release_notes: notes,
                                error: None,
                            }
                        } else {
                            UpdateCheckResult {
                                has_update: false,
                                current_version: app_version,
                                latest_version: "نامشخص".to_string(),
                                download_url: "".to_string(),
                                release_notes: "".to_string(),
                                error: Some("فرمت فایل بروزرسانی نامعتبر است".to_string()),
                            }
                        }
                    } else {
                        UpdateCheckResult {
                            has_update: false,
                            current_version: app_version,
                            latest_version: "نامشخص".to_string(),
                            download_url: "".to_string(),
                            release_notes: "".to_string(),
                            error: Some(format!("پاسخ ناموفق سرور: {}", response.status())),
                        }
                    }
                },
                Err(e) => UpdateCheckResult {
                    has_update: false,
                    current_version: app_version,
                    latest_version: "نامشخص".to_string(),
                    download_url: "".to_string(),
                    release_notes: "".to_string(),
                    error: Some(format!("عدم برقراری ارتباط با لینک آپدیت: {}", e)),
                }
            }
        },
        Err(e) => UpdateCheckResult {
            has_update: false,
            current_version: app_version,
            latest_version: "نامشخص".to_string(),
            download_url: "".to_string(),
            release_notes: "".to_string(),
            error: Some(e.to_string()),
        }
    }
}

fn get_or_create_config(handle: &tauri::AppHandle) -> ClientConfig {
    let config_dir = handle.path_resolver().app_config_dir().unwrap_or_else(|| PathBuf::from("."));
    let config_file = config_dir.join("config.json");
    
    if config_file.exists() {
        if let Ok(content) = fs::read_to_string(&config_file) {
            if let Ok(config) = serde_json::from_str::<ClientConfig>(&content) {
                return config;
            }
        }
    }
    
    // Default config if not exists
    let default_config = ClientConfig::default();
    if let Ok(_) = fs::create_dir_all(&config_dir) {
        if let Ok(mut file) = File::create(config_file) {
            let _ = file.write_all(serde_json::to_string_pretty(&default_config).unwrap().as_bytes());
        }
    }
    default_config
}

// Ping helper to verify connection with a short timeout
fn check_connection(url: &str, timeout_ms: u64) -> bool {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(timeout_ms))
        .build();
    
    if let Ok(c) = client {
        let test_url = if url.ends_with('/') {
            format!("{}api/health", url)
        } else {
            format!("{}/api/health", url)
        };
        
        match c.get(&test_url).send() {
            Ok(resp) => resp.status().is_success(),
            Err(_) => {
                match c.get(url).send() {
                    Ok(resp) => resp.status().is_success() || resp.status().as_u16() == 404,
                    Err(_) => false,
                }
            }
        }
    } else {
        false
    }
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
        let handle = app.app_handle();
        let config = get_or_create_config(&handle);
        
        println!("Checking local server connectivity on: {}", config.local_server_url);
        
        // 1. Try to connect to Local network server
        let target_url = if check_connection(&config.local_server_url, config.timeout_ms) {
            println!("Local warehouse network server is active! Loading: {}", config.local_server_url);
            config.local_server_url
        } else {
            // 2. Fall back to Cloud server
            println!("Local server offline or unreachable. Falling back to Sayan Cloud: {}", config.cloud_server_url);
            config.cloud_server_url
        };
        
        let window_url = if let Ok(parsed_url) = target_url.parse::<reqwest::Url>() {
            WindowUrl::External(parsed_url)
        } else {
            WindowUrl::App("index.html".into())
        };

        // Build the main window pointing to the dynamically resolved URL
        let main_window = WindowBuilder::new(
            app,
            "main",
            window_url
        )
        .title("سیستم مدیریت انبار سایان (نسخه هوشمند دسکتاپ)")
        .resizable(true)
        .fullscreen(false)
        .maximized(true)
        .decorations(true)
        .center(true)
        .build();
        
        match main_window {
            Ok(_) => println!("Main desktop window successfully spawned."),
            Err(e) => eprintln!("Error spawning desktop window: {:?}", e),
        }
        
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![get_client_config, save_client_config, check_desktop_update])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
