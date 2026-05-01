/* ═══════════════════════════════════════════
   PALINDROME VAULT — main.js
   Community Edition · Humyn Labs
   ═══════════════════════════════════════════
   Data is stored in Firebase Realtime Database.
   To enable real shared data, ensure you have
   pasted your Firebase apiKey and appId below.
   ═══════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────
   CONFIG — flip USE_CLOUD to true and
   fill in firebaseConfig for live sharing
   ────────────────────────────────────── */
const USE_CLOUD = true;   // ✅ Firebase enabled

const firebaseConfig = {
    apiKey:            "AIzaSyBxFMcTIfZt_N87G_8z7gmlJcjzMpIE6e0",
    authDomain:        "palindrome-gwr.firebaseapp.com",
    databaseURL:       "https://palindrome-gwr-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:         "palindrome-gwr",
    storageBucket:     "palindrome-gwr.firebasestorage.app",
    messagingSenderId: "872164145975",
    appId:             "1:872164145975:web:f7f6e14ef801ffb173f8b2",
    measurementId:     "G-MZY9KNWF5F"
};

/* ═══════════════════════════════════════
   STORAGE LAYER (local + Firebase cloud)
   ═══════════════════════════════════════ */
const Store = (() => {
    const KEY = 'palindromeVault_v2';
    let db = null;
    let onChangeCallback = null;

    /* ── Local helpers ── */
    function getAll() {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
    }

    function saveLocal(entries) {
        localStorage.setItem(KEY, JSON.stringify(entries));
    }

    /* ── Cloud init ── */
    function initCloud() {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();

            // Listen for real-time updates from ALL users
            db.ref('palindromes')
              .orderByChild('timestamp')
              .on('value', snap => {
                  const raw = snap.val() || {};
                  const entries = Object.values(raw)
                      .sort((a, b) => b.timestamp - a.timestamp);
                  saveLocal(entries);           // cache locally
                  if (onChangeCallback) onChangeCallback(entries);
              });

            console.log('🔥 Firebase connected');
        } catch (err) {
            console.error('Firebase init failed, falling back to local:', err);
        }
    }

    /* ── Public API ── */
    function init(onChange) {
        onChangeCallback = onChange;
        if (USE_CLOUD) initCloud();
    }

    function add(entry) {
        if (USE_CLOUD && db) {
            // Push to cloud — the on('value') listener will update local automatically
            db.ref('palindromes').push(entry)
              .catch(err => {
                  console.error('Firebase save failed:', err);
                  // Trigger a localized error toast
                  if (window.showFeedback) {
                      window.showFeedback('Cloud save failed. Check your Firebase Rules!', 'bad');
                  }
              });
        } else {
            const all = getAll();
            all.unshift(entry);
            saveLocal(all);
        }
        return getAll();
    }

    function clearAll() {
        if (USE_CLOUD && db) db.ref('palindromes').remove();
        localStorage.removeItem(KEY);
        return [];
    }

    return { init, getAll, add, clearAll };
})();

/* ═══════════════════════════════════════
   DOM REFERENCES
   ═══════════════════════════════════════ */
const nameInput    = document.getElementById('name-input');
const palInput     = document.getElementById('pal-input');
const mirrorPrev   = document.getElementById('mirror-preview');
const submitBtn    = document.getElementById('submit-btn');
const btnText      = document.getElementById('btn-text');
const feedbackMsg  = document.getElementById('feedback-msg');
const feedList     = document.getElementById('feed-list');
const feedLoading  = document.getElementById('feed-loading');
const searchInput  = document.getElementById('search-input');
const sortSelect   = document.getElementById('sort-select');
const lbList       = document.getElementById('lb-list');
const toastRoot    = document.getElementById('toast-root');
const liveCount    = document.getElementById('live-count');
const statTotal    = document.getElementById('stat-total');
const statUnique   = document.getElementById('stat-unique');
const statLongest  = document.getElementById('stat-longest');

