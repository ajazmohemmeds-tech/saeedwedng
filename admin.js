import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDocs, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDABXfuMeGsTO1rxGihBTDGauIJcZ1fJGU",
  authDomain: "saeed-anzi-wedding.firebaseapp.com",
  projectId: "saeed-anzi-wedding",
  storageBucket: "saeed-anzi-wedding.firebasestorage.app",
  messagingSenderId: "889701160746",
  appId: "1:889701160746:web:33a62691f510466b46f053",
  measurementId: "G-RFQDD5Q52V"
};

const ADMIN_CODE = "9566";

// ─── Admin Security Utilities ─────────────────────────────────────────────────
/** Strip all HTML/script tags and dangerous characters from a string */
function adminSanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim();
}

/** Validate a guest name: non-empty, max 80 chars, safe chars only */
function validateGuestName(name) {
    const s = adminSanitize(name);
    if (!s) return { valid: false, reason: 'Name is required.' };
    if (s.length > 80) return { valid: false, reason: 'Name must be under 80 characters.' };
    return { valid: true, value: s };
}

/** Validate a slug: lowercase alphanumeric and hyphens only, max 60 chars */
function validateSlug(slug) {
    const s = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (!s) return { valid: false, reason: 'Slug is required.' };
    if (s.length > 60) return { valid: false, reason: 'Slug must be under 60 characters.' };
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s) && s.length > 1) return { valid: false, reason: 'Invalid slug format.' };
    return { valid: true, value: s };
}
// ─────────────────────────────────────────────────────────────────────────────

// Initialize Firebase
let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase init error:", e);
}

