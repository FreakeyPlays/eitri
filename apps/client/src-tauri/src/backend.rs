use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::sync::{oneshot, watch, Mutex};

pub struct Backend {
    child: Mutex<Option<CommandChild>>,
    server_url: Option<String>,
    exited: watch::Receiver<bool>,
    pub stopping: AtomicBool,
    pub stopped: AtomicBool,
}

#[derive(serde::Deserialize)]
struct Ready {
    url: String,
}

impl Backend {
    /// Connects to the watched dev server, or starts the bundled server in packaged builds.
    pub async fn start(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        if tauri::is_dev() {
            return Ok(Self {
                child: Mutex::new(None),
                server_url: None,
                exited: watch::channel(false).1,
                stopping: AtomicBool::new(false),
                stopped: AtomicBool::new(false),
            });
        }
        let (mut events, child) = app
            .shell()
            .sidecar("eitri-server")?
            .arg("--sidecar")
            .env("PORT", "0")
            .spawn()?;
        let (ready_tx, ready_rx) = oneshot::channel();
        let (exited_tx, exited) = watch::channel(false);
        tauri::async_runtime::spawn(async move {
            let mut ready_tx = Some(ready_tx);
            while let Some(event) = events.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        if let Ok(ready) = serde_json::from_slice::<Ready>(&line) {
                            if let Some(tx) = ready_tx.take() {
                                let _ = tx.send(ready.url);
                            }
                        } else {
                            log::info!("server: {}", String::from_utf8_lossy(&line));
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        log::error!("server: {}", String::from_utf8_lossy(&line))
                    }
                    CommandEvent::Error(error) => log::error!("server: {error}"),
                    CommandEvent::Terminated(status) => {
                        log::info!("Server exited: {:?}", status.code);
                        break;
                    }
                    _ => {}
                }
            }
            let _ = exited_tx.send(true);
        });
        match tokio::time::timeout(Duration::from_secs(10), ready_rx).await {
            Ok(Ok(url)) => Ok(Self {
                child: Mutex::new(Some(child)),
                server_url: Some(url),
                exited,
                stopping: AtomicBool::new(false),
                stopped: AtomicBool::new(false),
            }),
            _ => {
                let _ = child.kill();
                Err("The bundled server did not become ready within 10 seconds.".into())
            }
        }
    }

    /// Packaged builds connect directly; development uses the frontend's same-origin proxy.
    pub fn server_url(&self) -> Option<&str> {
        self.server_url.as_deref()
    }

    /// Gives active CLI requests time to cancel before using the forced-stop fallback.
    pub async fn stop(&self) {
        let mut child = self.child.lock().await;
        if let Some(mut process) = child.take() {
            if !*self.exited.borrow() {
                let _ = process.write(b"shutdown\n");
                let mut exited = self.exited.clone();
                if tokio::time::timeout(Duration::from_secs(5), exited.wait_for(|done| *done))
                    .await
                    .is_err()
                {
                    let _ = process.kill();
                }
            }
        }
        self.stopped.store(true, Ordering::SeqCst);
    }
}
