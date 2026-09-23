mod backend;

use backend::Backend;
use std::sync::atomic::Ordering;
use tauri::Manager;

#[tauri::command]
fn get_server_url(backend: tauri::State<'_, Backend>) -> Option<String> {
    backend.server_url().map(str::to_owned)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Only the folder picker: the client asks the user where a project lives.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let backend = tauri::async_runtime::block_on(Backend::start(app.handle()))?;
            app.manage(backend);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_server_url])
        .build(tauri::generate_context!())
        .expect("error while building Eitri")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                let backend = app.state::<Backend>();
                if backend.stopped.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_exit();
                if !backend.stopping.swap(true, Ordering::SeqCst) {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        app.state::<Backend>().stop().await;
                        app.exit(code.unwrap_or(0));
                    });
                }
            }
        });
}
