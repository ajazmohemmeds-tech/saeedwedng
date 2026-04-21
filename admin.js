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

// Initialize Firebase
let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase init error:", e);
}

document.addEventListener('DOMContentLoaded', () => {
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
            const name = nameInput.value.trim();
            const id = idInput.value.trim();

            if (!name || !id) {
                alert('Please enter both name and ID.');
                return;
            }

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

                const baseUrl = window.location.href.split('admin.html')[0];
                const finalLink = `${baseUrl}?guest=${id}`;
                
                linkInput.value = finalLink;
                resultArea.classList.remove('hidden');
                
                btnSave.innerText = 'GENERATE & SAVE LINK';
                btnSave.disabled = false;
                
                loadGuests(); // Refresh list
            } catch (e) {
                console.error("Error saving guest:", e);
                btnSave.innerText = 'GENERATE & SAVE LINK';
                btnSave.disabled = false;

                if (e.message === "DATABASE_TIMEOUT") {
                    alert("⚠️ CONNECTION TIMEOUT: Firebase is not responding. Please check if you have created the 'Firestore Database' in your console and set Rules to 'Test Mode'.");
                } else if (e.code === 'permission-denied') {
                    alert("⚠️ PERMISSION DENIED: Your Firebase rules are blocking the save. Please set your Firestore rules to 'Test Mode'.");
                } else {
                    alert("⚠️ ERROR: " + e.message);
                }
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

            guests.forEach((guest) => {
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

    loadGuests();
});
