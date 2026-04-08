use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::webview::WebviewWindowBuilder;
use tauri::{Manager, WebviewUrl};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// Hide console window on Windows
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// Holds sidecar processes — killed automatically when dropped (app exit)
struct Sidecars(Mutex<Vec<Child>>);

impl Drop for Sidecars {
    fn drop(&mut self) {
        if let Ok(mut procs) = self.0.lock() {
            for child in procs.iter_mut() {
                let _ = child.kill();
            }
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Resolve NESTdesktop/ dir relative to the exe
            // exe lives at NESTdesktop/src-tauri/target/release/nestdesktop.exe
            let exe_path = std::env::current_exe()?;
            let nestdesktop_dir = exe_path
                .parent().unwrap() // release/
                .parent().unwrap() // target/
                .parent().unwrap() // src-tauri/
                .parent().unwrap(); // NESTdesktop/

            println!("🐺 NESTdesktop starting...");

            let mut children: Vec<Child> = Vec::new();

            // Start local agent (dashboard + PC tools)
            match Command::new("node")
                .arg("local-agent.js")
                .current_dir(nestdesktop_dir)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
            {
                Ok(child) => {
                    println!("   ✓ Local agent started (PID {})", child.id());
                    children.push(child);
                }
                Err(e) => {
                    println!("   ⚠ Local agent: {} — may already be running", e);
                }
            }

            // Start Cloudflare Tunnel
            match Command::new("cloudflared")
                .args(["tunnel", "run", "your-tunnel-name"]) // Replace with your Cloudflare tunnel name
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
            {
                Ok(child) => {
                    println!("   ✓ Tunnel started (PID {})", child.id());
                    children.push(child);
                }
                Err(e) => {
                    println!("   ⚠ Tunnel: {} — may already be running", e);
                }
            }

            // Register for cleanup on exit
            app.manage(Sidecars(Mutex::new(children)));

            // Give ports a moment to bind before opening the window
            std::thread::sleep(std::time::Duration::from_millis(1500));

            // Open the main window
            let url = WebviewUrl::External("http://localhost:3000".parse().unwrap());
            WebviewWindowBuilder::new(app, "main", url)
                .title("NESTdesktop — The Nest")
                .inner_size(1600.0, 1000.0)
                .min_inner_size(900.0, 600.0)
                .theme(Some(tauri::Theme::Dark))
                .build()?;

            println!("   Dashboard: http://localhost:3000");
            println!("   PC Agent:  http://localhost:3001");
            println!("   Embers Remember.");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running NESTdesktop");
}