const initializeAdmin = () => {
    const overlay = document.getElementById('admin-login-overlay');
    const content = document.getElementById('main-admin-content');
    if (overlay) overlay.classList.add('hidden');
    if (content) content.classList.remove('hidden');
    
    // Trigger the main logic once authorized
    console.log("Admin authorized. Initializing dashboard...");
};

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('admin-login-overlay');
    const passcodeBtn = document.getElementById('btn-login');
    const passcodeInput = document.getElementById('admin-passcode');
    const errorMsg = document.getElementById('login-error');
    const attemptsHint = document.getElementById('login-attempts-hint');
    const loginCard = document.querySelector('.login-card');
    const terminalLockout = document.getElementById('terminal-lockout');
    const terminalOutput = document.getElementById('terminal-output');
    const terminalRetryBtn = document.getElementById('terminal-retry-btn');

    let failedAttempts = 0;
    const MAX_ATTEMPTS = 4;

    // ── Terminal Typewriter Engine ──────────────────────────────────────────
    const TERMINAL_LINES = [
        '[ ACCESS DENIED ]',
        '',
        '> ERROR 403 : Curiosity Detected.',
        '> Permission rejected.',
        '',
        '> Try Again....or Maybe don\'t.',
        '> This isn\'t your moment.',
        '',
        '> _'
    ];

    function typewriterSequence(lines, outputEl, onComplete) {
        outputEl.innerHTML = '';
        // Cursor element
        const cursor = document.createElement('span');
        cursor.className = 'terminal-cursor';

        let lineIndex = 0;
        let charIndex = 0;
        let currentLineEl = null;

        function nextChar() {
            if (lineIndex >= lines.length) {
                // All lines typed — remove cursor and signal done
                if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
                if (onComplete) onComplete();
                return;
            }

            const line = lines[lineIndex];

            // Start a new line element
            if (charIndex === 0) {
                currentLineEl = document.createElement('div');
                outputEl.appendChild(currentLineEl);
            }

            if (charIndex < line.length) {
                // Type next character
                currentLineEl.textContent = line.slice(0, charIndex + 1);
                currentLineEl.appendChild(cursor);
                charIndex++;
                const delay = line === '' ? 20 : (Math.random() * 35 + 25); // faster on empty
                setTimeout(nextChar, delay);
            } else {
                // Line finished — move cursor to next line
                currentLineEl.textContent = line; // finalize without cursor
                lineIndex++;
                charIndex = 0;
                // Pause between lines
                const pauseMs = line === '' ? 80 : 180;
                setTimeout(nextChar, pauseMs);
            }
        }

        // Initial cursor blink before typing starts
        outputEl.appendChild(cursor);
        setTimeout(nextChar, 400);
    }

    function triggerTerminalLockout() {
        // Hide login overlay immediately
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
        }
        // Show terminal
        if (terminalLockout) terminalLockout.classList.remove('hidden');

        // Run typewriter
        typewriterSequence(TERMINAL_LINES, terminalOutput, () => {
            // Show retry button after typing finishes
            if (terminalRetryBtn) terminalRetryBtn.classList.remove('hidden');
        });
    }
    // ── End Terminal Engine ──────────────────────────────────────────────────

    // Retry: reset everything and go back to login
    if (terminalRetryBtn) {
        terminalRetryBtn.addEventListener('click', () => {
            failedAttempts = 0;
            terminalLockout.classList.add('hidden');
            terminalRetryBtn.classList.add('hidden');
            terminalOutput.innerHTML = '';
            if (overlay) {
                overlay.style.opacity = '';
                overlay.style.visibility = '';
            }
            if (errorMsg) errorMsg.classList.add('hidden');
            if (attemptsHint) attemptsHint.classList.add('hidden');
            if (passcodeInput) {
                passcodeInput.value = '';
                passcodeInput.focus();
            }
        });
    }

    // Check existing session
    if (sessionStorage.getItem('admin_authenticated') === 'true') {
        initializeAdmin();
    }

    const handleLogin = () => {
        if (passcodeInput.value === ADMIN_CODE) {
            failedAttempts = 0;
            sessionStorage.setItem('admin_authenticated', 'true');
            initializeAdmin();
            loadGuests();
        } else {
            failedAttempts++;
            passcodeInput.value = '';

            // Shake the card
            if (loginCard) {
                loginCard.classList.remove('shake');
                void loginCard.offsetWidth; // reflow to restart animation
                loginCard.classList.add('shake');
            }

            const remaining = MAX_ATTEMPTS - failedAttempts;

            if (failedAttempts >= MAX_ATTEMPTS) {
                // Trigger the terminal lockout
                triggerTerminalLockout();
            } else {
                if (errorMsg) errorMsg.classList.remove('hidden');
                if (attemptsHint) {
                    attemptsHint.classList.remove('hidden');
                    attemptsHint.textContent = remaining === 1
                        ? '⚠ Final attempt remaining.'
                        : `⚠ ${remaining} attempts remaining.`;
                }
                passcodeInput.focus();
            }
        }
    };

    if (passcodeBtn) passcodeBtn.addEventListener('click', handleLogin);
    if (passcodeInput) {
        passcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Initialize Lenis Smooth Scroll
    try {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            lerp: 0.1
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    } catch(e) {
        console.warn("Lenis not available or failed:", e);
    }

    const nameInput = document.getElementById('new-guest-name');
    const idInput = document.getElementById('new-guest-id');
    const btnAutoSlug = document.getElementById('btn-auto-slug');
    const btnSave = document.getElementById('btn-save-guest');
    const resultArea = document.getElementById('result-link-area');
    const linkInput = document.getElementById('generated-link');
    const btnCopy = document.getElementById('btn-copy-link');
    const guestListBody = document.getElementById('guest-list-body');
    const debugLog = document.getElementById('debug-log');

    // Debug Logger
    const log = (msg, type = "info") => {
        if (!debugLog) return;
        const p = document.createElement('p');
        p.className = `debug-msg ${type}`;
        p.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        debugLog.appendChild(p);
        debugLog.scrollTop = debugLog.scrollHeight;
    };

    log("Admin Tool Loaded. Checking Firebase...", "info");
    if (!db) {
        log("CRITICAL: Firebase DB failed to initialize!", "error");
    } else {
        log("Firebase DB initialized successfully.", "success");
    }

    // Helper to prevent hanging if Firebase is not responding
    const withTimeout = (promise, ms = 8000) => {
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("DATABASE_TIMEOUT")), ms)
        );
        return Promise.race([promise, timeout]);
    };

    // Auto-generate slug from name
    const generateSlug = (name) => {
        return name.toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    };

    if (btnAutoSlug) {
        btnAutoSlug.addEventListener('click', () => {
            idInput.value = generateSlug(nameInput.value);
        });
    }

    if (nameInput) {
        nameInput.addEventListener('input', () => {
            if (!idInput.value) {
                idInput.value = generateSlug(nameInput.value);
            }
        });
    }

    // Save Guest
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const rawName = nameInput.value.trim();
            const rawId = idInput.value.trim();

            const nameResult = validateGuestName(rawName);
            const slugResult = validateSlug(rawId);

            if (!nameResult.valid) {
                alert(nameResult.reason);
                nameInput.focus();
                return;
            }
            if (!slugResult.valid) {
                alert(slugResult.reason);
                idInput.focus();
                return;
            }

            const name = nameResult.value;
            const id = slugResult.value;

            try {
                log("Saving guest: " + id, "info");
                btnSave.innerText = 'SAVING...';
                btnSave.disabled = true;

                await withTimeout(setDoc(doc(db, "guests", id), {
                    name: name,
                    status: "Not Responded",
                    partyCount: 0,
                    timestamp: new Date().toISOString()
                }));

                log("Guest saved successfully to Firebase!", "success");
                
                // CLEAR INPUTS after success
                nameInput.value = '';
                idInput.value = '';

                const baseUrl = window.location.href.split('admin.html')[0];
                const finalLink = `${baseUrl}?guest=${id}`;
                
                linkInput.value = finalLink;
                resultArea.classList.remove('hidden');
                
                btnSave.innerText = 'GENERATE & SAVE LINK';
                btnSave.disabled = false;
                
                loadGuests(); // Refresh list
            } catch (e) {
                // Generic error — never expose Firebase internals to the UI
                console.warn('Admin save failed.');
                btnSave.innerText = 'GENERATE & SAVE LINK';
                btnSave.disabled = false;
                alert('⚠️ Could not save guest. Please check your connection and try again.');
            }
        });
    }

    // Copy Link
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            linkInput.select();
            document.execCommand('copy');
            btnCopy.innerText = 'COPIED!';
            setTimeout(() => btnCopy.innerText = 'COPY', 2000);
        });
    }

    // Load Guests
    const loadGuests = async () => {
        if (!guestListBody) return;
        guestListBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
        
        try {
            log("Fetching guest list from Firestore...", "info");
            const querySnapshot = await withTimeout(getDocs(collection(db, "guests")));
            log("Fetch complete. Found " + querySnapshot.size + " docs.", "success");
            guestListBody.innerHTML = '';
            
            const guests = [];
            querySnapshot.forEach((docSnap) => {
                guests.push({ id: docSnap.id, ...docSnap.data() });
            });

            if (guests.length === 0) {
                guestListBody.innerHTML = '<tr><td colspan="5">No guests found yet. Add your first guest above!</td></tr>';
                return;
            }

            // Sort by timestamp (newest first)
            guests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Stats calculation variables
            let totalInvites = guests.length;
            let pending = 0;
            let responses = 0;
            let attending = 0;
            let totalHeadcount = 0;

            guests.forEach((guest) => {
                // Calculate stats
                if (!guest.status || guest.status === 'Not Responded' || guest.status === 'Pending') {
                    pending++;
                } else if (guest.status === 'Attending' || guest.status === 'Not Attending') {
                    responses++;
                    if (guest.status === 'Attending') {
                        attending++;
                        totalHeadcount += (parseInt(guest.partyCount) || 0);
                    }
                }

                const tr = document.createElement('tr');
                
                let statusClass = 'status-pending';
                if (guest.status === 'Attending') statusClass = 'status-yes';
                if (guest.status === 'Not Attending') statusClass = 'status-no';

                tr.innerHTML = `
                    <td>${guest.name}</td>
                    <td><code>${guest.id}</code></td>
                    <td><span class="status-badge ${statusClass}">${guest.status || 'Pending'}</span></td>
                    <td>${guest.partyCount || 0}</td>
                    <td>
                        <button class="btn-sm btn-copy-row" data-id="${guest.id}">LINK</button>
                        <button class="btn-sm btn-delete" data-id="${guest.id}">DEL</button>
                    </td>
                `;
                guestListBody.appendChild(tr);
            });

            // Update Stats UI
            const updateStat = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            };

            updateStat('stat-total-invites', totalInvites);
            updateStat('stat-pending', pending);
            updateStat('stat-responses', responses);
            updateStat('stat-attending', attending);
            updateStat('stat-total-headcount', totalHeadcount);

            // Add events to row buttons
            document.querySelectorAll('.btn-copy-row').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const baseUrl = window.location.href.split('admin.html')[0];
                    const link = `${baseUrl}?guest=${id}`;
                    navigator.clipboard.writeText(link);
                    btn.innerText = 'OK!';
                    setTimeout(() => btn.innerText = 'LINK', 2000);
                });
            });

            document.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Delete this guest?')) {
                        const id = btn.getAttribute('data-id');
                        await deleteDoc(doc(db, "guests", id));
                        loadGuests();
                    }
                });
            });

        } catch (e) {
            log("Fetch ERROR: " + e.message, "error");
            if (e.message === "DATABASE_TIMEOUT") {
                guestListBody.innerHTML = '<tr><td colspan="5" style="color:#cc0000">⚠️ TIMEOUT: Could not reach Firebase. Check your console.</td></tr>';
            } else {
                guestListBody.innerHTML = '<tr><td colspan="5" style="color:#cc0000">⚠️ ERROR: ' + e.message + '</td></tr>';
            }
        }
    };

    // Only load if already authenticated, otherwise handleLogin will trigger it
    if (sessionStorage.getItem('admin_authenticated') === 'true') {
        loadGuests();
    }
});
