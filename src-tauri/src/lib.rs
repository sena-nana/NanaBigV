use std::sync::Mutex;
use tauri::{utils::config::Color, Manager, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";
const BG: Color = Color(0x18, 0x18, 0x18, 0xFF);

mod context;
mod memory;
mod provider;
mod window_state;

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(context::ContextWindowState::default()))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _ = window.set_background_color(Some(BG));
                if let Some(state) = window_state::load_main_window_state(app.handle()) {
                    window_state::restore_main_window_state(&window, state);
                }
                let _ = window.show();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != MAIN_WINDOW_LABEL {
                return;
            }
            if matches!(
                event,
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
            ) {
                if let Some(webview_window) = window.get_webview_window(MAIN_WINDOW_LABEL) {
                    window_state::persist_main_window_state(&window.app_handle(), &webview_window);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            context::submit_context_event,
            context::load_context_window,
            context::clear_context_window,
            memory::load_memory_snapshot,
            memory::retrieve_memory,
            memory::submit_memory_write,
            provider::load_provider_config,
            provider::save_provider_config,
            provider::test_provider_connection,
            provider::list_provider_models,
            provider::generate_provider_json
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
