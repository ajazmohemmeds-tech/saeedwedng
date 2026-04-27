import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc, onSnapshot, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app-check.js";

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const formatHour = (h) => {
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${ampm}`;
};

// --- Global Charts ---
let trendChart = null, trendChartStats = null;
let rsvpChart = null, rsvpChartStats = null;
let deviceChart = null, sparkline = null, deviceTrendChart = null;
let currentRange = '24h';
let sparkData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const log = (msg, type = "info") => {
    const debugLog = document.getElementById('debug-log');
    if (!debugLog) return;
    const p = document.createElement('p');
    p.className = `debug-msg ${type}`;
    const content = typeof msg === 'string' ? msg : JSON.stringify(msg);
    p.innerText = `> [${new Date().toLocaleTimeString()}] ${content}`;
    debugLog.appendChild(p);
    debugLog.scrollTop = debugLog.scrollHeight;
};

// Global Log Interceptor
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
    originalLog(...args);
    log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'info');
};
console.error = (...args) => {
    originalError(...args);
    log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error');
};
console.warn = (...args) => {
    originalWarn(...args);
    log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'warn');
};

// ─── Chart Initializers ──────────────────────────────────────────────────────

function initCharts() {
    const trendConfig = {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Guests', data: [], borderColor: '#C5A059', backgroundColor: 'rgba(197, 160, 89, 0.1)', fill: true, tension: 0.4 }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', titleFont: { size: 10 }, bodyFont: { size: 12 }, padding: 10, displayColors: false }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(226, 232, 240, 0.5)' }, 
                    ticks: { precision: 0, font: { size: 10, weight: '600' }, color: '#64748b' },
                    title: { display: true, text: 'NUMBER OF GUESTS', font: { size: 9, weight: '800' }, color: '#94a3b8', padding: { bottom: 10 } }
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { font: { size: 10, weight: '600' }, color: '#64748b' },
                    title: { display: true, text: 'TIME IN HOURS', font: { size: 9, weight: '800' }, color: '#94a3b8', padding: { top: 10 } }
                }
            }
        }
    };
    
    const rsvpRadarConfig = {
        type: 'radar',
        data: {
            labels: ['Accepted', 'Pending', 'Declined'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: 'rgba(49, 130, 206, 0.15)',
                borderColor: '#3182ce',
                borderWidth: 2,
                pointBackgroundColor: '#3182ce',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(163, 177, 198, 0.3)' },
                    grid: { color: 'rgba(163, 177, 198, 0.3)' },
                    suggestedMin: 0,
                    ticks: { display: false }
                }
            },
            plugins: { legend: { display: false } }
        }
    };

    // Overview Charts
    trendChart = new Chart(document.getElementById('visitorTrendChart'), JSON.parse(JSON.stringify(trendConfig)));
    rsvpChart = new Chart(document.getElementById('rsvpRadarChart'), JSON.parse(JSON.stringify(rsvpRadarConfig)));

    // Statistics Charts (Duplicates for full view)
    trendChartStats = new Chart(document.getElementById('visitorTrendChartStats'), JSON.parse(JSON.stringify(trendConfig)));
    rsvpChartStats = new Chart(document.getElementById('rsvpRadarChartStats'), JSON.parse(JSON.stringify(rsvpRadarConfig)));

    // Unique Statistics Charts
    const deviceCtx = document.getElementById('deviceDonutChart');
    if (deviceCtx) {
        deviceChart = new Chart(deviceCtx, {
            type: 'doughnut',
            data: { labels: ['Desktop', 'Mobile', 'Tablet'], datasets: [{ data: [0,0,0], backgroundColor: ['#0f172a', '#3182ce', '#cbd5e0'], borderWidth: 0, hoverOffset: 4 }] },
            options: { cutout: '75%', spacing: 5, borderRadius: 2, plugins: { legend: { display: false } } }
        });
    }

    sparkline = new Chart(document.getElementById('liveSparkline'), {
        type: 'line',
        data: { labels: sparkData.map((_,i)=>i), datasets: [{ data: sparkData, borderColor: '#27ae60', borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
    });

    const dtCtx = document.getElementById('deviceTrendChart')?.getContext('2d');
    if (dtCtx) {
        const createGradient = (color) => {
            const g = dtCtx.createLinearGradient(0, 0, 0, 240);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            return g;
        };
        
        deviceTrendChart = new Chart(dtCtx, {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [
                    { label: 'Desktop', data: [], borderColor: '#0f172a', backgroundColor: createGradient('rgba(15, 23, 42, 0.3)'), fill: true, tension: 0.4 },
                    { label: 'Mobile', data: [], borderColor: '#3182ce', backgroundColor: createGradient('rgba(49, 130, 206, 0.3)'), fill: true, tension: 0.4 },
                    { label: 'Tablet', data: [], borderColor: '#cbd5e0', backgroundColor: createGradient('rgba(203, 213, 224, 0.3)'), fill: true, tension: 0.4 }
                ] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { 
                    y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(226, 232, 240, 0.5)' } }, 
                    x: { grid: { display: false } } 
                } 
            }
        });
    }
}

function drawMetricProgress(canvasId, val, max, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 15;
    const percentage = max > 0 ? val / max : 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(163, 177, 198, 0.2)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Progress Ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * percentage));
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
}

// ─── Real-time Listeners ─────────────────────────────────────────────────────

function setupRealtimeStats() {
    onSnapshot(collection(db, "guests"), (snapshot) => {
        let sent = 0, attending = 0, pending = 0, declined = 0, totalHeadcount = 0;
        snapshot.forEach(docSnap => {
            if (docSnap.id === "config") return;
            const data = docSnap.data();
            sent++;
            if (data.status === 'Attending') { attending++; totalHeadcount += (parseInt(data.partyCount) || 1); }
            else if (data.status === 'Not Attending') declined++;
            else pending++;
        });

        document.getElementById('stat-total-invites').innerText = sent;
        document.getElementById('stat-pending').innerText = pending;
        document.getElementById('stat-responses').innerText = attending + declined;
        document.getElementById('stat-attending').innerText = attending;
        document.getElementById('stat-total-headcount').innerText = totalHeadcount;
        document.getElementById('funnel-sent').innerText = sent;

        const responded = attending + declined;
        const pendingEl = document.getElementById('funnel-pending');
        if (pendingEl) {
            pendingEl.innerText = pending;
            document.getElementById('funnel-pending-perc').innerText = `${sent > 0 ? Math.round((pending/sent)*100) : 0}%`;
        }
        const rsvpEl = document.getElementById('funnel-rsvp');
        if (rsvpEl) {
            rsvpEl.innerText = responded;
            document.getElementById('funnel-rsvp-perc').innerText = `${sent > 0 ? Math.round((responded/sent)*100) : 0}%`;
        }

        document.getElementById('val-accepted').innerText = attending;
        document.getElementById('val-pending').innerText = pending;
        document.getElementById('val-declined').innerText = declined;

        document.querySelectorAll('.val-total-invites').forEach(el => el.innerText = sent);

        drawMetricProgress('progressAccepted', attending, sent, '#3182ce');
        drawMetricProgress('progressPending', pending, sent, '#a0aec0');
        drawMetricProgress('progressDeclined', declined, sent, '#cbd5e0');

        [rsvpChart, rsvpChartStats].forEach(c => {
            if (c) {
                c.data.datasets[0].data = [attending, pending, declined];
                c.update();
            }
        });
        
        
        renderGuestTable(snapshot);
    });

    onSnapshot(collection(db, "visits"), (snapshot) => {
        let mobile = 0, desktop = 0, tablet = 0;
        let totalDuration = 0, visitsWithInteraction = 0;
        const hourlyData = {}, dailyData = {};
        const deviceHourly = { Mobile: {}, Desktop: {}, Tablet: {} };

        snapshot.forEach(docSnap => {
            const v = docSnap.data();
            if (v.device === 'Mobile') mobile++;
            else if (v.device === 'Tablet') tablet++;
            else desktop++;

            if (v.duration) totalDuration += v.duration;
            if (v.interactions && v.interactions.length > 0) visitsWithInteraction++;

            if (v.timestamp) {
                const date = v.timestamp.toMillis();
                const h = new Date(date).getHours();
                const d = new Date(date).toDateString();
                hourlyData[h] = (hourlyData[h] || 0) + 1;
                dailyData[d] = (dailyData[d] || 0) + 1;
                
                const devKey = v.device === 'Mobile' ? 'Mobile' : (v.device === 'Tablet' ? 'Tablet' : 'Desktop');
                deviceHourly[devKey][h] = (deviceHourly[devKey][h] || 0) + 1;
            }
        });

        if (deviceChart) {
            deviceChart.data.datasets[0].data = [desktop, mobile, tablet];
            deviceChart.update();
        }

        const trendLabels = currentRange === '24h' 
            ? Object.keys(hourlyData).sort((a,b)=>a-b).map(h=>formatHour(h))
            : Object.keys(dailyData).reverse();
        const trendValues = currentRange === '24h'
            ? Object.keys(hourlyData).sort((a,b)=>a-b).map(h=>hourlyData[h])
            : Object.keys(dailyData).reverse().map(d=>dailyData[d]);

        [trendChart, trendChartStats].forEach(c => {
            if (c) {
                c.data.labels = trendLabels;
                c.data.datasets[0].data = trendValues;
                c.update();
            }
        });

        if (deviceTrendChart) {
            const hours = Object.keys(hourlyData).sort((a,b)=>a-b);
            deviceTrendChart.data.labels = hours.map(h=>formatHour(h));
            deviceTrendChart.data.datasets[0].data = hours.map(h => deviceHourly.Desktop[h] || 0);
            deviceTrendChart.data.datasets[1].data = hours.map(h => deviceHourly.Mobile[h] || 0);
            deviceTrendChart.data.datasets[2].data = hours.map(h => deviceHourly.Tablet[h] || 0);
            deviceTrendChart.update();
        }

        const totalVisits = snapshot.size;

        document.getElementById('kpi-avg-time').innerText = `${totalVisits > 0 ? Math.round(totalDuration/totalVisits) : 0}s`;
        document.getElementById('kpi-click-rate').innerText = `${totalVisits > 0 ? Math.round((visitsWithInteraction/totalVisits)*100) : 0}%`;
        document.getElementById('kpi-bounce-rate').innerText = `${totalVisits > 0 ? Math.round(((totalVisits - visitsWithInteraction)/totalVisits)*100) : 0}%`;

        const active = Math.floor(Math.random() * 3); // Presence simulation
        document.getElementById('live-visitor-count').innerText = `${active} ACTIVE NOW`;
        sparkData.shift();
        sparkData.push(active);
        if (sparkline) sparkline.update();

        renderVisitorTable(snapshot);
    });
}

function renderVisitorTable(snapshot) {
    const body = document.getElementById('visitor-log-body');
    if (!body) return;
    body.innerHTML = '';
    const visits = [];
    snapshot.forEach(s => { visits.push({id: s.id, ...s.data()}); });
    
    // Sort by timestamp (newest first)
    visits.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime() || 0;
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime() || 0;
        return timeB - timeA;
    });

    visits.slice(0, 50).forEach(v => {
        const tr = document.createElement('tr');
        const time = v.timestamp ? new Date(v.timestamp.toMillis()).toLocaleTimeString() : '...';
        tr.innerHTML = `
            <td><code>${v.guestId || 'anon'}</code></td>
            <td style="font-size:0.7rem">${v.device || 'PC'}</td>
            <td>${v.duration || 0}s</td>
            <td>${v.interactions?.length || 0}</td>
            <td style="font-size:0.7rem">${time}</td>
        `;
        body.appendChild(tr);
    });
}

function renderGuestTable(snapshot) {
    const body = document.getElementById('guest-list-body');
    if (!body) return;
    body.innerHTML = '';
    const guests = [];
    snapshot.forEach(s => { if(s.id !== "config") guests.push({id: s.id, ...s.data()}); });
    guests.sort((a, b) => {
        const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime() || 0;
        const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime() || 0;
        return timeB - timeA;
    });
    console.log(`Rendering ${guests.length} guests`);

    guests.forEach((guest) => {
        const tr = document.createElement('tr');
        let statusClass = 'status-pending';
        if (guest.status === 'Attending') statusClass = 'status-yes';
        if (guest.status === 'Not Attending') statusClass = 'status-no';
        tr.innerHTML = `
            <td>${guest.name || guest.guestName || guest.id}</td>
            <td><code>${guest.id}</code></td>
            <td><span class="status-badge ${statusClass}">${guest.status || 'Pending'}</span></td>
            <td>${guest.partyCount || 0}</td>
            <td>
                <button class="btn-micro btn-copy-row" data-id="${guest.id}">LINK</button>
                <button class="btn-micro btn-delete" data-id="${guest.id}" style="color:red">DEL</button>
            </td>
        `;
        body.appendChild(tr);
    });
}

// Attach event delegation for the guest list body once
document.addEventListener('DOMContentLoaded', () => {
    const guestListBody = document.getElementById('guest-list-body');
    if (guestListBody) {
        guestListBody.addEventListener('click', async (e) => {
            const copyBtn = e.target.closest('.btn-copy-row');
            if (copyBtn) {
                const guestId = copyBtn.dataset.id;
                const baseUrl = window.location.href.split('admin.html')[0];
                navigator.clipboard.writeText(`${baseUrl}?guest=${guestId}`);
                copyBtn.innerText = 'COPIED';
                setTimeout(() => copyBtn.innerText = 'LINK', 2000);
                return;
            }

            const delBtn = e.target.closest('.btn-delete');
            if (delBtn) {
                const guestId = delBtn.dataset.id;
                if (confirm(`Are you sure you want to delete ${guestId}?`)) {
                    try {
                        await deleteDoc(doc(db, "guests", guestId));
                        log(`Successfully deleted guest: ${guestId}`);
                    } catch (err) {
                        log(`Delete Failed: ${err.message}`, 'error');
                        alert(`Firestore Error: ${err.message}`);
                    }
                }
            }
        });
    }
});

function navigateTo(viewId) {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.admin-section');
    navItems.forEach(n => n.classList.toggle('active', n.dataset.view === viewId));
    sections.forEach(s => s.classList.toggle('active', s.id === `view-${viewId}`));
    [trendChart, trendChartStats, rsvpChart, rsvpChartStats, deviceChart].forEach(c => {
        if(c) setTimeout(() => c.resize(), 100);
    });
    // Persist to URL hash
    history.replaceState(null, '', `#${viewId}`);
    sessionStorage.setItem('admin_last_view', viewId);
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.view));
    });

    document.querySelectorAll('.btn-toggle-mini').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-toggle-mini').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRange = btn.dataset.range;
        });
    });

    // Restore last active section from URL hash or sessionStorage
    const hash = window.location.hash.replace('#', '');
    const saved = sessionStorage.getItem('admin_last_view');
    const viewToRestore = hash || saved || 'overview';
    navigateTo(viewToRestore);
}

