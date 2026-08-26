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
    timeout_ms: u64,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            local_server_url: "http://localhost:3000".to_string(),
            cloud_server_url: "https://ais-dev-wjlf3a3s2y7mgngiaxufff-97484218589.us-east1.run.app".to_string(),
            timeout_ms: 1000,
        }
    }
}

// Custom tauri command to retrieve the current resolved and saved servers
#[tauri::command]
fn get_client_config(handle: tauri::AppHandle) -> ClientConfig {
    get_or_create_config(&handle)
}

// Custom tauri command to update local server IP or cloud URL
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
        // Send a quick head or get request to check if server is active and online
        let test_url = if url.ends_with('/') {
            format!("{}api/health", url)
        } else {
            format!("{}/api/health", url)
        };
        
        match c.get(&test_url).send() {
            Ok(resp) => resp.status().is_success(),
            Err(_) => {
                // Secondary check: try the root path directly
                match c.get(url).send() {
                    Ok(resp) => resp.status().is_success() || resp.status().as_u16() == 404, // 404 means server reached at least
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
        
        // Build the main window pointing to the dynamically resolved URL
        let main_window = WindowBuilder::new(
            app,
            "main",
            WindowUrl::App(target_url.parse().unwrap_or_else(|_| "index.html".parse().unwrap()))
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
    .invoke_handler(tauri::generate_handler![get_client_config, save_client_config])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
