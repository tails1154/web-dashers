(() => {
  const commands = [
    ["restart_level", "Restart level"], ["toggle_practice", "Toggle practice mode"], ["open_settings", "Open settings"], ["open_icon_kit", "Open icon kit"], ["show_run_stats", "Show run statistics"],
    ["copy_level_id", "Copy level ID"], ["copy_report_id", "Copy crash report ID"], ["take_screenshot", "Take screenshot"], ["reset_checkpoint", "Reset checkpoint"], ["toggle_fullscreen", "Toggle fullscreen"],
    ["replay_last_attempt", "Replay last attempt"], ["open_level_info", "Open level info"], ["open_achievements", "Open achievements"], ["open_update_log", "Open update log"], ["open_audio_browser", "Open audio browser"],
    ["save_editor_level", "Save editor level"], ["play_editor_level", "Play editor level"], ["toggle_editor_grid", "Toggle editor grid"], ["focus_editor_camera", "Center editor camera"], ["clear_editor_selection", "Clear editor selection"], ["reset_v3_preferences", "Reset V3 preferences"]
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
  const notice = (scene, title, message) => {
    if (window.showNativePhaserDialog) return window.showNativePhaserDialog({ title, message, notice: true });
    toast(scene, `${title}: ${message}`);
  };
  const copyText = (scene, value) => {
    if (!navigator.clipboard?.writeText) return notice(scene, "COPY", "Clipboard access was unavailable.");
    Promise.resolve(navigator.clipboard.writeText(value)).catch(() => notice(scene, "COPY", "Clipboard access was unavailable."));
  };
  const downloadJson = (filename, value) => {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const commandHandlers = {
    restart_level: scene => scene._restartLevel?.(),
    toggle_practice: scene => scene._practicedMode?.togglePracticeMode?.(),
    open_settings: scene => scene._buildSettingsPopup?.(),
    open_icon_kit: scene => scene._openIconSelector?.(),
    show_run_stats: scene => {
      const level = window.currentlevel || [];
      notice(scene, "RUN STATISTICS", `Attempts: ${scene._levelAttempts || 0}\nBest: ${scene._bestPercent || 0}%\nLevel: ${level[1] || "Unknown"}`);
    },
    copy_level_id: scene => copyText(scene, String(window.currentlevel?.[2] || "")),
    copy_report_id: scene => copyText(scene, String(window._wdLastCrashReport?.id || "")),
    take_screenshot: scene => scene.game.renderer.snapshot(image => { const link = document.createElement("a"); link.download = "web-dashers-screenshot.png"; link.href = image.src; link.click(); }),
    reset_checkpoint: scene => scene._practicedMode?.deleteLastCheckpoint?.(),
    toggle_fullscreen: scene => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch?.(() => notice(scene, "FULLSCREEN", "Fullscreen was blocked by the browser."));
    },
    replay_last_attempt: scene => scene._restartLevel?.(),
    open_level_info: scene => scene.levelstats?.(),
    open_audio_browser: scene => scene._openEditorLevelSettingsPopup?.(),
    save_editor_level: scene => scene._saveEditorLevel?.(),
    play_editor_level: scene => scene._startEditorPlaytest?.(),
    toggle_editor_grid: scene => {
      if (scene._editorGridGraphics) scene._editorGridGraphics.setVisible(!scene._editorGridGraphics.visible);
    },
    focus_editor_camera: scene => { scene._cameraX = 0; scene._cameraY = 0; },
    clear_editor_selection: scene => scene._deselectEditorObject?.(),
    reset_v3_preferences: scene => {
      features.filter(feature => feature.kind === "toggle").forEach(feature => { state[feature.id] = false; applyToggle(scene, feature.id, false); });
      save();
      notice(scene, "V3 PREFERENCES", "All V3 toggles were reset.");
    },
    open_update_log: scene => scene._buildUpdateLogPopup?.(),
    open_achievements: scene => window.GDAchievements?.showPanel?.() || notice(scene, "ACHIEVEMENTS", "The achievements panel is unavailable here."),
    diagnostics_level_validation_report: scene => {
      const objects = Array.isArray(window.levelObjects) ? window.levelObjects.filter(Boolean) : [];
      const invalid = objects.filter(object => !Number.isFinite(Number(object.id)) || !Number.isFinite(Number(object.x)) || !Number.isFinite(Number(object.y)));
      notice(scene, "LEVEL VALIDATION", `Objects: ${objects.length}\nInvalid objects: ${invalid.length}\nStatus: ${invalid.length ? "Needs attention" : "Valid"}`);
    },
    diagnostics_save_integrity_check: scene => {
      try {
        const levels = JSON.parse(localStorage.getItem("created_levels") || "[]");
        const broken = levels.filter(level => !level || !level.createdId || typeof level.levelString !== "string");
        notice(scene, "SAVE INTEGRITY", `Created levels: ${levels.length}\nInvalid records: ${broken.length}`);
      } catch (_) { notice(scene, "SAVE INTEGRITY", "The local level save could not be parsed."); }
    },
    progression_export_statistics: scene => {
      downloadJson("web-dashers-statistics.json", {
        exportedAt: new Date().toISOString(),
        attempts: scene._attempts || 0,
        levelAttempts: scene._levelAttempts || 0,
        levelId: window.currentlevel?.[2] || null,
        featureState: state
      });
      notice(scene, "STATISTICS", "Your statistics export has started.");
    }
  };
  const toggleHandlers = {
    accessibility_high_contrast_mode: (_scene, on) => { window.wdHighContrast = on; },
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
    visuals_glow_quality_slider: (_scene, on) => { window.wdGlowQuality = on ? 0.65 : 1; },
    gameplay_auto_restart: (_scene, on) => { window.wdAutoRestart = on; },
    gameplay_death_marker: (_scene, on) => { window.wdDeathMarker = on; },
    gameplay_best_percent_toast: (_scene, on) => { window.wdBestPercentToast = on; },
    gameplay_completion_confetti: (_scene, on) => { window.wdCompletionConfetti = on; },
    movement_coyote_time: (_scene, on) => { window.wdCoyoteTime = on; },
    movement_jump_buffer: (_scene, on) => { window.wdJumpBuffer = on; },
    movement_dual_camera_lock: (_scene, on) => { window.wdDualCameraLock = on; },
    editor_selection_count: (_scene, on) => { window.wdEditorSelectionCount = on; },
    editor_selection_outline: (_scene, on) => { window.wdEditorSelectionOutline = on; },
    editor_smart_object_spacing: (_scene, on) => { window.wdEditorSmartSpacing = on; },
    editor_duplicate_offset_memory: (_scene, on) => { window.wdEditorDuplicateMemory = on; },
    visuals_camera_bounds_guide: (_scene, on) => { window.wdCameraBoundsGuide = on; },
    visuals_wave_angle_guide: (_scene, on) => { window.wdWaveAngleGuide = on; },
    visuals_trail_quality_slider: (_scene, on) => { window.wdTrailQuality = on ? 0.65 : 1; },
    accessibility_disable_flashes: (_scene, on) => { window.wdDisableFlashes = on; },
    accessibility_colorblind_green_filter: (_scene, on) => { window.wdColorFilter = on ? "green" : ""; },
    accessibility_colorblind_red_filter: (_scene, on) => { window.wdColorFilter = on ? "red" : ""; },
    accessibility_colorblind_blue_filter: (_scene, on) => { window.wdColorFilter = on ? "blue" : ""; },
    accessibility_input_key_display: (_scene, on) => { window.wdInputKeyDisplay = on; },
    input_input_latency_meter: (_scene, on) => { window.wdInputLatencyMeter = on; },
    input_input_buffer_display: (_scene, on) => { window.wdInputBufferDisplay = on; },
    audio_beat_pulse: (_scene, on) => { window.wdBeatPulse = on; },
    audio_beat_grid: (_scene, on) => { window.wdBeatGrid = on; },
    audio_offset_calibration: (_scene, on) => { window.wdOffsetCalibration = on; },
    audio_practice_metronome: (_scene, on) => { window.wdPracticeMetronome = on; },
    audio_death_sound_toggle: (_scene, on) => { window.wdDeathSound = on; },
    audio_portal_sound_toggle: (_scene, on) => { window.wdPortalSound = on; },
    audio_music_ducking: (_scene, on) => { window.wdMusicDucking = on; },
    online_song_browser_cache: (_scene, on) => { window.wdSongBrowserCache = on; },
    online_search_history: (_scene, on) => { window.wdSearchHistory = on; },
    online_favorite_songs: (_scene, on) => { window.wdFavoriteSongs = on; },
    online_favorite_levels: (_scene, on) => { window.wdFavoriteLevels = on; },
    online_download_progress: (_scene, on) => { window.wdDownloadProgress = on; },
    online_retry_failed_downloads: (_scene, on) => { window.wdRetryFailedDownloads = on; },
    progression_run_history: (_scene, on) => { window.wdRunHistory = on; },
    progression_death_heatmap: (_scene, on) => { window.wdDeathHeatmap = on; },
    progression_progress_graph: (_scene, on) => { window.wdProgressGraph = on; },
    progression_personal_records: (_scene, on) => { window.wdPersonalRecords = on; },
    progression_export_statistics: (_scene, on) => { window.wdExportStatistics = on; },
    diagnostics_memory_estimate: (_scene, on) => { window.wdMemoryEstimate = on; },
    diagnostics_asset_load_log: (_scene, on) => { window.wdAssetLoadLog = on; },
    diagnostics_network_request_log: (_scene, on) => { window.wdNetworkRequestLog = on; },
    diagnostics_level_validation_report: (_scene, on) => { window.wdLevelValidationReport = on; },
    diagnostics_object_count_warning: (_scene, on) => { window.wdObjectCountWarning = on; },
    diagnostics_song_availability_check: (_scene, on) => { window.wdSongAvailabilityCheck = on; },
    diagnostics_save_integrity_check: (_scene, on) => { window.wdSaveIntegrityCheck = on; }
  };
  window.wdV3Flags = window.wdV3Flags || {};
  const applyToggle = (scene, id, enabled) => {
    window.wdV3Flags[id] = enabled;
    toggleHandlers[id]?.(scene, enabled);
  };
  const screenW = () => Number(window.screenWidth || window.innerWidth || 960);
  const screenH = () => Number(window.screenHeight || window.innerHeight || 540);
  const ensureLabel = (scene, key, x, y, style = {}) => {
    if (!scene[key]) scene[key] = scene.add.text(x, y, "", {
      fontFamily: "Arial", fontSize: "16px", color: "#ffffff", stroke: "#000000", strokeThickness: 4, ...style
    }).setScrollFactor(0).setDepth(9000);
    return scene[key];
  };
  const refreshFilter = () => {
    const filters = [];
    if (window.wdHighContrast) filters.push("contrast(1.22) saturate(1.08)");
    if (window.wdColorFilter === "green") filters.push("hue-rotate(80deg)");
    if (window.wdColorFilter === "red") filters.push("hue-rotate(290deg)");
    if (window.wdColorFilter === "blue") filters.push("hue-rotate(170deg)");
    if (window.wdPhotosensitivityDimmer) filters.push("brightness(.72)");
    if (window.wdReducedMotion) filters.push("saturate(.82)");
    document.body.style.filter = filters.join(" ");
  };
  const readList = key => {
    try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch (_) { return []; }
  };
  const writeList = (key, value, limit = 500) => localStorage.setItem(key, JSON.stringify(value.slice(-limit)));
  const recordProgress = scene => {
    const dead = !!scene._state?.isDead;
    const won = !!scene._levelWon;
    const wasDead = !!scene._v3WasDead;
    const wasWon = !!scene._v3WasWon;
    if (dead === wasDead && won === wasWon) return;
    scene._v3WasDead = dead;
    scene._v3WasWon = won;
    if (!dead && !won) return;
    const levelId = String(window.currentlevel?.[2] || "level_1");
    const endX = Number(scene._level?.endXPos || 0);
    const percent = endX > 0 ? Math.max(0, Math.min(100, Math.floor(Number(scene._playerWorldX || 0) / endX * 100))) : 0;
    const event = { timestamp: Date.now(), levelId, outcome: won ? "complete" : "death", percent, attempts: Number(scene._levelAttempts || 0) };
    if (window.WDV3.isEnabled("progression_run_history")) writeList("wd_v3_run_history", [...readList("wd_v3_run_history"), event]);
    if (window.WDV3.isEnabled("progression_attempt_graph")) writeList("wd_v3_attempt_history", [...readList("wd_v3_attempt_history"), { timestamp: event.timestamp, levelId, attempts: event.attempts }]);
    if (dead && window.WDV3.isEnabled("progression_death_heatmap")) {
      const bucket = Math.floor(percent / 5) * 5;
      const heatmap = readList("wd_v3_death_heatmap");
      const existing = heatmap.find(item => item.levelId === levelId && item.bucket === bucket);
      if (existing) existing.count += 1;
      else heatmap.push({ levelId, bucket, count: 1 });
      writeList("wd_v3_death_heatmap", heatmap);
    }
    if (won && window.WDV3.isEnabled("progression_personal_records")) {
      const records = readList("wd_v3_personal_records");
      const existing = records.find(item => item.levelId === levelId);
      if (existing) existing.attempts = Math.min(existing.attempts || Infinity, event.attempts || Infinity);
      else records.push({ levelId, attempts: event.attempts, timestamp: event.timestamp });
      writeList("wd_v3_personal_records", records);
    }
    if (won && window.WDV3.isEnabled("progression_daily_streak")) {
      const today = new Date(event.timestamp).toISOString().slice(0, 10);
      const streak = (() => { try { return JSON.parse(localStorage.getItem("wd_v3_daily_streak") || "{}"); } catch (_) { return {}; } })();
      if (streak.lastDate !== today) {
        const yesterday = new Date(event.timestamp - 86400000).toISOString().slice(0, 10);
        streak.count = streak.lastDate === yesterday ? Number(streak.count || 0) + 1 : 1;
        streak.lastDate = today;
        localStorage.setItem("wd_v3_daily_streak", JSON.stringify(streak));
      }
    }
  };
  window.WDV3 = {
    version: 3,
    features,
    isEnabled(id) { return state[id] === true; },
    setEnabled(id, value) { state[id] = !!value; save(); return state[id]; },
    update(scene, delta = 0) {
      if (!scene?.add) return;
      recordProgress(scene);
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
      if (scene._attemptsLabel) scene._attemptsLabel.setVisible(this.isEnabled("gameplay_attempt_counter"));
      refreshFilter();
      if (this.isEnabled("editor_selection_count") && window.isEditor && scene._levelEditor) {
        const selected = scene._levelEditor._getCurrentSelectedEditorObjectIds?.() || [];
        ensureLabel(scene, "_v3SelectionLabel", 14, 104).setText(`Selected objects: ${selected.length}`).setVisible(true);
      } else if (scene._v3SelectionLabel) scene._v3SelectionLabel.setVisible(false);
      if (this.isEnabled("gameplay_death_marker") && !window.isEditor && scene._state?.isDead) {
        if (!scene._v3DeathMarker) scene._v3DeathMarker = scene.add.graphics().setScrollFactor(0).setDepth(8998);
        const markerX = Number(scene._playerWorldX || 0) - Number(scene._cameraX || 0);
        const markerY = typeof b === "function" ? b(Number(scene._state.y || 0)) + Number(scene._cameraY || 0) : screenH() / 2;
        scene._v3DeathMarker.clear().lineStyle(3, 0xff5b5b, 1).lineBetween(markerX - 12, markerY - 12, markerX + 12, markerY + 12).lineBetween(markerX + 12, markerY - 12, markerX - 12, markerY + 12).setVisible(true);
      } else if (scene._v3DeathMarker) scene._v3DeathMarker.setVisible(false);
      if (this.isEnabled("diagnostics_object_count_warning") && window.isEditor) {
        const count = Array.isArray(window.levelObjects) ? window.levelObjects.filter(Boolean).length : 0;
        ensureLabel(scene, "_v3ObjectCountLabel", screenW() - 14, 104, { align: "right" }).setOrigin(1, 0).setText(`Objects: ${count}${count > 1000 ? "  HIGH" : ""}`).setTint(count > 1000 ? 0xff7777 : 0xffffff).setVisible(true);
      } else if (scene._v3ObjectCountLabel) scene._v3ObjectCountLabel.setVisible(false);
      if (this.isEnabled("accessibility_input_key_display") && !scene._menuActive) {
        ensureLabel(scene, "_v3InputLabel", 14, screenH() - 28).setText("INPUT DISPLAY ON").setVisible(true);
      } else if (scene._v3InputLabel) scene._v3InputLabel.setVisible(false);
      if (this.isEnabled("diagnostics_memory_estimate") && !scene._menuActive) {
        const used = window.performance?.memory?.usedJSHeapSize;
        const value = used ? `${Math.round(used / 1048576)} MB` : "browser unavailable";
        ensureLabel(scene, "_v3MemoryLabel", screenW() - 14, screenH() - 28, { align: "right" }).setOrigin(1, 0).setText(`Memory: ${value}`).setVisible(true);
      } else if (scene._v3MemoryLabel) scene._v3MemoryLabel.setVisible(false);
      if (this.isEnabled("visuals_camera_bounds_guide") && !scene._menuActive) {
        if (!scene._v3BoundsGuide) scene._v3BoundsGuide = scene.add.graphics().setScrollFactor(0).setDepth(8999);
        scene._v3BoundsGuide.clear().lineStyle(2, 0x7ad7ff, 0.7).strokeRect(4, 4, screenW() - 8, screenH() - 8).setVisible(true);
      } else if (scene._v3BoundsGuide) scene._v3BoundsGuide.setVisible(false);
      if (this.isEnabled("input_input_latency_meter") && !scene._menuActive) {
        const fps = Number(scene.game?.loop?.actualFps || 0);
        ensureLabel(scene, "_v3LatencyLabel", screenW() - 14, 78, { align: "right" }).setOrigin(1, 0).setText(`Frame: ${fps ? `${Math.round(1000 / fps)}ms` : "--"}`).setVisible(true);
      } else if (scene._v3LatencyLabel) scene._v3LatencyLabel.setVisible(false);
    },
    run(id, scene = window._wdGameScene) {
      const feature = features.find(item => item.id === id);
      if (!feature) return false;
      if (feature.kind === "toggle") {
        const enabled = this.setEnabled(id, !this.isEnabled(id));
        applyToggle(scene, id, enabled);
      } else commandHandlers[id]?.(scene);
      toast(scene, `${feature.name}: ${feature.kind === "toggle" ? (this.isEnabled(id) ? "ON" : "OFF") : "DONE"}`);
      return true;
    },
    install(scene) {
      if (scene._v3FeatureKeyHandler) return;
      features.forEach(feature => {
        if (feature.kind === "toggle" && this.isEnabled(feature.id)) applyToggle(scene, feature.id, true);
      });
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
