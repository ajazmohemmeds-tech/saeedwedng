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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('new-guest-name');
    const idInput = document.getElementById('new-guest-id');
    const btnAutoSlug = document.getElementById('btn-auto-slug');
    const btnSave = document.getElementById('btn-save-guest');
    const resultArea = document.getElementById('result-link-area');
    const linkInput = document.getElementById('generated-link');
    const btnCopy = document.getElementById('btn-copy-link');
    const guestListBody = document.getElementById('guest-list-body');

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
                btnSave.innerText = 'SAVING...';
                btnSave.disabled = true;

                await setDoc(doc(db, "guests", id), {
                    name: name,
                    status: "Not Responded",
                    partyCount: 0,
                    timestamp: new Date().toISOString()
                });

                const baseUrl = window.location.href.split('admin.html')[0];
                const finalLink = `${baseUrl}?guest=${id}`;
                
                linkInput.value = finalLink;
                resultArea.classList.remove('hidden');
                
                btnSave.innerText = 'GENERATE & SAVE LINK';
                btnSave.disabled = false;
                
                loadGuests(); // Refresh list
            } catch (e) {
                console.error("Error saving guest:", e);
                alert("Error saving guest. Check console.");
                btnSave.disabled = false;
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
            const querySnapshot = await getDocs(collection(db, "guests"));
            guestListBody.innerHTML = '';
            
            const guests = [];
            querySnapshot.forEach((docSnap) => {
                guests.push({ id: docSnap.id, ...docSnap.data() });
            });

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
            console.error("Error loading guests:", e);
            guestListBody.innerHTML = '<tr><td colspan="5">Error loading data.</td></tr>';
        }
    };

    loadGuests();
});
