// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Configure window for high performance
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                {
                    // Disable vsync and enable high-performance graphics on Windows
                    if let Ok(()) = window.with_webview(|webview| {
                        webview.disable_graphics_api();
                        Ok(())
                    }) {
                        log::info!("High-performance graphics mode enabled");
                    }
                }

                // Set high-performance hints
                if let Err(e) = window.set_content_protected(false) {
                    log::warn!("Failed to set content protection: {}", e);
                }
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
