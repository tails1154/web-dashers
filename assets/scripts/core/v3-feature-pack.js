(() => {
  const commands = [
    ["restart_level", "Restart level"], ["toggle_practice", "Toggle practice mode"], ["open_settings", "Open settings"], ["open_icon_kit", "Open icon kit"], ["show_run_stats", "Show run statistics"],
    ["copy_level_id", "Copy level ID"], ["copy_report_id", "Copy crash report ID"], ["take_screenshot", "Take screenshot"], ["reset_checkpoint", "Reset checkpoint"], ["toggle_fullscreen", "Toggle fullscreen"],
    ["replay_last_attempt", "Replay last attempt"], ["open_level_info", "Open level info"], ["open_achievements", "Open achievements"], ["open_update_log", "Open update log"], ["open_audio_browser", "Open audio browser"],
    ["save_editor_level", "Save editor level"], ["play_editor_level", "Play editor level"], ["toggle_editor_grid", "Toggle editor grid"], ["focus_editor_camera", "Center editor camera"], ["clear_editor_selection", "Clear editor selection"]
  ].map(([id, name]) => ({ id, name, kind: "command" }));
  const togglesByCategory = {
    Gameplay: ["Auto restart", "Death marker", "Attempt counter", "Best percent toast", "Level timer", "Session timer", "Completion confetti", "Coin route hints", "Practice ghost", "Practice split timer"],
    Movement: ["Coyote time", "Jump buffer", "Slope landing assist", "Slope launch assist", "Mini jump indicator", "Gravity flip indicator", "Dual player labels", "Dual camera lock", "Wave angle guide", "Ship altitude guide"],
    Editor: ["Snap to grid", "Smart object spacing", "Duplicate offset memory", "Selection outline", "Selection count", "Multi-select marquee", "Quick object search", "Recent objects", "Favorite objects", "Object usage stats"],
    Triggers: ["Layer visibility hotkeys", "Group color preview", "Trigger timeline markers", "Trigger duration preview", "Portal direction preview", "Slope angle preview", "Rotate around selection", "Mirror selection", "Align selection", "Distribute selection"],
    Visuals: ["Smooth camera", "Camera bounds guide", "Background color preview", "Ground color preview", "Object color preview", "Pulse preview", "Shake preview", "Trail quality slider", "Particle density slider", "Glow quality slider"],
    Accessibility: ["High contrast mode", "Reduced motion", "Disable screen shake", "Disable flashes", "Photosensitivity dimmer", "Colorblind green filter", "Colorblind red filter", "Colorblind blue filter", "Input key display", "Pause on focus loss"],
    Input: ["Hold-to-jump mode", "Tap-to-jump mode", "One-handed editor layout", "Left-handed controls", "Input latency meter", "Keyboard remapping", "Controller remapping", "Touch button size", "Touch button opacity", "Input buffer display"],
    Audio: ["Beat pulse", "Beat grid", "Song waveform", "Song BPM label", "Offset calibration", "Practice metronome", "Death sound toggle", "Portal sound toggle", "Mute menu music", "Music ducking"],
    Online: ["Song browser cache", "Search history", "Favorite songs", "Favorite levels", "Download queue", "Download progress", "Retry failed downloads", "Server status badge", "Comment timestamps", "Profile level cache"],
    Progression: ["Run history", "Death heatmap", "Progress graph", "Attempt graph", "Daily streak", "Weekly summary", "Personal records", "Coin completion chart", "Achievement progress bars", "Export statistics"],
    Diagnostics: ["Crash reporting", "Frame time graph", "Memory estimate", "Asset load log", "Network request log", "Level validation report", "Object count warning", "Song availability check", "Save integrity check", "FPS limiter"]
  };
  const toggles = Object.entries(togglesByCategory).flatMap(([category, names]) => names.map(name => ({
    id: `${category.toLowerCase()}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    name,
    category,
    kind: "toggle"
  })));
  const features = [...commands, ...toggles];
  const storeKey = "wd_v3_feature_state";
  const state = (() => { try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch (_) { return {}; } })();
  const save = () => localStorage.setItem(storeKey, JSON.stringify(state));
  const toast = (scene, text) => {
    if (!scene?.add) return;
    const label = scene.add.bitmapText(screenWidth / 2, 92, "goldFont", text, 22).setOrigin(0.5).setScrollFactor(0).setDepth(9000);
    scene.tweens.add({ targets: label, alpha: 0, delay: 1300, duration: 350, onComplete: () => label.destroy() });
  };
  const commandHandlers = {
    restart_level: scene => scene._restartLevel?.(),
    toggle_practice: scene => scene._practicedMode?.togglePracticeMode?.(),
    open_settings: scene => scene._buildSettingsPopup?.(),
    open_icon_kit: scene => scene._openIconSelector?.(),
    show_run_stats: scene => scene._showRunStats?.(),
    copy_level_id: scene => navigator.clipboard?.writeText?.(String(window.currentlevel?.[2] || "")),
    copy_report_id: scene => navigator.clipboard?.writeText?.(String(window._wdLastCrashReport?.id || "")),
    take_screenshot: scene => scene.game.renderer.snapshot(image => { const link = document.createElement("a"); link.download = "web-dashers-screenshot.png"; link.href = image.src; link.click(); }),
    reset_checkpoint: scene => scene._practicedMode?.deleteLastCheckpoint?.(),
    toggle_fullscreen: scene => scene._toggleFullscreen?.(),
    replay_last_attempt: scene => scene._restartLevel?.(),
    open_level_info: scene => scene.levelstats?.(),
    open_achievements: scene => window.GDAchievements?.showPanel?.(),
    open_update_log: scene => scene._buildUpdateLogPopup?.(),
    open_audio_browser: scene => scene._openEditorLevelSettingsPopup?.(),
    save_editor_level: scene => scene._saveEditorLevel?.(),
    play_editor_level: scene => scene._startEditorPlaytest?.(),
    toggle_editor_grid: scene => scene._editorGridGraphics?.setVisible?.(!scene._editorGridGraphics.visible),
    focus_editor_camera: scene => { scene._cameraX = 0; scene._cameraY = 0; },
    clear_editor_selection: scene => scene._deselectEditorObject?.()
  };
  const toggleHandlers = {
    accessibility_high_contrast_mode: (scene, on) => { document.body.style.filter = on ? "contrast(1.22) saturate(1.08)" : ""; },
    accessibility_reduced_motion: (_scene, on) => { window.wdReducedMotion = on; },
    accessibility_disable_screen_shake: (_scene, on) => { window.wdDisableScreenShake = on; },
    accessibility_photosensitivity_dimmer: (_scene, on) => { window.wdPhotosensitivityDimmer = on; },
    visuals_smooth_camera: (_scene, on) => { window.wdSmoothCamera = on; },
    gameplay_attempt_counter: (scene, on) => scene._attemptsLabel?.setVisible(on),
    diagnostics_frame_time_graph: (scene, on) => scene._fpsText?.setVisible(on),
    audio_mute_menu_music: (scene, on) => { if (on && scene._menuActive) scene._audio?.stopMusic?.(); },
    editor_snap_to_grid: (_scene, on) => { window.wdEditorSnapToGrid = on; },
    input_hold_to_jump_mode: (_scene, on) => { window.wdHoldToJump = on; },
    input_tap_to_jump_mode: (_scene, on) => { window.wdTapToJump = on; },
    input_left_handed_controls: (_scene, on) => { window.wdLeftHandedControls = on; },
    diagnostics_fps_limiter: (_scene, on) => { window.wdFpsLimiter = on ? 60 : 0; },
    visuals_particle_density_slider: (_scene, on) => { window.wdParticleDensity = on ? 0.65 : 1; },
    visuals_glow_quality_slider: (_scene, on) => { window.wdGlowQuality = on ? 0.65 : 1; }
  };
  window.WDV3 = {
    version: 3,
    features,
    isEnabled(id) { return state[id] === true; },
    setEnabled(id, value) { state[id] = !!value; save(); return state[id]; },
    update(scene, delta = 0) {
      if (!scene?.add) return;
      if (this.isEnabled("gameplay_level_timer") && !scene._menuActive && !window.isEditor) {
        scene._v3LevelSeconds = (scene._v3LevelSeconds || 0) + Math.max(0, Number(delta) || 0) / 1000;
        if (!scene._v3LevelTimerLabel) scene._v3LevelTimerLabel = scene.add.bitmapText(screenWidth - 12, 52, "bigFont", "", 18).setOrigin(1, 0.5).setScrollFactor(0).setDepth(90);
        const seconds = scene._v3LevelSeconds;
        scene._v3LevelTimerLabel.setText(`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`).setVisible(true);
      } else if (scene._v3LevelTimerLabel) scene._v3LevelTimerLabel.setVisible(false);
      if (this.isEnabled("gameplay_session_timer")) {
        scene._v3SessionSeconds = (scene._v3SessionSeconds || 0) + Math.max(0, Number(delta) || 0) / 1000;
        if (!scene._v3SessionTimerLabel) scene._v3SessionTimerLabel = scene.add.bitmapText(12, 72, "bigFont", "", 17).setOrigin(0, 0.5).setScrollFactor(0).setDepth(90);
        scene._v3SessionTimerLabel.setText(`Session ${Math.floor(scene._v3SessionSeconds)}s`).setVisible(true);
      }
      if (this.isEnabled("accessibility_pause_on_focus_loss") && document.hidden && !scene._menuActive && !scene._paused) scene._pauseGame?.();
      if (this.isEnabled("audio_mute_menu_music") && scene._menuActive && scene._audio?.isplaying?.()) scene._audio.stopMusic?.();
    },
    run(id, scene = window._wdGameScene) {
      const feature = features.find(item => item.id === id);
      if (!feature) return false;
      if (feature.kind === "toggle") {
        const enabled = this.setEnabled(id, !this.isEnabled(id));
        toggleHandlers[id]?.(scene, enabled);
      } else commandHandlers[id]?.(scene);
      toast(scene, `${feature.name}: ${feature.kind === "toggle" ? (this.isEnabled(id) ? "ON" : "OFF") : "DONE"}`);
      return true;
    },
    install(scene) {
      if (scene._v3FeatureKeyHandler) return;
      scene._v3FeatureKeyHandler = event => {
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") {
          event.preventDefault();
          scene._openV3FeatureMenu?.();
        }
      };
      window.addEventListener("keydown", scene._v3FeatureKeyHandler);
      scene.events.once("shutdown", () => window.removeEventListener("keydown", scene._v3FeatureKeyHandler));
    }
  };
})();