document.addEventListener('DOMContentLoaded', () => {
    const passcodeBtn = document.getElementById('btn-login');
    const passcodeInput = document.getElementById('admin-passcode');
    const start = () => {
        document.getElementById('admin-login-overlay').classList.add('hidden');
        document.getElementById('main-admin-content').classList.remove('hidden');
        setupNavigation();
        initCharts();
        setupRealtimeStats();
        log('Admin Dashboard initialized successfully', 'success');
        setInterval(() => { if(sparkline) sparkline.update(); }, 5000);
        // Restore section AFTER charts are initialized
        const hash = window.location.hash.replace('#', '');
        const saved = sessionStorage.getItem('admin_last_view');
        if (hash || saved) navigateTo(hash || saved);
    };
    if (sessionStorage.getItem('admin_authenticated') === 'true') start();
    passcodeBtn.addEventListener('click', () => {
        if (passcodeInput.value === ADMIN_CODE) {
            sessionStorage.setItem('admin_authenticated', 'true');
            start();
        } else alert("Incorrect Code");
    });

    document.getElementById('btn-clear-console')?.addEventListener('click', () => {
        const debugLog = document.getElementById('debug-log');
        if (debugLog) debugLog.innerHTML = '';
        log('Console cleared', 'info');
    });

    document.getElementById('new-guest-name')?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        document.getElementById('new-guest-id').value = val;
    });

    document.getElementById('btn-save-guest')?.addEventListener('click', async () => {
        const name = document.getElementById('new-guest-name').value.trim();
        const id = document.getElementById('new-guest-id').value.trim();
        if (!name || !id) return;
        await setDoc(doc(db, "guests", id), { name, status: "Not Responded", partyCount: 0, timestamp: new Date().toISOString() });
        document.getElementById('new-guest-name').value = '';
        document.getElementById('new-guest-id').value = '';
    });

    document.getElementById('btn-cache-bust-overview')?.addEventListener('click', async () => {
        const ref = doc(db, "config", "app");
        const snap = await getDoc(ref);
        const newV = (snap.exists() ? snap.data().version : 0) + 1;
        await setDoc(ref, { version: newV, lastUpdate: new Date().toISOString() }, { merge: true });
        alert("Success");
    });
});
