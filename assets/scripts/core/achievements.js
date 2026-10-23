// Lightweight local achievements for Web Dashers.
(function () {
  const KEY = "gd_achievements";
  // Main levels through 1.9, excluding Hexagon Force. Nothing from 2.0+ counts.
  const MAIN_LEVEL_IDS = [
    "level_1", "level_2", "level_3", "level_4", "level_5", "level_6",
    "level_7", "level_8", "level_9", "level_10", "level_11", "level_12",
    "level_13", "level_14", "level_15"
  ];
  const DEFINITIONS = [
    { id: "first_clear", title: "First Steps", description: "Complete your first level." },
    { id: "five_clear", title: "Getting the Hang of It", description: "Complete 5 levels." },
    { id: "ten_clear", title: "On a Roll", description: "Complete 10 levels." },
    { id: "hundred_attempts", title: "Persistence", description: "Reach 100 total attempts." },
    { id: "thousand_jumps", title: "Hop to It", description: "Make 1,000 jumps." },
    { id: "first_death", title: "Ouch", description: "Take your first tumble." },
    { id: "hundred_deaths", title: "The Floor Is Lava", description: "Crash 100 times." },
    { id: "practice_makes_perfect", title: "Practice Makes Perfect", description: "Reach 50% in Practice Mode." },
    { id: "checkpoint_hoarder", title: "Checkpoint Collector", description: "Use Practice Mode on 5 different levels." },
    { id: "level_creator", title: "Builder", description: "Create your first level." },
    { id: "five_created", title: "Architect", description: "Create 5 levels." },
    { id: "star_hunter", title: "Star Hunter", description: "Claim 10 level stars." },
    { id: "explorer", title: "Explorer", description: "Play 10 different levels." },
    { id: "main_levels_5", title: "Road Trip", description: "Beat 5 main levels." },
    { id: "main_levels_10", title: "Main Character", description: "Beat 10 main levels." },
    { id: "main_levels_all", title: "Main Event", description: "Beat every main level through 1.9, excluding Hexagon Force." }
  ];

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; }
  }
  function write(value) { localStorage.setItem(KEY, JSON.stringify(value)); }

  function unlock(id) {
    const state = read();
    if (state[id]) return false;
    state[id] = Date.now();
    write(state);
    const achievement = DEFINITIONS.find(item => item.id === id);
    if (achievement) showToast(achievement);
    return true;
  }

  function check() {
    // The gameplay scene sets this for noclip, macro, speedhack, and StartPos runs.
    // Never award achievements from a run that has been invalidated.
    if (window._gdAchievementsBlocked || window._runDisqualified) return;
    const completed = Number(window._completedLevels || 0);
    let completedSet = [];
    try { completedSet = JSON.parse(localStorage.getItem("gd_completedSet") || "[]"); } catch (_) {}
    const mainCompleted = MAIN_LEVEL_IDS.filter(id => completedSet.includes(id)).length;
    const attempts = Number(localStorage.getItem("gd_totalAttempts") || 0);
    const jumps = Number(localStorage.getItem("gd_totalJumps") || 0);
    const deaths = Number(localStorage.getItem("gd_totalDeaths") || 0);
    let created = [];
    let stars = {};
    try { created = JSON.parse(localStorage.getItem("created_levels") || "[]"); } catch (_) {}
    try { stars = JSON.parse(localStorage.getItem("wd_claimed_level_stars") || "{}"); } catch (_) {}
    let practiceLevels = 0;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("practiceBestPercent_") && Number(localStorage.getItem(key) || 0) > 0) practiceLevels++;
    }
    const starCount = Object.values(stars).filter(Boolean).length;
    if (completed >= 1) unlock("first_clear");
    if (completed >= 5) unlock("five_clear");
    if (completed >= 10) unlock("ten_clear");
    if (attempts >= 100) unlock("hundred_attempts");
    if (jumps >= 1000) unlock("thousand_jumps");
    if (deaths >= 1) unlock("first_death");
    if (deaths >= 100) unlock("hundred_deaths");
    if (practiceLevels >= 1 && Object.keys(localStorage).some(key => key.startsWith("practiceBestPercent_") && Number(localStorage.getItem(key) || 0) >= 50)) unlock("practice_makes_perfect");
    if (practiceLevels >= 5) unlock("checkpoint_hoarder");
    if (created.length >= 1) unlock("level_creator");
    if (created.length >= 5) unlock("five_created");
    if (starCount >= 10) unlock("star_hunter");
    if (completed >= 10) unlock("explorer");
    if (mainCompleted >= 5) unlock("main_levels_5");
    if (mainCompleted >= 10) unlock("main_levels_10");
    if (mainCompleted === MAIN_LEVEL_IDS.length) unlock("main_levels_all");
  }

  function showToast(item) {
    const toast = document.createElement("div");
    toast.style.cssText = "position:fixed;z-index:10000;right:22px;top:22px;background:linear-gradient(135deg,#182a55,#304e91);color:#fff;border:2px solid #ffd84d;border-radius:12px;padding:14px 18px;min-width:250px;box-shadow:0 8px 30px #0008;font:16px Arial;pointer-events:none;animation:gdAchievementIn .25s ease-out";
    toast.innerHTML = `<div style="color:#ffd84d;font-weight:bold;font-size:12px;letter-spacing:1px">ACHIEVEMENT UNLOCKED</div><div style="font-size:21px;font-weight:bold;margin-top:4px">${item.title}</div><div style="color:#dbe5ff;margin-top:3px">${item.description}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; toast.style.transition = "opacity .35s"; setTimeout(() => toast.remove(), 400); }, 3000);
  }

  function showPanel() {
    check();
    document.getElementById("gd-achievement-panel")?.remove();
    const state = read();
    const panel = document.createElement("div");
    panel.id = "gd-achievement-panel";
    panel.style.cssText = "position:fixed;inset:0;z-index:9999;background:#081126dd;display:flex;align-items:center;justify-content:center;font-family:Arial;color:#fff";
    const card = document.createElement("div");
    card.style.cssText = "width:min(560px,calc(100vw - 32px));max-height:80vh;overflow:auto;background:#172957;border:3px solid #ffd84d;border-radius:16px;padding:24px;box-shadow:0 12px 50px #0009";
    card.innerHTML = `<h2 style="margin:0 0 16px;text-align:center;color:#ffd84d">Achievements</h2>` + DEFINITIONS.map(item => {
      const earned = Boolean(state[item.id]);
      return `<div style="display:flex;gap:14px;align-items:center;padding:13px 8px;border-top:1px solid #ffffff22;opacity:${earned ? 1 : .48}"><div style="font-size:28px;width:34px;text-align:center">${earned ? "★" : "☆"}</div><div><div style="font-size:18px;font-weight:bold">${item.title}</div><div style="color:#c9d5f4">${item.description}</div></div></div>`;
    }).join("") + `<button style="display:block;margin:18px auto 0;padding:9px 24px;border:0;border-radius:8px;background:#ffd84d;font-weight:bold;cursor:pointer">Close</button>`;
    panel.appendChild(card); document.body.appendChild(panel);
    card.querySelector("button").onclick = () => panel.remove();
    panel.onclick = event => { if (event.target === panel) panel.remove(); };
  }

  window.GDAchievements = { check, showPanel, definitions: DEFINITIONS };
  const style = document.createElement("style");
  style.textContent = "@keyframes gdAchievementIn{from{transform:translateY(-12px);opacity:0}to{transform:none;opacity:1}}";
  document.head.appendChild(style);
})();