/* ── Hint chips ── */
document.querySelectorAll('.hint-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        palInput.value = chip.dataset.word;
        palInput.focus();
        updateMirror();
    });
});

/* ═══════════════════════════════════════
   PALINDROME UTILS
   ═══════════════════════════════════════ */
function clean(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isPalindrome(str) {
    const s = clean(str);
    return s.length >= 2 && s === s.split('').reverse().join('');
}

function reverseDisplay(str) {
    return str.split('').reverse().join('');
}

/* ═══════════════════════════════════════
   LIVE MIRROR PREVIEW
   ═══════════════════════════════════════ */
function updateMirror() {
    const raw = palInput.value;
    if (!raw) {
        mirrorPrev.textContent = '';
        mirrorPrev.className = 'mirror-preview';
        return;
    }
    const reversed = reverseDisplay(raw);
    const ispal    = isPalindrome(raw);
    mirrorPrev.textContent = `↔  ${reversed}`;
    mirrorPrev.className   = `mirror-preview ${ispal ? 'palindrome' : 'not-palindrome'}`;
}

palInput.addEventListener('input', updateMirror);

/* ═══════════════════════════════════════
   SUBMIT HANDLER
   ═══════════════════════════════════════ */
submitBtn.addEventListener('click', handleSubmit);
palInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
});
nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') palInput.focus();
});

function handleSubmit() {
    const name = nameInput.value.trim() || 'Anonymous Contributor';
    const raw  = palInput.value.trim();

    if (!raw) {
        showFeedback('Please enter a word or phrase.', 'bad');
        shake(palInput);
        return;
    }

    const c = clean(raw);

    if (c.length < 2) {
        showFeedback("That's too short — palindromes need at least 2 characters.", "bad");
        shake(palInput);
        return;
    }

    if (!isPalindrome(raw)) {
        showFeedback(
            `"${raw}" is not a palindrome — it reverses to "${reverseDisplay(clean(raw))}". Try again!`,
            'bad'
        );
        shake(palInput);
        return;
    }

    const all = Store.getAll();

    if (all.some(e => clean(e.word) === c)) {
        showFeedback('This palindrome is already in the Vault!', 'bad');
        palInput.value = '';
        updateMirror();
        return;
    }

    /* ── Valid! ── */
    const entry = {
        id:        Date.now(),
        word:      raw,
        clean:     c,
        name:      name,
        timestamp: Date.now(),
    };

    Store.add(entry);
    palInput.value = '';
    updateMirror();
    showFeedback(`"${raw}" is a perfect palindrome! Submitted to the Vault.`, 'good');
    toast('✓', `"${raw}" added!`, 'good');
    refreshAll();
}

/* ═══════════════════════════════════════
   FEEDBACK + SHAKE
   ═══════════════════════════════════════ */
function showFeedback(msg, type) {
    feedbackMsg.textContent = msg;
    feedbackMsg.className   = `feedback-msg ${type}`;
    feedbackMsg.style.opacity = '1';
    clearTimeout(feedbackMsg._t);
    feedbackMsg._t = setTimeout(() => {
        feedbackMsg.style.opacity = '0';
    }, 4500);
}

function shake(el) {
    el.animate([
        { transform: 'translateX(0)' },
        { transform: 'translateX(-7px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' }
    ], { duration: 380, easing: 'ease-out' });
}

/* ═══════════════════════════════════════
   FEED RENDER
   ═══════════════════════════════════════ */
function getFiltered() {
    let all     = Store.getAll();
    const query = searchInput.value.trim().toLowerCase();
    const sort  = sortSelect.value;

    if (query) {
        all = all.filter(e =>
            e.word.toLowerCase().includes(query) ||
            e.name.toLowerCase().includes(query)
        );
    }

    if (sort === 'longest') {
        all = [...all].sort((a, b) => b.clean.length - a.clean.length);
    } else if (sort === 'az') {
        all = [...all].sort((a, b) => a.word.localeCompare(b.word));
    }
    // default = newest (already unshifted)

    return all;
}

