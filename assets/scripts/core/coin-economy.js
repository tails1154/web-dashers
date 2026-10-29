(function () {
  const BALANCE_KEY = "wd_coins";
  const OWNED_KEY = "wd_coin_items";
  const OWNED_ICONS_KEY = "wd_icon_items";
  const COLLECTED_KEY = "wd_collected_coins";
  const PENDING_KEY = "wd_pending_coins";
  const USER_COIN_KEY = "wd_user_coins";
  const STARS_KEY = "wd_stars";
  const CLAIMED_STARS_KEY = "wd_claimed_level_stars";
  const UNLOCKED_LEVELS_KEY = "wd_unlocked_levels";
  const ICON_PRICES_KEY = "wd_icon_prices";
  const ICON_PRICE_VERSION_KEY = "wd_icon_prices_version";
  const ICON_PRICE_VERSION = "3";
  const COIN_COLLECTION_VERSION_KEY = "wd_coin_collection_version";
  const COIN_COLLECTION_VERSION = "4";
  const items = [
    { id: "neon", name: "Neon Runner", cost: 25, main: "00ff88", secondary: "00d9ff" },
    { id: "sunset", name: "Sunset Runner", cost: 50, main: "ff7a18", secondary: "ff2d55" },
    { id: "gold", name: "Golden Runner", cost: 100, main: "ffd700", secondary: "fff2a1" }
  ];
  // These use the same frames as the normal garage, but require coins to equip.
  // The rest of the built-in icon set stays available as before.
  const iconItems = [
    { id: "player_10", name: "Pulse Cube" },
    { id: "player_25", name: "Orbit Cube" },
    { id: "player_50", name: "Prism Cube" },
    { id: "player_100", name: "Crown Cube" }
  ];

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "");
      return value && typeof value === "object" ? value : fallback;
    } catch (_) { return fallback; }
  };
  const ensureIconPrices = () => {
    let prices = readJson(ICON_PRICES_KEY, {});
    if (localStorage.getItem(ICON_PRICE_VERSION_KEY) !== ICON_PRICE_VERSION) {
      prices = {};
      // Re-roll the tiny unlock prices on an economy update and make every
      // non-default icon locked again. The default cube is always free.
      localStorage.removeItem(OWNED_ICONS_KEY);
      localStorage.setItem(ICON_PRICE_VERSION_KEY, ICON_PRICE_VERSION);
    }
    localStorage.setItem(ICON_PRICES_KEY, JSON.stringify(prices));
    return prices;
  };
  const normalizeIcon = id => String(id || "").replace(/_001\.png$/, "");
  const isDiamondShopIcon = id => /^shop_cube_(?:cyan|magenta|gold|emerald)$/.test(normalizeIcon(id));
  const isLockableIcon = id => /^(?:player|ship|player_ball|dart|bird|robot|spider)_\d+$/.test(normalizeIcon(id)) || isDiamondShopIcon(id);
  const isDefaultIcon = id => normalizeIcon(id) === "player_01";
  const getIconPrice = id => {
    const icon = normalizeIcon(id);
    if (!isLockableIcon(icon) || isDefaultIcon(icon)) return 0;
    const prices = ensureIconPrices();
    if (![1, 2, 3].includes(Number(prices[icon]))) {
      prices[icon] = 1 + Math.floor(Math.random() * 3);
      localStorage.setItem(ICON_PRICES_KEY, JSON.stringify(prices));
    }
    return prices[icon];
  };
  ensureIconPrices();

  const readBalance = () => Math.max(0, parseInt(localStorage.getItem(BALANCE_KEY) || "0", 10) || 0);
  const writeBalance = value => {
    const balance = Math.max(0, Math.floor(Number(value) || 0));
    localStorage.setItem(BALANCE_KEY, String(balance));
    return balance;
  };
  const readOwned = () => {
    try { return new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || "[]")); }
    catch (_) { return new Set(); }
  };
  const readOwnedIcons = () => {
    try { return new Set(JSON.parse(localStorage.getItem(OWNED_ICONS_KEY) || "[]")); }
    catch (_) { return new Set(); }
  };
  const readUnlockedLevels = () => new Set(Object.keys(readJson(UNLOCKED_LEVELS_KEY, {})));
  const readCollected = () => {
    try { return JSON.parse(localStorage.getItem(COLLECTED_KEY) || "{}"); }
    catch (_) { return {}; }
  };
  const readPending = () => {
    try {
      const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "");
      return value && typeof value === "object" ? value : {};
    } catch (_) { return {}; }
  };
  const readNumber = key => Math.max(0, parseInt(localStorage.getItem(key) || "0", 10) || 0);
  if (localStorage.getItem(COIN_COLLECTION_VERSION_KEY) !== COIN_COLLECTION_VERSION) {
    localStorage.setItem(BALANCE_KEY, "0");
    localStorage.setItem(USER_COIN_KEY, "0");
    localStorage.removeItem(COLLECTED_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    localStorage.setItem(COIN_COLLECTION_VERSION_KEY, COIN_COLLECTION_VERSION);
  }
  const notify = scene => {
    if (scene && typeof scene._refreshCoinHud === "function") scene._refreshCoinHud();
    if (scene && typeof scene._refreshIconCoinHud === "function") scene._refreshIconCoinHud();
  };
  const getCheatFlags = scene => {
    const flags = [];
    if (window.noClip) flags.push("noclip");
    // The normal speed setting is represented by 1 in the game/mod state.
    // Only an explicitly different value should disable coin collection.
    const speedhackValue = window.speedhack ?? window.speedHack ?? window.speedHackEnabled;
    const numericSpeed = Number(speedhackValue);
    if (speedhackValue !== undefined && speedhackValue !== null && Number.isFinite(numericSpeed) && numericSpeed !== 1) flags.push("speedhack");
    // A loaded/idle macro bot (or a recording) is not a hack. Only playback
    // injects inputs and should disable rewards.
    if (window.bot || window.botMode || scene?._macroBot?.playing === true) flags.push("bot");
    return [...new Set(flags)];
  };

  window.WDCoinEconomy = {
    items,
    iconItems,
    getBalance: readBalance,
    prepareIconPrices(ids) {
      const prices = ensureIconPrices();
      for (const id of ids || []) {
        const icon = normalizeIcon(id);
        if (!isLockableIcon(icon) || isDefaultIcon(icon)) continue;
        if (![1, 2, 3].includes(Number(prices[icon]))) {
          prices[icon] = 1 + Math.floor(Math.random() * 3);
        }
      }
      localStorage.setItem(ICON_PRICES_KEY, JSON.stringify(prices));
    },
    add(amount, scene) { const value = writeBalance(readBalance() + (Number(amount) || 0)); notify(scene); return value; },
    getDiamonds() { return Math.max(0, parseInt(localStorage.getItem("wd_diamonds") || "0", 10) || 0); },
    isDiamondShopIcon,
    spendDiamonds(amount, scene) {
      amount = Math.max(0, Math.floor(Number(amount) || 0));
      const balance = this.getDiamonds();
      if (balance < amount) return false;
      localStorage.setItem("wd_diamonds", String(balance - amount));
      notify(scene);
      return true;
    },
    getUserCoinCount() { return Math.max(0, parseInt(localStorage.getItem(USER_COIN_KEY) || "0", 10) || 0); },
    getStars() { return readNumber(STARS_KEY); },
    awardLevelStars(levelId, amount, scene) {
      const level = String(levelId || "unknown");
      const reward = Math.max(0, Math.min(30, Math.floor(Number(amount) || 0)));
      if (!reward || getCheatFlags(scene).length) return 0;
      const claimed = readJson(CLAIMED_STARS_KEY, {});
      if (claimed[level]) return 0;
      claimed[level] = reward;
      localStorage.setItem(CLAIMED_STARS_KEY, JSON.stringify(claimed));
      const total = readNumber(STARS_KEY) + reward;
      localStorage.setItem(STARS_KEY, String(total));
      notify(scene);
      return reward;
    },
    getCheatFlags,
    discardPending(levelId) {
      const level = String(levelId || "unknown");
      const pending = readPending();
      if (!pending[level]) return false;
      delete pending[level];
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      return true;
    },
    collect(levelId, coinId, scene, amount = 1, kind = "level") {
      if (getCheatFlags(scene).length) return false;
      const level = String(levelId || "unknown");
      const coin = String(coinId ?? "");
      if (!coin) return false;
      const collected = readCollected();
      if (!Array.isArray(collected[level])) collected[level] = [];
      if (collected[level].includes(coin)) return false;
      const pending = readPending();
      if (!Array.isArray(pending[level])) pending[level] = [];
      if (pending[level].some(entry => entry.id === coin)) return false;
      if (collected[level].length + pending[level].length >= 3) return false;
      pending[level].push({ id: coin, amount: Math.max(1, Math.floor(Number(amount) || 1)), kind });
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      return true;
    },
    commitLevel(levelId, scene) {
      const level = String(levelId || "unknown");
      const pending = readPending();
      const entries = Array.isArray(pending[level]) ? pending[level] : [];
      if (!entries.length) return 0;
      // Cheats can be enabled after collecting a coin. Never pay those pending
      // rewards if a disallowed tool is active when the level is completed.
      if (getCheatFlags(scene).length) {
        delete pending[level];
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        return 0;
      }
      const collected = readCollected();
      if (!Array.isArray(collected[level])) collected[level] = [];
      let reward = 0;
      let userCoins = 0;
      for (const entry of entries) {
        const id = String(entry.id || "");
        if (!id || collected[level].includes(id)) continue;
        collected[level].push(id);
        reward += Math.max(1, Math.floor(Number(entry.amount) || 1));
        if (entry.kind === "user") userCoins++;
      }
      delete pending[level];
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      if (!reward) return 0;
      localStorage.setItem(COLLECTED_KEY, JSON.stringify(collected));
      this.add(reward, scene);
      localStorage.setItem(USER_COIN_KEY, String(this.getUserCoinCount() + userCoins));
      return reward;
    },
    spend(amount, scene) {
      amount = Math.max(0, Math.floor(Number(amount) || 0));
      if (readBalance() < amount) return false;
      writeBalance(readBalance() - amount); notify(scene); return true;
    },
    owns(id) { return readOwned().has(id); },
    ownsIcon(id) {
      const icon = normalizeIcon(id);
      if (!isLockableIcon(icon) || isDefaultIcon(icon)) return true;
      return readOwnedIcons().has(icon);
    },
    unlockIcon(id, scene) {
      const iconId = normalizeIcon(id);
      if (!isLockableIcon(iconId) || isDefaultIcon(iconId) || this.ownsIcon(iconId)) return false;
      const owned = readOwnedIcons();
      owned.add(iconId);
      localStorage.setItem(OWNED_ICONS_KEY, JSON.stringify([...owned]));
      notify(scene);
      return true;
    },
    buyIcon(id, scene) {
      const iconId = normalizeIcon(id);
      if (!isLockableIcon(iconId) || isDefaultIcon(iconId) || this.ownsIcon(iconId)) return false;
      if (!this.spend(getIconPrice(iconId), scene)) return false;
      const owned = readOwnedIcons(); owned.add(iconId);
      localStorage.setItem(OWNED_ICONS_KEY, JSON.stringify([...owned]));
      return true;
    },
    buyDiamondIcon(id, cost, scene) {
      const iconId = normalizeIcon(id);
      const price = Math.max(0, Math.floor(Number(cost) || 0));
      if (!isLockableIcon(iconId) || isDefaultIcon(iconId) || this.ownsIcon(iconId) || !this.spendDiamonds(price, scene)) return false;
      const owned = readOwnedIcons();
      owned.add(iconId);
      localStorage.setItem(OWNED_ICONS_KEY, JSON.stringify([...owned]));
      return true;
    },
    ownsLevel(id) {
      return String(id || "") !== "level_14" || readUnlockedLevels().has("level_14");
    },
    buyLevel(id, scene) {
      if (String(id || "") !== "level_14" || this.ownsLevel(id) || !this.spend(5, scene)) return false;
      const unlocked = readJson(UNLOCKED_LEVELS_KEY, {});
      unlocked.level_14 = true;
      localStorage.setItem(UNLOCKED_LEVELS_KEY, JSON.stringify(unlocked));
      return true;
    },
    buy(id, scene) {
      const item = items.find(entry => entry.id === id);
      if (!item || this.owns(id)) return false;
      if (!this.spend(item.cost, scene)) return false;
      const owned = readOwned(); owned.add(id);
      localStorage.setItem(OWNED_KEY, JSON.stringify([...owned]));
      localStorage.setItem("iconMainColor", item.main);
      localStorage.setItem("iconSecondaryColor", item.secondary);
      window.mainColor = parseInt(item.main, 16);
      window.secondaryColor = parseInt(item.secondary, 16);
      return true;
    }
  };

  window.WDOpenCoinShop = function (scene) {
    if (!scene || scene._coinShopOverlay) return;
    const sw = window.screenWidth || scene.scale.width;
    const sh = window.screenHeight || scene.scale.height;
    const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(500);
    const shade = scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0x000000, 0.78).setInteractive();
    const panel = scene.add.rectangle(sw / 2, sh / 2, 1040, 520, 0x20243a, 1).setStrokeStyle(4, 0x8de8ff, 1);
    const title = scene.add.text(sw / 2, 88, "COIN SHOP", { fontFamily: "Arial Black", fontSize: "38px", color: "#ffe45c" }).setOrigin(0.5);
    const balance = scene.add.text(sw / 2, 130, "Coins: " + WDCoinEconomy.getBalance() + "  |  User coins: " + WDCoinEconomy.getUserCoinCount(), { fontFamily: "Arial", fontSize: "24px", color: "#ffffff" }).setOrigin(0.5);
    overlay.add([shade, panel, title, balance]);
    const close = () => { overlay.destroy(true); scene._coinShopOverlay = null; };
    const closeBtn = scene.add.text(sw / 2, 600, "CLOSE", { fontFamily: "Arial Black", fontSize: "26px", color: "#ffffff", backgroundColor: "#586080", padding: { x: 22, y: 10 } }).setOrigin(0.5).setInteractive();
    closeBtn.on("pointerup", close); overlay.add(closeBtn);
    const colorHeader = scene.add.text(sw / 2 - 260, 175, "COLOR THEMES", { fontFamily: "Arial Black", fontSize: "20px", color: "#8de8ff" }).setOrigin(0.5);
    const iconHeader = scene.add.text(sw / 2 + 260, 175, "ICON UNLOCKS", { fontFamily: "Arial Black", fontSize: "20px", color: "#8de8ff" }).setOrigin(0.5);
    overlay.add([colorHeader, iconHeader]);
    items.forEach((item, index) => {
      const y = 215 + index * 58;
      const owned = WDCoinEconomy.owns(item.id);
      const button = scene.add.text(sw / 2 - 260, y, owned ? `${item.name} — OWNED` : `${item.name} — ${item.cost} coins`, { fontFamily: "Arial", fontSize: "18px", color: owned ? "#88ffbb" : "#ffffff", backgroundColor: owned ? "#304c42" : "#39415e", padding: { x: 12, y: 9 }, fixedWidth: 400, align: "center" }).setOrigin(0.5);
      if (!owned) button.setInteractive();
      button.on("pointerup", () => {
        if (WDCoinEconomy.buy(item.id, scene)) {
          balance.setText("Coins: " + WDCoinEconomy.getBalance() + "  |  User coins: " + WDCoinEconomy.getUserCoinCount());
          button.setText(`${item.name}  —  OWNED`).setColor("#88ffbb").setBackgroundColor("#304c42").disableInteractive();
        }
      });
      overlay.add(button);
    });
    iconItems.forEach((item, index) => {
      const y = 215 + index * 58;
      const owned = WDCoinEconomy.ownsIcon(item.id);
      const price = getIconPrice(item.id);
      const button = scene.add.text(sw / 2 + 260, y, owned ? `${item.name} — OWNED` : `${item.name} — ${price} coin${price === 1 ? "" : "s"}`, { fontFamily: "Arial", fontSize: "18px", color: owned ? "#88ffbb" : "#ffffff", backgroundColor: owned ? "#304c42" : "#39415e", padding: { x: 12, y: 9 }, fixedWidth: 400, align: "center" }).setOrigin(0.5);
      if (!owned) button.setInteractive();
      button.on("pointerup", () => {
        if (WDCoinEconomy.buyIcon(item.id, scene)) {
          balance.setText("Coins: " + WDCoinEconomy.getBalance() + "  |  User coins: " + WDCoinEconomy.getUserCoinCount());
          button.setText(`${item.name} — OWNED`).setColor("#88ffbb").setBackgroundColor("#304c42").disableInteractive();
        }
      });
      overlay.add(button);
    });
    scene._coinShopOverlay = overlay;
  };

  window.WDOpenIconPurchase = function (scene, iconId, onBought) {
    if (!scene || scene._iconPurchaseOverlay || WDCoinEconomy.ownsIcon(iconId)) return;
    const sw = window.screenWidth || scene.scale.width;
    const sh = window.screenHeight || scene.scale.height;
    const price = getIconPrice(iconId);
    const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(600);
    const shade = scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0x000000, 0.8).setInteractive();
    const panel = scene.add.rectangle(sw / 2, sh / 2, 430, 300, 0x20243a, 1).setStrokeStyle(4, 0x8de8ff, 1);
    const title = scene.add.text(sw / 2, 205, "LOCKED ICON", { fontFamily: "Arial Black", fontSize: "28px", color: "#ffe45c" }).setOrigin(0.5);
    const label = scene.add.text(sw / 2, 255, `${iconId.replace("player_", "Icon ")} costs ${price} coin${price === 1 ? "" : "s"}`, { fontFamily: "Arial", fontSize: "19px", color: "#ffffff" }).setOrigin(0.5);
    const buy = scene.add.text(sw / 2 - 85, 345, "UNLOCK", { fontFamily: "Arial Black", fontSize: "20px", color: "#ffffff", backgroundColor: "#3c8062", padding: { x: 16, y: 10 } }).setOrigin(0.5).setInteractive();
    const cancel = scene.add.text(sw / 2 + 85, 345, "CANCEL", { fontFamily: "Arial Black", fontSize: "20px", color: "#ffffff", backgroundColor: "#586080", padding: { x: 16, y: 10 } }).setOrigin(0.5).setInteractive();
    overlay.add([shade, panel, title, label, buy, cancel]);
    const close = () => { overlay.destroy(true); scene._iconPurchaseOverlay = null; };
    cancel.on("pointerup", close);
    buy.on("pointerup", () => {
      if (WDCoinEconomy.buyIcon(iconId, scene)) { close(); if (onBought) onBought(); }
    });
    scene._iconPurchaseOverlay = overlay;
  };

  window.WDOpenLevelPurchase = function (scene, levelId, levelName, onBought) {
    if (!scene || WDCoinEconomy.ownsLevel(levelId) || scene._levelPurchaseOverlay) return;
    const sw = window.screenWidth || scene.scale.width;
    const sh = window.screenHeight || scene.scale.height;
    const overlay = scene.add.container(0, 0).setScrollFactor(0).setDepth(600);
    const shade = scene.add.rectangle(sw / 2, sh / 2, sw, sh, 0x000000, 0.8).setInteractive();
    const panel = scene.add.rectangle(sw / 2, sh / 2, 450, 300, 0x20243a, 1).setStrokeStyle(4, 0x8de8ff, 1);
    const title = scene.add.text(sw / 2, 205, "LEVEL LOCKED", { fontFamily: "Arial Black", fontSize: "28px", color: "#ffe45c" }).setOrigin(0.5);
    const label = scene.add.text(sw / 2, 255, `${levelName} requires 5 coins`, { fontFamily: "Arial", fontSize: "20px", color: "#ffffff" }).setOrigin(0.5);
    const buy = scene.add.text(sw / 2 - 85, 345, "UNLOCK", { fontFamily: "Arial Black", fontSize: "20px", color: "#ffffff", backgroundColor: "#3c8062", padding: { x: 16, y: 10 } }).setOrigin(0.5).setInteractive();
    const cancel = scene.add.text(sw / 2 + 85, 345, "CANCEL", { fontFamily: "Arial Black", fontSize: "20px", color: "#ffffff", backgroundColor: "#586080", padding: { x: 16, y: 10 } }).setOrigin(0.5).setInteractive();
    overlay.add([shade, panel, title, label, buy, cancel]);
    const close = () => { overlay.destroy(true); scene._levelPurchaseOverlay = null; };
    cancel.on("pointerup", close);
    buy.on("pointerup", () => {
      if (WDCoinEconomy.buyLevel(levelId, scene)) { close(); if (onBought) onBought(); }
    });
    scene._levelPurchaseOverlay = overlay;
  };
}());
