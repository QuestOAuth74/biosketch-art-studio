use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let handle = app.handle();

      let new_item = MenuItemBuilder::new("New Project")
        .id("new")
        .accelerator("CmdOrCtrl+N")
        .build(handle)?;
      let open_item = MenuItemBuilder::new("Open…")
        .id("open")
        .accelerator("CmdOrCtrl+O")
        .build(handle)?;
      let save_item = MenuItemBuilder::new("Save")
        .id("save")
        .accelerator("CmdOrCtrl+S")
        .build(handle)?;
      let save_as_item = MenuItemBuilder::new("Save As…")
        .id("save-as")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(handle)?;
      let quit_item = PredefinedMenuItem::quit(handle, Some("Exit"))?;

      let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&new_item)
        .item(&open_item)
        .separator()
        .item(&save_item)
        .item(&save_as_item)
        .separator()
        .item(&quit_item)
        .build()?;

      let zoom_in = MenuItemBuilder::new("Zoom In").id("zoom-in").accelerator("CmdOrCtrl+=").build(handle)?;
      let zoom_out = MenuItemBuilder::new("Zoom Out").id("zoom-out").accelerator("CmdOrCtrl+-").build(handle)?;
      let zoom_fit = MenuItemBuilder::new("Zoom to Fit").id("zoom-fit").accelerator("CmdOrCtrl+0").build(handle)?;
      let zoom_100 = MenuItemBuilder::new("Zoom to 100%").id("zoom-100").accelerator("CmdOrCtrl+1").build(handle)?;
      let toggle_fullscreen = MenuItemBuilder::new("Toggle Fullscreen").id("toggle-fullscreen").accelerator("F11").build(handle)?;
      let toggle_grid = MenuItemBuilder::new("Toggle Grid").id("toggle-grid").accelerator("CmdOrCtrl+'").build(handle)?;
      let toggle_rulers = MenuItemBuilder::new("Toggle Rulers").id("toggle-rulers").accelerator("Alt+R").build(handle)?;

      let view_menu = SubmenuBuilder::new(handle, "View")
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_fit)
        .item(&zoom_100)
        .separator()
        .item(&toggle_fullscreen)
        .separator()
        .item(&toggle_grid)
        .item(&toggle_rulers)
        .build()?;

      let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .item(&PredefinedMenuItem::undo(handle, Some("Undo"))?)
        .item(&PredefinedMenuItem::redo(handle, Some("Redo"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(handle, Some("Cut"))?)
        .item(&PredefinedMenuItem::copy(handle, Some("Copy"))?)
        .item(&PredefinedMenuItem::paste(handle, Some("Paste"))?)
        .item(&PredefinedMenuItem::select_all(handle, Some("Select All"))?)
        .build()?;

      let about_item = MenuItemBuilder::new("About Biosketch.Art Studio")
        .id("about")
        .build(handle)?;
      let help_menu = SubmenuBuilder::new(handle, "Help")
        .item(&about_item)
        .build()?;

      let menu = MenuBuilder::new(handle)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&help_menu)
        .build()?;

      app.set_menu(menu)?;
      app.on_menu_event(|app, event| {
        let id = event.id().as_ref().to_string();
        if let Some(win) = app.get_webview_window("main") {
          let _ = win.emit("app-menu", id);
        }
      });

      // If launched with a .biosketch file as an argument (e.g. double-click
      // in Explorer/Finder), hand the path to the webview after it loads.
      let args: Vec<String> = std::env::args().collect();
      if let Some(path) = args.iter().skip(1).find(|a| a.ends_with(".biosketch")) {
        let path_owned = path.clone();
        let handle = app.handle().clone();
        std::thread::spawn(move || {
          std::thread::sleep(std::time::Duration::from_millis(1500));
          if let Some(win) = handle.get_webview_window("main") {
            let _ = win.emit("app-open-file", path_owned);
          }
        });
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
