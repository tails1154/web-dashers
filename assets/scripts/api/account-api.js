window.AccountAPI = {
  currentUser: null,
  _leaderboardSyncTimer: null,
  _leaderboardSyncInFlight: null,

  isModerator() {
    const user = this.currentUser;
    return Boolean(user && (
      user.username === 'tails1154' ||
      user.role === 'moderator' ||
      user.role === 'admin' ||
      user.moderator === true
    ));
  },

  _url(path) {
    return `${window._apiBase}${path}`;
  },

  oidcLogin(returnTo = window.location.href) {
    const safeReturn = String(returnTo || window.location.href);
    window.location.assign(this._url(`?oidc=login&return=${encodeURIComponent(safeReturn)}`));
  },

  async checkSession() {
    try {
      const res = await fetch(this._url('/api/auth/me'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
      } else {
        this.currentUser = null;
        this._stopLeaderboardStatsSync();
      }
    } catch {
      this.currentUser = null;
      this._stopLeaderboardStatsSync();
    }
    return this.currentUser;
  },

  async login(username, password) {
    const res = await fetch(this._url('/api/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    this.currentUser = data.user;
    return data.user;
  },

  async register(username, email, password) {
    const res = await fetch(this._url('/api/auth/register'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: email || undefined, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    this.currentUser = data.user;
    return data.user;
  },

  async logout() {
    const res = await fetch(this._url('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Logout failed');
    this.currentUser = null;
    this._stopLeaderboardStatsSync();
  },

  async logoutAndRefresh() {
    if (!this.currentUser && !(await this.checkSession())) {
      this.clearClientData();
      window.location.reload();
      return;
    }
    // Keep the local copy intact if either cloud save or server logout fails.
    await this.setCloudSave(this.collectLocalData());
    await this.logout();
    this.clearClientData();
    window.location.reload();
  },

  async signInPrompt() {
    if (this.currentUser || await this.checkSession()) return this.currentUser;
    if (this._accountModalPromise) return this._accountModalPromise;
    this._accountModalPromise = new Promise(resolve => {
      const shade = document.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.72);font-family:Arial,sans-serif;color:#fff;';
      const dialog = document.createElement('form');
      dialog.style.cssText = 'width:min(390px,calc(100vw - 32px));padding:26px;border:3px solid #fff;border-radius:16px;background:linear-gradient(#303030,#111);box-shadow:0 8px 0 #000,0 18px 50px #000b;';
      dialog.innerHTML = '<h2 style="margin:0 0 8px;text-align:center;color:#ffd84d;font-size:28px">Web Dashers Account</h2>' +
        '<p style="margin:0 0 18px;text-align:center;color:#ddd;font-size:14px">Use your Web Dashers account to save progress and upload levels.</p>' +
        '<label style="display:block;margin:10px 0 5px;font-weight:bold">Username</label>' +
        '<input name="username" autocomplete="username" required maxlength="24" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px">' +
        '<label style="display:block;margin:10px 0 5px;font-weight:bold">Email <span style="font-weight:normal;color:#aaa">(only needed when creating)</span></label>' +
        '<input name="email" type="email" autocomplete="email" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px">' +
        '<label style="display:block;margin:10px 0 5px;font-weight:bold">Password</label>' +
        '<input name="password" type="password" autocomplete="current-password" required minlength="8" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px">' +
        '<p data-error style="min-height:18px;margin:10px 0;color:#ff8d8d;font-size:13px"></p>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button type="button" data-action="login" style="padding:10px 16px;border:0;border-radius:8px;background:#61d66f;font-weight:bold;cursor:pointer">Sign In</button>' +
        '<button type="button" data-action="register" style="padding:10px 16px;border:0;border-radius:8px;background:#ffd84d;font-weight:bold;cursor:pointer">Create Account</button>' +
        '<button type="button" data-action="cancel" style="padding:10px 16px;border:0;border-radius:8px;background:#999;font-weight:bold;cursor:pointer">Cancel</button></div>';
      shade.appendChild(dialog);
      document.body.appendChild(shade);
      // Phaser listens for keyboard events on window. Stop those events at
      // document after the input has handled them, so typing still works but
      // gameplay/editor shortcuts cannot consume the keystrokes.
      const keyboardGuard = event => {
        if (shade.contains(event.target)) event.stopPropagation();
      };
      document.addEventListener('keydown', keyboardGuard);
      document.addEventListener('keyup', keyboardGuard);
      document.addEventListener('keypress', keyboardGuard);
      const finish = user => {
        document.removeEventListener('keydown', keyboardGuard);
        document.removeEventListener('keyup', keyboardGuard);
        document.removeEventListener('keypress', keyboardGuard);
        shade.remove();
        this._accountModalPromise = null;
        resolve(user || null);
      };
      const errorText = dialog.querySelector('[data-error]');
      const action = async mode => {
        const form = new FormData(dialog);
        const username = String(form.get('username') || '').trim();
        const password = String(form.get('password') || '');
        const email = String(form.get('email') || '').trim();
        errorText.textContent = '';
        if (!username || password.length < 8) {
          errorText.textContent = 'Enter a username and a password of at least 8 characters.';
          return;
        }
        dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
        try {
          const user = mode === 'register'
            ? await this.register(username, email, password)
            : await this.login(username, password);
          finish(user);
        } catch (error) {
          errorText.textContent = error.message || 'Account request failed.';
          dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
        }
      };
      dialog.querySelector('[data-action="login"]').addEventListener('click', () => action('login'));
      dialog.querySelector('[data-action="register"]').addEventListener('click', () => action('register'));
      dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => finish(null));
      shade.addEventListener('click', event => { if (event.target === shade) finish(null); });
      dialog.addEventListener('submit', event => { event.preventDefault(); action('login'); });
      dialog.querySelector('[name="username"]').focus();
    });
    return this._accountModalPromise;
  },

  async ensureAuthenticated() {
    return this.signInPrompt();
  },

  async uploadLevel(level) {
    const user = await this.ensureAuthenticated();
    if (!user) throw new Error('Login required to upload levels');
    const res = await fetch(window._gdProxyUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(level),
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const error = new Error(data.error || `Upload failed (HTTP ${res.status})`);
      error.response = data;
      error.status = res.status;
      throw error;
    }
    return data;
  },

  async deleteLevel(id) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required to delete levels');
    const res = await fetch(`${window._gdProxyUrl}?action=delete&id=${encodeURIComponent(id)}`, {
      method: 'POST', credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    return data;
  },

  async getLevelComments(id) {
    const res = await fetch(`${window._gdProxyUrl}?action=comments&id=${encodeURIComponent(id)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load comments');
    return Array.isArray(data.comments) ? data.comments : [];
  },

  async addLevelComment(id, text) {
    const user = await this.ensureAuthenticated();
    if (!user) throw new Error('Login required to comment');
    const res = await fetch(`${window._gdProxyUrl}?action=comments&id=${encodeURIComponent(id)}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text || '').slice(0, 500) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add comment');
    return data.comment;
  },

  async deleteLevelComment(id, commentId) {
    const user = await this.ensureAuthenticated();
    if (!user) throw new Error('Login required to delete comments');
    const res = await fetch(`${window._gdProxyUrl}?action=comments&id=${encodeURIComponent(id)}`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', comment_id: String(commentId || '') }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete comment');
    return data;
  },

  async getDailyLevel() {
    const res = await fetch(`${window._gdProxyUrl}?action=daily`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Daily Level');
    return data;
  },

  async setDailyLevel(levelId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=daily`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level_id: levelId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not set Daily Level');
    return data;
  },

  async getWeeklyLevel() {
    const res = await fetch(`${window._gdProxyUrl}?action=weekly`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Weekly Level');
    return data;
  },

  async setWeeklyLevel(levelId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=weekly`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level_id: levelId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not set Weekly Level');
    return data;
  },

  async getEventLevel() {
    const res = await fetch(`${window._gdProxyUrl}?action=event`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Event Level');
    return data;
  },

  async setEventLevel(levelId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=event`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level_id: levelId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not set Event Level');
    return data;
  },

  async getGauntlets() {
    const res = await fetch(`${window._gdProxyUrl}?action=gauntlets`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Gauntlets');
    return data;
  },

  async setGauntlet(name, levelIds) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=gauntlets`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, level_ids: levelIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not set Gauntlet');
    return data;
  },

  async deleteGauntlet(gauntletId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=gauntlets`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_id: String(gauntletId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete Gauntlet');
    return data;
  },

  async claimGauntlet(gauntletId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=gauntlets`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: String(gauntletId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not claim Gauntlet reward');
    return data;
  },

  async getLists(listId = '') {
    const suffix = listId ? `&id=${encodeURIComponent(String(listId))}` : '';
    const res = await fetch(`${window._gdProxyUrl}?action=lists${suffix}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Lists');
    return data;
  },

  async createList(name, description, levelIds) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=lists`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, level_ids: levelIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create List');
    return data;
  },

  async addLevelToList(listId, levelId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=lists`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_id: String(listId || ''), add_level_id: String(levelId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add level to List');
    return data;
  },

  async deleteList(listId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=lists`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_id: String(listId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete List');
    return data;
  },

  async getMapPacks() {
    const res = await fetch(`${window._gdProxyUrl}?action=map_packs`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load Map Packs');
    return data;
  },

  async createMapPack(name, description, levelIds) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=map_packs`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, level_ids: levelIds })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not create Map Pack');
    return data;
  },

  async deleteMapPack(packId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=map_packs`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_id: String(packId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete Map Pack');
    return data;
  },

  async getLeaderboard(category = 'stars') {
    const allowed = ['stars', 'diamonds', 'coins'];
    const selected = allowed.includes(category) ? category : 'stars';
    const res = await fetch(`${window._gdProxyUrl}?action=leaderboard&category=${selected}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load leaderboard');
    return data;
  },

  async recordLevelDownload(levelId) {
    if (!this.currentUser && !(await this.ensureAuthenticated())) {
      throw new Error('Login required to download levels');
    }
    const res = await fetch(`${window._gdProxyUrl}?action=download`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(levelId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not record download');
    return data;
  },

  async toggleLevelLike(levelId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required to like levels');
    const res = await fetch(`${window._gdProxyUrl}?action=like`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(levelId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update like');
    return data;
  },

  async setLevelRating(levelId, rating) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required to rate levels');
    const selected = rating === 'dislike' ? 'dislike' : 'like';
    const res = await fetch(`${window._gdProxyUrl}?action=like`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(levelId || ''), rating: selected })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update rating');
    return data;
  },

  async getQuests() {
    const res = await fetch(`${window._gdProxyUrl}?action=quests`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load quests');
    return data;
  },

  async claimQuest(questId) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=quests`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quest_id: String(questId || '') })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not claim quest');
    return data;
  },

  async claimDailyReward(levelId, clean = false, practice = false) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=daily&claim=1`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level_id: levelId, clean: !!clean, practice: !!practice })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not claim Daily reward');
    return data;
  },

  async uploadLevelPrompt(level) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required to upload levels');
    return new Promise(resolve => {
      const shade = document.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.72);font-family:Arial,sans-serif;color:#fff;';
      const dialog = document.createElement('form');
      dialog.style.cssText = 'width:min(500px,calc(100vw - 32px));padding:26px;border:3px solid #fff;border-radius:16px;background:linear-gradient(#303030,#111);box-shadow:0 8px 0 #000,0 18px 50px #000b;';
      const current = value => String(value ?? '').replace(/\r|\n/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      dialog.innerHTML = '<h2 style="margin:0 0 8px;text-align:center;color:#ffd84d;font-size:28px">Upload Level</h2>' +
        '<p style="margin:0 0 16px;text-align:center;color:#ddd;font-size:14px">Review the details before publishing this level.</p>' +
        '<label style="display:block;margin:10px 0 5px;font-weight:bold">Name</label>' +
        `<input name="name" required maxlength="40" value="${current(level?.name || level?.levelName)}" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px">` +
        '<label style="display:block;margin:10px 0 5px;font-weight:bold">Description</label>' +
        `<textarea name="description" maxlength="500" rows="4" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font:16px Arial;resize:vertical">${current(level?.description)}</textarea>` +
        '<label style="display:flex;gap:8px;align-items:center;margin:16px 0 8px;font-weight:bold"><input name="rating_requested" type="checkbox"> Request a rating</label>' +
        '<label style="display:block;margin:8px 0 5px">Suggested stars (optional)</label>' +
        '<select name="requested_stars" style="padding:9px;border-radius:7px;font-size:16px"><option value="0">No suggestion</option><option value="1">1 star</option><option value="2">2 stars</option><option value="3">3 stars</option><option value="4">4 stars</option><option value="5">5 stars</option><option value="6">6 stars</option><option value="7">7 stars</option><option value="8">8 stars</option><option value="9">9 stars</option><option value="10">10 stars</option></select>' +
        '<p data-error style="min-height:18px;margin:10px 0;color:#ff8d8d;font-size:13px"></p>' +
        '<div style="display:flex;gap:8px;justify-content:center"><button type="submit" style="padding:10px 16px;border:0;border-radius:8px;background:#61d66f;font-weight:bold;cursor:pointer">Upload</button><button type="button" data-cancel style="padding:10px 16px;border:0;border-radius:8px;background:#999;font-weight:bold;cursor:pointer">Cancel</button></div>';
      shade.appendChild(dialog);
      document.body.appendChild(shade);
      const keyboardGuard = event => { if (shade.contains(event.target)) event.stopPropagation(); };
      document.addEventListener('keydown', keyboardGuard);
      document.addEventListener('keyup', keyboardGuard);
      document.addEventListener('keypress', keyboardGuard);
      const finish = value => {
        document.removeEventListener('keydown', keyboardGuard);
        document.removeEventListener('keyup', keyboardGuard);
        document.removeEventListener('keypress', keyboardGuard);
        shade.remove();
        resolve(value);
      };
      dialog.addEventListener('submit', event => {
        event.preventDefault();
        const form = new FormData(dialog);
        const name = String(form.get('name') || '').trim();
        if (!name) { dialog.querySelector('[data-error]').textContent = 'A level name is required.'; return; }
        finish({
          name,
          description: String(form.get('description') || '').slice(0, 500),
          rating_requested: form.get('rating_requested') === 'on',
          requested_stars: Number(form.get('requested_stars') || 0),
        });
      });
      dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      shade.addEventListener('click', event => { if (event.target === shade) finish(null); });
      dialog.querySelector('[name="name"]').focus();
    });
  },

  async moderateLevel(id, difficulty, featured, star_reward = 0, stars = 0, verified = false, verification_hacks = false, verification_start_pos = false) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=moderate`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, difficulty, featured, star_reward, stars, verified, verification_hacks, verification_start_pos })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Moderation failed');
    return data;
  },

  async getLevelForModeration(id) {
    const res = await fetch(`${window._gdProxyUrl}?action=get&id=${encodeURIComponent(id)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Level lookup failed');
    return data;
  },

  async addLevelToMap(level_id, world_id) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=map`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level_id, world_id })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add level to Map');
    return data;
  },

  async rateLevel(id, rating) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Sign in to rate levels');
    const res = await fetch(`${window._gdProxyUrl}?action=rate`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rating, suggested_stars: rating })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Rating failed');
    return data;
  },

  async ratePrompt(levelId, currentRating = 0) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Sign in to rate levels');
    return new Promise(resolve => {
      const shade = document.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.76);font-family:Arial,sans-serif;color:#fff;';
      const dialog = document.createElement('form');
      dialog.style.cssText = 'width:min(400px,calc(100vw - 32px));padding:26px;border:3px solid #ffd84d;border-radius:18px;background:linear-gradient(145deg,#30395c,#111522);box-shadow:0 10px 0 #000,0 20px 55px #000b;text-align:center;';
      dialog.innerHTML = '<h2 style="margin:0 0 8px;color:#ffd84d;font-size:28px">Suggest Stars</h2><p style="margin:0 0 18px;color:#ddd">Only moderators can set the official stars. Your suggestion will be visible in Moderator Tools.</p><select name="rating" style="padding:10px;border-radius:8px;font-size:18px;width:100%">' + Array.from({length: 10}, (_, i) => `<option value="${i + 1}"${Number(currentRating) === i + 1 ? ' selected' : ''}>${i + 1} star${i ? 's' : ''}</option>`).join('') + '</select><p data-error style="min-height:18px;color:#ff8d8d;font-size:13px"></p><div style="display:flex;gap:8px;justify-content:center"><button type="submit" style="padding:10px 18px;border:0;border-radius:8px;background:#ffd84d;font-weight:bold">Submit Suggestion</button><button type="button" data-cancel style="padding:10px 18px;border:0;border-radius:8px;background:#999;font-weight:bold">Cancel</button></div>';
      shade.appendChild(dialog); document.body.appendChild(shade);
      const guard = event => { if (shade.contains(event.target)) event.stopPropagation(); };
      ['keydown', 'keyup', 'keypress'].forEach(type => document.addEventListener(type, guard));
      const finish = value => { ['keydown', 'keyup', 'keypress'].forEach(type => document.removeEventListener(type, guard)); shade.remove(); resolve(value); };
      dialog.addEventListener('submit', async event => { event.preventDefault(); try { finish(await this.rateLevel(levelId, Number(new FormData(dialog).get('rating')))); } catch (error) { dialog.querySelector('[data-error]').textContent = error.message || 'Rating failed'; } });
      dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      shade.addEventListener('click', event => { if (event.target === shade) finish(null); });
    });
  },

  async searchProfile(username) {
    const query = String(username || '').trim().toLowerCase();
    const res = await fetch(`${window._gdProxyUrl}?action=profile&username=${encodeURIComponent(query)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Profile not found');
    return data.profile;
  },

  async updateProfile(fields = {}) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=profile`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: String(fields.display_name || '').slice(0, 32), bio: String(fields.bio || '').slice(0, 240) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update profile');
    return data;
  },

  async getFriends() {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=friends`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load friends');
    return data;
  },

  async updateFriend(username, action = 'request') {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=friends`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, action })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update friend list');
    return data;
  },

  async getMessages(username = '') {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const suffix = username ? `&with=${encodeURIComponent(username)}` : '';
    const res = await fetch(`${window._gdProxyUrl}?action=messages${suffix}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load messages');
    return data;
  },

  async sendMessage(username, text) {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    const res = await fetch(`${window._gdProxyUrl}?action=messages`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: username, text: String(text || '').slice(0, 1000) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not send message');
    return data;
  },

  async profilePrompt() {
    return new Promise(resolve => {
      const shade = document.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.72);font-family:Arial,sans-serif;color:#fff;';
      const dialog = document.createElement('form');
      dialog.style.cssText = 'width:min(390px,calc(100vw - 32px));padding:26px;border:3px solid #fff;border-radius:16px;background:linear-gradient(#303030,#111);box-shadow:0 8px 0 #000,0 18px 50px #000b;';
      dialog.innerHTML = '<h2 style="margin:0 0 16px;text-align:center;color:#ffd84d;font-size:28px">Find Profile</h2><input name="username" required maxlength="24" placeholder="Username" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px"><p data-error style="min-height:18px;margin:10px 0;color:#ff8d8d;font-size:13px"></p><div style="display:flex;gap:8px;justify-content:center"><button type="submit" style="padding:10px 16px;border:0;border-radius:8px;background:#ffd84d;font-weight:bold;cursor:pointer">Search</button><button type="button" data-cancel style="padding:10px 16px;border:0;border-radius:8px;background:#999;font-weight:bold;cursor:pointer">Cancel</button></div>';
      shade.appendChild(dialog); document.body.appendChild(shade);
      const guard = event => { if (shade.contains(event.target)) event.stopPropagation(); };
      ['keydown', 'keyup', 'keypress'].forEach(type => document.addEventListener(type, guard));
      const finish = value => { ['keydown', 'keyup', 'keypress'].forEach(type => document.removeEventListener(type, guard)); shade.remove(); resolve(value); };
      dialog.addEventListener('submit', async event => { event.preventDefault(); const input = dialog.querySelector('[name="username"]'); try { const profile = await this.searchProfile(input.value); finish(profile); } catch (error) { dialog.querySelector('[data-error]').textContent = error.message || 'Profile not found'; } });
      dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      shade.addEventListener('click', event => { if (event.target === shade) finish(null); });
      dialog.querySelector('[name="username"]').focus();
    });
  },

  _socialForm(title, fields, submitLabel) {
    return new Promise(resolve => {
      const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
      const shade = document.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;z-index:100001;display:grid;place-items:center;background:rgba(0,0,0,.78);font-family:Arial,sans-serif;color:#fff;';
      const form = document.createElement('form');
      form.style.cssText = 'width:min(430px,calc(100vw - 32px));padding:26px;border:3px solid #ffd84d;border-radius:16px;background:linear-gradient(145deg,#30395c,#111522);box-shadow:0 10px 0 #000,0 20px 55px #000b;';
      form.innerHTML = `<h2 style="margin:0 0 18px;text-align:center;color:#ffd84d">${escape(title)}</h2>${fields.map(field => `<label style="display:block;margin:10px 0 5px;font-weight:bold">${escape(field.label)}</label>${field.multiline ? `<textarea name="${escape(field.name)}" maxlength="${field.maxlength || 1000}" rows="4" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font:16px Arial;resize:vertical">${escape(field.value)}</textarea>` : `<input name="${escape(field.name)}" maxlength="${field.maxlength || 100}" value="${escape(field.value)}" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px">`}`).join('')}<p data-error style="min-height:18px;margin:10px 0;color:#ff8d8d;font-size:13px"></p><div style="display:flex;gap:8px;justify-content:center"><button type="submit" style="padding:10px 16px;border:0;border-radius:8px;background:#ffd84d;font-weight:bold;cursor:pointer">${escape(submitLabel)}</button><button type="button" data-cancel style="padding:10px 16px;border:0;border-radius:8px;background:#999;font-weight:bold;cursor:pointer">Cancel</button></div>`;
      shade.appendChild(form); document.body.appendChild(shade);
      const guard = event => { if (shade.contains(event.target)) event.stopPropagation(); };
      ['keydown', 'keyup', 'keypress'].forEach(type => document.addEventListener(type, guard));
      const finish = value => { ['keydown', 'keyup', 'keypress'].forEach(type => document.removeEventListener(type, guard)); shade.remove(); resolve(value); };
      form.addEventListener('submit', event => { event.preventDefault(); finish(Object.fromEntries(new FormData(form).entries())); });
      form.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      shade.addEventListener('click', event => { if (event.target === shade) finish(null); });
      form.querySelector('input, textarea')?.focus();
    });
  },

  _socialList(title, content, onReady = null) {
    const shade = document.createElement('div');
    shade.style.cssText = 'position:fixed;inset:0;z-index:100002;display:grid;place-items:center;background:rgba(0,0,0,.78);font-family:Arial,sans-serif;color:#fff;';
    const dialog = document.createElement('div');
    dialog.style.cssText = 'width:min(500px,calc(100vw - 32px));max-height:80vh;overflow:auto;padding:26px;border:3px solid #ffd84d;border-radius:16px;background:linear-gradient(145deg,#30395c,#111522);box-shadow:0 10px 0 #000,0 20px 55px #000b;';
    dialog.innerHTML = `<h2 style="margin:0 0 18px;text-align:center;color:#ffd84d">${String(title).replace(/[<>&"']/g, '')}</h2><div data-content>${content || '<span style="color:#aaa">Nothing here yet.</span>'}</div><div style="text-align:center;margin-top:18px"><button type="button" data-close style="padding:10px 18px;border:0;border-radius:8px;background:#999;font-weight:bold;cursor:pointer">Close</button></div>`;
    shade.appendChild(dialog); document.body.appendChild(shade);
    const close = () => shade.remove();
    dialog.querySelector('[data-close]').addEventListener('click', close);
    shade.addEventListener('click', event => { if (event.target === shade) close(); });
    onReady?.(dialog, close);
    return { shade, dialog, close };
  },

  async findProfilePrompt(username = '') {
    const profile = username ? await this.searchProfile(username) : await this.profilePrompt();
    if (!profile) return null;
    const shade = document.createElement('div');
    shade.className = 'wd-profile-modal';
    shade.style.cssText = 'position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:rgba(0,0,0,.76);font-family:Arial,sans-serif;color:#fff;';
    const dialog = document.createElement('div');
    dialog.style.cssText = 'width:min(430px,calc(100vw - 32px));padding:28px;border:3px solid #ffd84d;border-radius:18px;background:linear-gradient(145deg,#30395c,#111522);box-shadow:0 10px 0 #000,0 20px 55px #000b;text-align:center;';
    const safeName = String(profile.username || 'Unknown').replace(/[<>&"']/g, '');
    const safeDisplay = String(profile.display_name || profile.username || 'Unknown').replace(/[<>&"']/g, '');
    const safeBio = String(profile.bio || 'No bio yet.').replace(/[<>&"']/g, '');
    const isSelf = String(this.currentUser?.username || '').toLowerCase() === String(profile.username || '').toLowerCase();
    dialog.innerHTML = `<h2 style="margin:0 0 3px;color:#ffd84d;font-size:30px">${safeDisplay}</h2><div style="color:#aaa;margin-bottom:16px">@${safeName}</div><p data-bio style="margin:0 0 18px;color:#ddd;min-height:22px">${safeBio}</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"><div style="padding:14px 6px;border-radius:10px;background:#202943"><b style="display:block;font-size:25px;color:#ffe45c">${Number(profile.stars) || 0}</b><small>Stars</small></div><div style="padding:14px 6px;border-radius:10px;background:#202943"><b style="display:block;font-size:25px;color:#8de8ff">${Number(profile.coins) || 0}</b><small>Coins</small></div><div style="padding:14px 6px;border-radius:10px;background:#202943"><b style="display:block;font-size:25px;color:#d98cff">${Number(profile.diamonds) || 0}</b><small>Diamonds</small></div><div style="padding:14px 6px;border-radius:10px;background:#202943"><b style="display:block;font-size:25px;color:#88ffbb">${Number(profile.levels) || 0}</b><small>Levels</small></div></div><div data-levels style="display:none;margin-top:16px;text-align:left;max-height:180px;overflow:auto;padding:10px;border-radius:10px;background:#151c2e"></div><p data-error style="min-height:18px;margin:12px 0;color:#ff8d8d;font-size:13px"></p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:18px">${isSelf ? '<button type="button" data-edit style="padding:10px 14px;border:0;border-radius:9px;background:#8de8ff;font-weight:bold;cursor:pointer">Edit Profile</button><button type="button" data-friends style="padding:10px 14px;border:0;border-radius:9px;background:#88ffbb;font-weight:bold;cursor:pointer">Friends</button><button type="button" data-inbox style="padding:10px 14px;border:0;border-radius:9px;background:#d98cff;font-weight:bold;cursor:pointer">Messages</button>' : '<button type="button" data-friend style="padding:10px 14px;border:0;border-radius:9px;background:#88ffbb;font-weight:bold;cursor:pointer">Add Friend</button><button type="button" data-message style="padding:10px 14px;border:0;border-radius:9px;background:#d98cff;font-weight:bold;cursor:pointer">Message</button>'}<button type="button" data-levels-button style="padding:10px 14px;border:0;border-radius:9px;background:#ffd84d;font-weight:bold;cursor:pointer">Levels</button><button type="button" data-close style="padding:10px 14px;border:0;border-radius:9px;background:#999;font-weight:bold;cursor:pointer">Close</button></div>`;
    shade.appendChild(dialog); document.body.appendChild(shade);
    const close = () => shade.remove();
    const setProfileError = message => {
      const errorNode = dialog.querySelector('[data-error]');
      if (errorNode) errorNode.textContent = message || '';
    };
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.querySelector('[data-levels-button]').addEventListener('click', () => {
      const levels = Array.isArray(profile.level_list) ? profile.level_list : [];
      shade.remove();
      window.dispatchEvent(new CustomEvent('wd-profile-levels-selected', {
        detail: { username: profile.username, displayName: profile.display_name, levels }
      }));
    });
    dialog.querySelector('[data-edit]')?.addEventListener('click', async () => {
      const values = await this._socialForm('Edit Profile', [
        { name: 'display_name', label: 'Display name', value: profile.display_name || profile.username, maxlength: 32 },
        { name: 'bio', label: 'Bio', value: profile.bio || '', maxlength: 240, multiline: true }
      ], 'Save Changes');
      if (!values) return;
      const displayName = String(values.display_name || '').trim();
      const bio = String(values.bio || '').trim();
      try {
        await this.updateProfile({ display_name: displayName, bio });
        profile.display_name = displayName.slice(0, 32); profile.bio = bio.slice(0, 240);
        dialog.querySelector('h2').textContent = profile.display_name;
        dialog.querySelector('[data-bio]').textContent = profile.bio || 'No bio yet.';
      } catch (error) { setProfileError(error.message || 'Could not update profile'); }
    });
    dialog.querySelector('[data-friend]')?.addEventListener('click', async event => {
      try { await this.updateFriend(profile.username, 'request'); event.currentTarget.textContent = 'Request Sent'; event.currentTarget.disabled = true; }
      catch (error) { setProfileError(error.message || 'Could not send friend request'); }
    });
    dialog.querySelector('[data-friends]')?.addEventListener('click', async () => {
      try {
        const data = await this.getFriends();
        const incoming = (data.incoming || []).map(friend => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #303b55"><span>@${String(friend.username).replace(/[<>&"']/g, '')}</span><button type="button" data-accept="${String(friend.username).replace(/[^a-z0-9_.-]/gi, '')}" style="padding:6px 10px;border:0;border-radius:7px;background:#88ffbb;font-weight:bold">Accept</button></div>`).join('');
        this._socialList('Friends', `<p style="color:#aaa">Friends: ${(data.friends || []).length}</p>${incoming ? `<h3 style="color:#ffd84d">Requests</h3>${incoming}` : ''}`, (listDialog, closeList) => {
          listDialog.querySelectorAll('[data-accept]').forEach(button => button.addEventListener('click', async () => { await this.updateFriend(button.dataset.accept, 'accept'); button.textContent = 'Accepted'; button.disabled = true; }));
        });
      } catch (error) { setProfileError(error.message || 'Could not load friends'); }
    });
    dialog.querySelector('[data-inbox]')?.addEventListener('click', async () => {
      try {
        const data = await this.getMessages();
        const messages = (data.messages || []).slice().reverse().map(item => `<div style="padding:9px 0;border-bottom:1px solid #303b55"><b>@${String(item.from_username || '').replace(/[<>&"']/g, '')}</b><p style="margin:5px 0;color:#ddd">${String(item.text || '').replace(/[<>&"']/g, '')}</p></div>`).join('');
        this._socialList('Messages', messages || '<span style="color:#aaa">No messages yet.</span>');
      } catch (error) { setProfileError(error.message || 'Could not load messages'); }
    });
    dialog.querySelector('[data-message]')?.addEventListener('click', async () => {
      const values = await this._socialForm(`Message @${profile.username}`, [
        { name: 'text', label: 'Message', maxlength: 1000, multiline: true }
      ], 'Send Message');
      const text = String(values?.text || '').trim();
      if (!text) return;
      try {
        await this.sendMessage(profile.username, text);
        const errorNode = dialog.querySelector('[data-error]');
        if (errorNode) { errorNode.style.color = '#88ffbb'; errorNode.textContent = 'Message sent.'; }
      }
      catch (error) { setProfileError(error.message || 'Could not send message'); }
    });
    shade.addEventListener('click', event => { if (event.target === shade) close(); });
    return profile;
  },

  async moderatorPrompt(levelId = '') {
    if (!this.currentUser && !(await this.checkSession())) throw new Error('Login required');
    if (!this.isModerator()) throw new Error('Moderator access required');
    return new Promise(resolve => {
      const shade = document.createElement('div');
      shade.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.72);font-family:Arial,sans-serif;color:#fff;';
      const dialog = document.createElement('form');
      dialog.style.cssText = 'width:min(420px,calc(100vw - 32px));padding:26px;border:3px solid #fff;border-radius:16px;background:linear-gradient(#303030,#111);box-shadow:0 8px 0 #000,0 18px 50px #000b;';
      dialog.innerHTML = '<h2 style="margin:0 0 8px;text-align:center;color:#ffd84d;font-size:28px">Moderator Tools</h2>' +
        `<label style="display:block;margin:12px 0 5px;font-weight:bold">Level ID</label><input name="id" required inputmode="numeric" pattern="[0-9]+" value="${String(levelId).replace(/[^0-9]/g, '')}" style="box-sizing:border-box;width:100%;padding:10px;border-radius:7px;border:2px solid #777;font-size:16px">` +
        '<p data-suggestions style="min-height:18px;margin:8px 0;color:#8de8ff;font-size:13px">Enter an ID to view player star suggestions.</p>' +
        '<label style="display:block;margin:12px 0 5px;font-weight:bold">Difficulty</label><select name="difficulty" style="padding:9px;border-radius:7px;font-size:16px;width:100%"><option value="0">NA</option><option value="1">Easy</option><option value="2">Normal</option><option value="3">Hard</option><option value="4">Harder</option><option value="5">Insane</option><option value="6">Demon</option><option value="7">Easy Demon</option><option value="8">Medium Demon</option><option value="9">Hard Demon</option><option value="10">Insane/Extreme Demon</option></select>' +
        '<label style="display:block;margin:12px 0 5px;font-weight:bold">Official level stars</label><select name="stars" style="padding:9px;border-radius:7px;font-size:16px;width:100%"><option value="0">Unrated</option><option value="1">1 star</option><option value="2">2 stars</option><option value="3">3 stars</option><option value="4">4 stars</option><option value="5">5 stars</option><option value="6">6 stars</option><option value="7">7 stars</option><option value="8">8 stars</option><option value="9">9 stars</option><option value="10">10 stars</option></select>' +
        '<label style="display:block;margin:12px 0 5px;font-weight:bold">Stars awarded on completion</label><select name="star_reward" style="padding:9px;border-radius:7px;font-size:16px;width:100%"><option value="0">0 stars</option><option value="1">1 star</option><option value="2">2 stars</option><option value="3">3 stars</option><option value="4">4 stars</option><option value="5">5 stars</option><option value="6">6 stars</option><option value="7">7 stars</option><option value="8">8 stars</option><option value="9">9 stars</option><option value="10">10 stars</option></select>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:12px 0 5px;font-weight:bold"><input name="verified" type="checkbox"> Verify level</label>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:8px 0 5px"><input name="verification_hacks" type="checkbox"> Verification used hacks</label>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:8px 0 12px"><input name="verification_start_pos" type="checkbox"> Verification used StartPos</label>' +
        '<label style="display:flex;gap:8px;align-items:center;margin:16px 0;font-weight:bold"><input name="featured" type="checkbox"> Feature this level</label>' +
        '<p data-error style="min-height:18px;margin:10px 0;color:#ff8d8d;font-size:13px"></p><div style="display:flex;gap:8px;justify-content:center"><button type="submit" style="padding:10px 16px;border:0;border-radius:8px;background:#61d66f;font-weight:bold;cursor:pointer">Apply</button><button type="button" data-cancel style="padding:10px 16px;border:0;border-radius:8px;background:#999;font-weight:bold;cursor:pointer">Cancel</button></div>';
      shade.appendChild(dialog); document.body.appendChild(shade);
      const guard = event => { if (shade.contains(event.target)) event.stopPropagation(); };
      ['keydown', 'keyup', 'keypress'].forEach(type => document.addEventListener(type, guard));
      const finish = value => { ['keydown', 'keyup', 'keypress'].forEach(type => document.removeEventListener(type, guard)); shade.remove(); resolve(value); };
      dialog.addEventListener('submit', event => { event.preventDefault(); const form = new FormData(dialog); const id = String(form.get('id') || '').trim(); if (!/^\d+$/.test(id)) { dialog.querySelector('[data-error]').textContent = 'Enter a numeric level ID.'; return; } finish({ id, difficulty: Number(form.get('difficulty') || 0), stars: Number(form.get('stars') || 0), featured: form.get('featured') === 'on', star_reward: Number(form.get('star_reward') || 0), verified: form.get('verified') === 'on', verification_hacks: form.get('verification_hacks') === 'on', verification_start_pos: form.get('verification_start_pos') === 'on' }); });
      dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      shade.addEventListener('click', event => { if (event.target === shade) finish(null); });
      dialog.querySelector('[name="id"]').focus();
      const idInput = dialog.querySelector('[name="id"]');
      const suggestionText = dialog.querySelector('[data-suggestions]');
      const refreshSuggestions = async () => {
        if (!/^\d+$/.test(idInput.value.trim())) return;
        try {
          const level = await this.getLevelForModeration(idInput.value.trim());
          const values = Object.values(level.star_suggestions || {}).map(Number).filter(Number.isFinite);
          suggestionText.textContent = values.length
            ? `Player suggestions: ${values.join(', ')} stars (official: ${Number(level.stars) || 0})`
            : `No player star suggestions yet (official: ${Number(level.stars) || 0})`;
        } catch (error) {
          suggestionText.textContent = error.message || 'Could not load suggestions.';
        }
      };
      idInput.addEventListener('change', refreshSuggestions);
      idInput.addEventListener('blur', refreshSuggestions);
    });
  },

  clearClientData() {
    try {
      const keys = [
        'gd_settings', 'gd_totalAttempts', 'gd_totalJumps', 'gd_totalDeaths',
        'gd_completedLevels', 'created_levels', 'iconMainColor', 'iconSecondaryColor',
        'iconCurrentPlayer', 'iconCurrentShip', 'iconCurrentBall', 'iconCurrentWave',
        'iconCurrentSpider', 'iconCurrentBird', 'userMusicVol', 'userSfxVol',
        'menuMusicEnabled', 'playerName', 'wd_coins', 'wd_diamonds', 'wd_daily_claims', 'wd_quest_claims', 'wd_gauntlet_claims', 'wd_coin_items', 'wd_icon_items', 'wd_user_coins', 'wd_stars', 'wd_claimed_level_stars', 'wd_unlocked_levels', 'wd_icon_prices', 'wd_icon_prices_version', 'wd_collected_coins',
      ];
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('bestPercent_') || key.startsWith('practiceBestPercent_'))) {
          localStorage.removeItem(key);
        }
      }
    } catch {}

    try {
      sessionStorage.clear();
    } catch {}

    try {
      const cookies = document.cookie ? document.cookie.split(';') : [];
      for (const cookie of cookies) {
        const eqIndex = cookie.indexOf('=');
        const name = (eqIndex >= 0 ? cookie.slice(0, eqIndex) : cookie).trim();
        if (!name) continue;
        const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
        const path = 'path=/';
        document.cookie = `${name}=; ${expires}; ${path}`;
        document.cookie = `${name}=; ${expires}; ${path}; domain=${location.hostname}`;
      }
    } catch {}
  },

  async unlinkAccount() {
    await this.logout();
    this.clearClientData();
  },

  async getCloudSave() {
    const res = await fetch(this._url('/api/saves'), { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load save');
    return data.save;
  },

  async setCloudSave(saveData) {
    const res = await fetch(this._url('/api/saves'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save: saveData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save');
  },

  async syncLeaderboardStats() {
    if (!this.currentUser && !(await this.checkSession())) return false;
    if (this._leaderboardSyncInFlight) return this._leaderboardSyncInFlight;
    this._leaderboardSyncInFlight = this.setCloudSave(this.collectLocalData())
      .then(() => true)
      .finally(() => { this._leaderboardSyncInFlight = null; });
    await this._leaderboardSyncInFlight;
    return true;
  },

  _startLeaderboardStatsSync() {
    // Account saves are event-driven/manual; never upload the full account
    // once per second.
  },

  _stopLeaderboardStatsSync() {
    if (this._leaderboardSyncTimer) clearInterval(this._leaderboardSyncTimer);
    this._leaderboardSyncTimer = null;
  },

  collectLocalData() {
    const keys = [
      'gd_settings', 'gd_totalAttempts', 'gd_totalJumps', 'gd_totalDeaths',
      'gd_completedLevels', 'created_levels', 'iconMainColor', 'iconSecondaryColor',
      'iconCurrentPlayer', 'iconCurrentShip', 'iconCurrentBall', 'iconCurrentWave',
      'iconCurrentSpider', 'iconCurrentBird', 'userMusicVol', 'userSfxVol',
        'menuMusicEnabled', 'playerName', 'wd_coins', 'wd_diamonds', 'wd_daily_claims', 'wd_quest_claims', 'wd_gauntlet_claims', 'wd_coin_items', 'wd_icon_items', 'wd_user_coins', 'wd_stars', 'wd_claimed_level_stars', 'wd_unlocked_levels', 'wd_icon_prices', 'wd_icon_prices_version', 'wd_collected_coins',
    ];
    const save = {};
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) save[key] = val;
    }
    const bestPercents = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('bestPercent_') || k.startsWith('practiceBestPercent_'))) {
        bestPercents[k] = localStorage.getItem(k);
      }
    }
    save._bestPercents = bestPercents;
    return save;
  },

  applyLocalData(save) {
    if (!save) return;
    const keys = [
      'gd_settings', 'gd_totalAttempts', 'gd_totalJumps', 'gd_totalDeaths',
      'gd_completedLevels', 'created_levels', 'iconMainColor', 'iconSecondaryColor',
      'iconCurrentPlayer', 'iconCurrentShip', 'iconCurrentBall', 'iconCurrentWave',
      'iconCurrentSpider', 'iconCurrentBird', 'userMusicVol', 'userSfxVol',
        'menuMusicEnabled', 'playerName', 'wd_coins', 'wd_diamonds', 'wd_daily_claims', 'wd_quest_claims', 'wd_gauntlet_claims', 'wd_coin_items', 'wd_icon_items', 'wd_user_coins', 'wd_stars', 'wd_claimed_level_stars', 'wd_unlocked_levels', 'wd_icon_prices', 'wd_icon_prices_version', 'wd_collected_coins',
    ];
    for (const key of keys) {
      if (save[key] !== undefined) localStorage.setItem(key, save[key]);
    }
    if (save._bestPercents) {
      for (const [k, v] of Object.entries(save._bestPercents)) {
        localStorage.setItem(k, v);
      }
    }
  },
};

// Check session silently on page load so currentUser is populated before
// the player opens the settings screen.
window.AccountAPI.checkSession().catch(() => {});
