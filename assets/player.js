/* Nickname sign-in + score counting. Anonymous Firebase auth (no email or password): the browser gets an
 * id, the student picks a nickname, and each correct quiz answer adds 1 to players/{uid}.total and .week.
 * The Firebase SDK is only downloaded once someone joins or has joined before. Exposes
 * window.Leaderboard.addCorrect(). Hidden until assets/firebase-config.js is filled in. */
(() => {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.projectId) return;
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const KEY = 'qh-player';
  // shortcut: "week" = whole 7-day blocks since 1970 (rolls over Thursday 00:00 UTC); switch to ISO weeks if a calendar week matters.
  const weekNow = () => Math.floor(Date.now() / 604800000);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* private mode */ } }
  };

  let sdk = null;
  const load = () => sdk || (sdk = (async () => {
    const [a, au, fs] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(B + f)));
    const app = a.initializeApp(cfg);
    return { au, fs, auth: au.getAuth(app), db: fs.getFirestore(app) };
  })());

  let me = store.get();            // {uid, name, total, weekId, week}
  let pending = 0, timer = null, busy = false;
  const myRef = async () => { const s = await load(); return { s, r: s.fs.doc(s.db, 'players', me.uid) }; };

  async function join(name) {
    const s = await load();
    const cred = await s.au.signInAnonymously(s.auth);
    const next = { uid: cred.user.uid, name, total: 0, week: 0, weekId: weekNow() };
    await s.fs.setDoc(s.fs.doc(s.db, 'players', next.uid), { name, total: 0, week: 0, weekId: next.weekId, updatedAt: s.fs.serverTimestamp() });
    me = next; store.set(me); paint();
  }
  async function rename(name) {
    const { s, r } = await myRef();
    await s.fs.updateDoc(r, { name });
    me.name = name; store.set(me); paint();
  }
  async function leave() {
    const { s, r } = await myRef();
    await s.fs.deleteDoc(r);
    me = null; pending = 0; store.set(null); paint();
  }

  async function flush() {
    clearTimeout(timer); timer = null;
    if (!me || !pending || busy) return;
    busy = true;
    const n = Math.min(pending, 50);          // the security rules allow at most 50 per write
    pending -= n;
    try {
      const { s, r } = await myRef();
      const w = weekNow(), f = s.fs;
      await f.updateDoc(r, { total: f.increment(n), weekId: w, week: me.weekId === w ? f.increment(n) : n, updatedAt: f.serverTimestamp() });
      me.total += n; me.week = me.weekId === w ? me.week + n : n; me.weekId = w; store.set(me); paint();
    } catch (e) { pending += n; }
    busy = false;
    if (pending >= 5) flush();
  }

  window.Leaderboard = {
    addCorrect() {
      if (!me) return;
      pending++;
      paint();
      if (pending >= 5) flush(); else if (!timer) timer = setTimeout(flush, 8000);
    }
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // One small tab bottom-left opens a box to join or manage the profile.
  const tab = document.createElement('button');
  tab.className = 'fb-tab pl-tab';
  tab.addEventListener('click', () => box());
  document.body.appendChild(tab);
  function paint() { tab.textContent = me ? `${me.name} · ${me.total + pending}` : 'Join the leaderboard'; }
  paint();

  function box() {
    const old = document.querySelector('.pl-box');
    if (old) { old.remove(); return; }
    const b = document.createElement('div');
    b.className = 'fb-box pl-box';
    const q = s => b.querySelector(s);
    b.innerHTML = `<div class="fb-head"><strong>${me ? 'Your profile' : 'Join the leaderboard'}</strong><button class="fb-x" aria-label="Close">&times;</button></div>
      <p class="fb-ctx" style="white-space:normal"></p>
      <input class="fb-text pl-name" maxlength="20" placeholder="Nickname (2-20 characters)">
      <div class="fb-row"><span class="fb-msg" aria-live="polite"></span><button class="btn primary pl-go">${me ? 'Rename' : 'Join'}</button></div>
      <div class="fb-row"><a href="leaderboard.html">See the leaderboard</a>${me ? '<button class="fb-report pl-leave">Leave and delete my score</button>' : ''}</div>`;
    q('.fb-ctx').textContent = me ? `You have answered ${me.total + pending} correctly.` : 'Pick a nickname (not your real name). It is shown on the public leaderboard. No email or password.';
    q('.pl-name').value = me ? me.name : '';
    document.body.appendChild(b);
    q('.fb-x').addEventListener('click', () => b.remove());
    q('.pl-go').addEventListener('click', async () => {
      const name = q('.pl-name').value.trim().replace(/\s+/g, ' ');
      if (name.length < 2) { q('.fb-msg').textContent = 'At least 2 characters.'; return; }
      q('.pl-go').disabled = true;
      try { me ? await rename(name) : await join(name); b.remove(); }
      catch (e) { q('.fb-msg').textContent = "Couldn't save. Try again later."; q('.pl-go').disabled = false; }
    });
    const lv = q('.pl-leave');
    if (lv) lv.addEventListener('click', async () => {
      if (!confirm('Delete your nickname and score?')) return;
      try { await leave(); b.remove(); } catch (e) { q('.fb-msg').textContent = "Couldn't delete. Try again."; }
    });
  }
})();