function renderFeed() {
    const entries = getFiltered();

    if (!entries.length) {
        feedList.innerHTML = `<div class="feed-empty">
            ${searchInput.value ? 'No matches found.' : 'The Vault is empty — be the first to submit!'}
        </div>`;
        return;
    }

    feedList.innerHTML = '';
    entries.forEach((e, i) => {
        const el = document.createElement('div');
        el.className = 'feed-entry';
        el.style.animationDelay = `${Math.min(i, 10) * 40}ms`;
        el.innerHTML = `
            <div>
                <div class="entry-word-text">${escHtml(e.word)}</div>
                <div class="entry-author">by <strong>${escHtml(e.name)}</strong> · ${e.clean.length} chars</div>
            </div>
            <div class="entry-time">${relativeTime(e.timestamp)}</div>
        `;
        feedList.appendChild(el);
    });
}

/* ═══════════════════════════════════════
   LEADERBOARD
   ═══════════════════════════════════════ */
function renderLeaderboard() {
    const all = Store.getAll();
    const counts = {};
    all.forEach(e => {
        counts[e.name] = (counts[e.name] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (!sorted.length) {
        lbList.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem">Submit palindromes to appear here.</p>';
        return;
    }

    lbList.innerHTML = '';
    sorted.forEach(([name, count], i) => {
        const card = document.createElement('div');
        card.className = 'lb-card';
        card.innerHTML = `
            <div class="lb-rank">${i + 1}</div>
            <div>
                <div class="lb-info-name">${escHtml(name)}</div>
                <div class="lb-info-count">${count} submission${count !== 1 ? 's' : ''}</div>
            </div>
        `;
        lbList.appendChild(card);
    });
}

/* ═══════════════════════════════════════
   STATS
   ═══════════════════════════════════════ */
function updateStats() {
    const all    = Store.getAll();
    const unique = new Set(all.map(e => e.clean)).size;
    const longest = all.reduce((mx, e) => Math.max(mx, e.clean.length), 0);

    animateNum(statTotal,   all.length);
    animateNum(statUnique,  unique);
    animateNum(statLongest, longest);
    liveCount.textContent = all.length;
}

function animateNum(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const diff     = target - current;
    const steps    = 20;
    const step     = diff / steps;
    let count      = 0;
    let val        = current;
    const interval = setInterval(() => {
        val  += step;
        count++;
        el.textContent = Math.round(val);
        if (count >= steps) {
            el.textContent = target;
            clearInterval(interval);
        }
    }, 18);
}

/* ═══════════════════════════════════════
   REFRESH ALL
   ═══════════════════════════════════════ */
function refreshAll() {
    updateStats();
    renderFeed();
    renderLeaderboard();
}

/* ── Search / Sort listeners ── */
searchInput.addEventListener('input', renderFeed);
sortSelect.addEventListener('change', renderFeed);

/* ═══════════════════════════════════════
   TOAST
   ═══════════════════════════════════════ */
function toast(icon, msg, type = 'good') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span style="font-size:1rem">${icon}</span><span>${escHtml(msg)}</span>`;
    toastRoot.appendChild(el);

    setTimeout(() => {
        el.style.animation = 'toastOut 0.4s ease-in both';
        el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 3200);
}

/* ═══════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════ */
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function relativeTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

/* ═══════════════════════════════════════
   INIT
   ═══════════════════════════════════════ */
(function init() {
    /* Connect to Firebase (or local) — refreshAll runs on every change */
    Store.init(() => refreshAll());

    /* Remove loading spinner & do initial render */
    setTimeout(() => {
        if (feedLoading) feedLoading.remove();
        refreshAll();
    }, 300);

    /* Refresh relative timestamps every minute */
    setInterval(renderFeed, 60000);
})();
