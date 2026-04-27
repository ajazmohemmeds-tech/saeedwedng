import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc, collection, addDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";


// ─── Security Utilities ──────────────────────────────────────────────────────
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim();
}

function validateName(name) {
    const s = sanitize(name);
    if (!s) return { valid: false, reason: 'Name is required.' };
    if (s.length > 80) return { valid: false, reason: 'Name is too long.' };
    if (!/^[\p{L}\s\-'&.,]+$/u.test(s)) return { valid: false, reason: 'Name contains invalid characters.' };
    return { valid: true, reason: '' };
}

function createRateLimiter(key, maxCalls, windowMs) {
    return function() {
        const now = Date.now();
        const raw = sessionStorage.getItem(key);
        let log = raw ? JSON.parse(raw) : [];
        log = log.filter(ts => now - ts < windowMs);
        if (log.length >= maxCalls) return false;
        log.push(now);
        sessionStorage.setItem(key, JSON.stringify(log));
        return true;
    };
}
const rsvpRateOk = createRateLimiter('rsvp_rate', 3, 10 * 60 * 1000);

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Cache Busting System ────────────────────────────────────────────────────
(async () => {
    try {
        const snap = await getDoc(doc(db, "config", "app"));
        if (snap.exists()) {
            const v = snap.data().version;
            const lv = sessionStorage.getItem('data_version');
            if (lv && parseInt(lv) < v) {
                console.log("New version detected. Busting cache...");
                sessionStorage.clear();
                sessionStorage.setItem('data_version', v);
                window.location.reload();
            } else {
                sessionStorage.setItem('data_version', v);
            }
        }
    } catch(e) {}
})();



const urlParams = new URLSearchParams(window.location.search);
const guestId = urlParams.get('guest');
let currentGuestData = null;

// ─── Analytics Tracking ──────────────────────────────────────────────────────
let sessionStartTime = Date.now();
const trackVisit = (async () => {
    try {
        const ua = navigator.userAgent;
        let device = "Desktop";
        if (/tablet|ipad|playbook|silk/i.test(ua)) device = "Tablet";
        else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera Mini/i.test(ua)) device = "Mobile";

        // Track initial hit
        const visitRef = await addDoc(collection(db, "visits"), {
            guestId: guestId || "anonymous",
            device: device,
            timestamp: serverTimestamp(),
            url: window.location.href,
            interactions: [],
            duration: 0
        });

        // Update presence for specific guest
        if (guestId) {
            await updateDoc(doc(db, "guests", guestId), {
                lastActive: serverTimestamp()
            });
        }

        // Track interactions
        const logInteraction = async (type) => {
            try {
                await updateDoc(visitRef, {
                    interactions: arrayUnion({ type, time: Date.now() })
                });
            } catch(e) {}
        };

        // Event listeners for engagement
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button, a, .interactive-el');
            if (target) {
                logInteraction(target.id || target.innerText.substring(0, 20));
            }
        });

        // Update duration periodically or on leave
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                const duration = Math.round((Date.now() - sessionStartTime) / 1000);
                updateDoc(visitRef, { duration: duration });
            }
        });

    } catch (e) {
        console.warn("Analytics error:", e);
    }
})();

const guestDataPromise = (async () => {
    if (!guestId) return null;
    const cacheKey = `guest_${guestId}`;
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            currentGuestData = JSON.parse(cached);
            return currentGuestData;
        }
    } catch (_) {}

    try {
        const guestSnap = await getDoc(doc(db, "guests", guestId));
        if (guestSnap.exists()) {
            currentGuestData = guestSnap.data();
            try { sessionStorage.setItem(cacheKey, JSON.stringify(currentGuestData)); } catch (_) {}
            return currentGuestData;
        }
    } catch (e) {
        console.warn("Could not load invitation data.");
    }
    return null;
})();

async function injectGuestName() {
    const data = await guestDataPromise;
    if (data) {
        const greetingContainer = document.getElementById('personalized-greeting');
        if (greetingContainer) {
            const safeName = sanitize(data.name);
            greetingContainer.innerHTML = `<p class="guest-subtitle">EXCLUSIVE INVITATION FOR</p><h2 class="guest-name">${safeName.toUpperCase()}</h2>`;
        }
        const nameInput = document.getElementById('guest-name-input');
        if (nameInput) nameInput.value = sanitize(data.name);
    }
}
document.addEventListener("DOMContentLoaded", injectGuestName);

function showPersonalizedGreeting() {
    const greetingContainer = document.getElementById('personalized-greeting');
    if (greetingContainer && currentGuestData) {
        greetingContainer.classList.remove('hidden');
        greetingContainer.classList.add('visible');
    }
}

// 0. Auto-Scroll for Mobile Inactivity (Tour Mode)
function initAutoScroll() {
    if (window.innerWidth > 768) return; 

    const sections = [
        '#verse-card',
        '#schedule',
        '#venue',
        '#countdown-section',
        '#rsvp',
        '.luxury-footer',
        '#rsvp'
    ];
    let currentStep = 0;
    let autoScrollTimeout;
    let isTourActive = false;

    const startTour = () => {
        if (currentStep >= sections.length) {
            isTourActive = false;
            return;
        }
        
        isTourActive = true;
        lenis.scrollTo(sections[currentStep], { 
            duration: 2.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            onComplete: () => {
                currentStep++;
                if (currentStep < sections.length) {
                    // Wait 3 seconds at current section before scrolling to next
                    autoScrollTimeout = setTimeout(startTour, 3000);
                } else {
                    isTourActive = false;
                }
            }
        });
    };

    const cancelAutoScroll = (e) => {
        // Clear all timeouts and stop the tour
        clearTimeout(autoScrollTimeout);
        isTourActive = false;
        
        // Remove listeners to clean up
        window.removeEventListener('touchstart', cancelAutoScroll);
        window.removeEventListener('wheel', cancelAutoScroll);
        window.removeEventListener('mousedown', cancelAutoScroll);
    };

    // Initial wait: 4 seconds in the Hero section
    autoScrollTimeout = setTimeout(() => {
        if (window.scrollY < 50) {
            startTour();
        }
    }, 4000);

    // Manual interaction (touch, wheel, click) cancels the tour
    window.addEventListener('touchstart', cancelAutoScroll, { passive: true });
    window.addEventListener('wheel', cancelAutoScroll, { passive: true });
    window.addEventListener('mousedown', cancelAutoScroll, { passive: true });
}

// 1. Loading Screen Handler
const loader = document.getElementById('loading-screen');
if (loader) {
    setTimeout(() => {
        loader.style.transition = 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 1.5s';
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        const heroVid = document.querySelector('.hero-video');
        if (heroVid) heroVid.play().catch(e => console.warn("Video failed:", e));
        showPersonalizedGreeting();
        lenis.start();
        document.body.classList.remove('is-loading');
        initAutoScroll();
        setTimeout(() => {
            loader.style.display = 'none';
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
            }, { threshold: 0.1 });
            document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
        }, 1500);
    }, 5500);
}

// 2. Lenis Scroll
const lenis = new Lenis({
    duration: 1.5,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.8,
    lerp: 0.06,
});
const modalLenis = new Lenis({
    wrapper: document.querySelector('.rsvp-modal-card'),
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
});
function raf(time) {
    lenis.raf(time);
    modalLenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
lenis.stop();
modalLenis.stop();

document.addEventListener('DOMContentLoaded', () => {
    // Venue Image Double Click / Double Tap Map (Unified)
    const venueImg = document.getElementById('venue-img');
    if (venueImg) {
        let lastClick = 0;
        const openMap = () => {
            console.log("Opening Map...");
            window.location.href = 'https://maps.app.goo.gl/Yy9LWM3McGCowyZt5?g_st=ic';
        };

        venueImg.addEventListener('click', (e) => {
            const currentTime = Date.now();
            const tapGap = currentTime - lastClick;
            if (tapGap < 350 && tapGap > 0) {
                openMap();
            }
            lastClick = currentTime;
        });
    }
    const targetDate = new Date('May 24, 2026 19:00:00').getTime();
    function updateCountdown() {
        const now = new Date().getTime();
        const distance = targetDate - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        const fill = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val.toString().padStart(2, '0'); };
        fill('days', days); fill('m-days', days);
        fill('hours', hours); fill('m-hours', hours);
        fill('minutes', minutes); fill('m-minutes', minutes);
        fill('seconds', seconds); fill('m-seconds', seconds);
    }
    setInterval(updateCountdown, 1000);
    updateCountdown();

    const btnYes = document.getElementById('btn-yes');
    const btnNo = document.getElementById('btn-no');
    const modalScreen = document.getElementById('rsvp-modal-screen');
    const rsvpStep1 = document.getElementById('rsvp-step-1');
    const rsvpStep2 = document.getElementById('rsvp-step-2');
    const modalBackBtn = document.getElementById('modal-back-btn');
    const submitRsvpFinal = document.getElementById('submit-rsvp-final');
    const btnEditResponse = document.getElementById('btn-edit-response');
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    const familyCountEl = document.getElementById('family-count');
    let familyCount = parseInt(localStorage.getItem('last_family_count')) || 1;
    if(familyCountEl) familyCountEl.innerText = familyCount;

    if (btnMinus && btnPlus) {
        btnMinus.addEventListener('click', () => { if (familyCount > 1) { familyCount--; familyCountEl.innerText = familyCount; } });
        btnPlus.addEventListener('click', () => { if (familyCount < 10) { familyCount++; familyCountEl.innerText = familyCount; } });
    }

    const celebrationAudio = new Audio('celebration.mp3');
    celebrationAudio.loop = true;
    let isMuted = localStorage.getItem('music_muted') === 'true';
    const musicToggle = document.getElementById('music-toggle');
    function updateMusicUI() {
        if (!musicToggle) return;
        const iconOn = musicToggle.querySelector('.icon-on'), iconOff = musicToggle.querySelector('.icon-off');
        if (isMuted) { musicToggle.classList.add('muted'); iconOn.classList.add('hidden'); iconOff.classList.remove('hidden'); }
        else { musicToggle.classList.remove('muted'); iconOn.classList.remove('hidden'); iconOff.classList.add('hidden'); }
    }
    updateMusicUI();

    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            isMuted = !isMuted; localStorage.setItem('music_muted', isMuted);
            updateMusicUI();
            if (isMuted) celebrationAudio.pause();
            else if (!modalScreen.classList.contains('hidden') && document.getElementById('rsvp-step-3').classList.contains('hidden')) celebrationAudio.play().catch(() => {});
        });
    }

    if (btnYes && btnNo) {
        btnYes.addEventListener('click', () => {
            lenis.stop(); document.body.classList.add('no-scroll');
            modalScreen.classList.remove('hidden');
            rsvpStep1.classList.remove('hidden'); rsvpStep1.style.opacity = '1';
            rsvpStep2.classList.add('hidden'); document.getElementById('rsvp-step-3').classList.add('hidden');
            modalLenis.start();
            if (modalBackBtn) modalBackBtn.style.display = 'none';
            if (musicToggle) musicToggle.classList.remove('hidden');
            resizeCanvas(); setTimeout(() => window.showCelebration(), 150);
            if (!isMuted) { celebrationAudio.currentTime = 0; celebrationAudio.play().catch(() => {}); }
        });
        btnNo.addEventListener('click', async () => {
            lenis.stop(); document.body.classList.add('no-scroll');
            if (rsvpRateOk() && guestId && currentGuestData) {
                try { await updateDoc(doc(db, "guests", guestId), { status: "Not Attending", partyCount: 0, timestamp: new Date().toISOString() }); } catch(e) {}
            }
            modalScreen.classList.remove('hidden');
            rsvpStep1.classList.add('hidden'); rsvpStep2.classList.add('hidden');
            document.getElementById('rsvp-step-3').classList.remove('hidden');
            if (modalBackBtn) modalBackBtn.style.display = 'none';
            modalLenis.start(); resizeCanvas();
            if (musicToggle) musicToggle.classList.add('hidden');
        });
    }

    if (btnEditResponse) {
        btnEditResponse.addEventListener('click', () => {
            rsvpStep2.classList.add('hidden'); document.getElementById('rsvp-step-3').classList.add('hidden');
            rsvpStep1.classList.remove('hidden'); rsvpStep1.style.opacity = '1';
        });
    }

    if (submitRsvpFinal) {
        submitRsvpFinal.addEventListener('click', async () => {
            const nameInput = document.getElementById('guest-name-input'), nameError = document.getElementById('name-error');
            const guestName = sanitize(nameInput ? nameInput.value : "");
            const honeypot = document.getElementById('_rsvp_trap');
            if (honeypot && honeypot.value) return;
            if (!rsvpRateOk()) { if (nameError) { nameError.textContent = 'Too many submissions. Please wait.'; nameError.classList.remove('hidden'); } return; }
            const nameCheck = validateName(guestName);
            if (!nameCheck.valid) {
                if (nameInput) { nameInput.classList.add('invalid'); nameInput.focus(); }
                if (nameError) { nameError.textContent = nameCheck.reason; nameError.classList.remove('hidden'); }
                return;
            }
            submitRsvpFinal.innerText = "SAVING..."; submitRsvpFinal.disabled = true; rsvpStep1.style.opacity = '0';
            
            const finalPartyCount = Math.min(Math.max(parseInt(familyCount) || 1, 1), 10); // Enforce 1-10 range
            
            const save = async () => {
                const payload = { 
                    name: guestName, 
                    status: "Attending", 
                    partyCount: finalPartyCount, 
                    timestamp: new Date().toISOString() 
                };
                try {
                    if (guestId && currentGuestData) {
                        // Double check identity: Ensure we don't overwrite if guest name changed maliciously
                        if (currentGuestData.name === guestName || currentGuestData.isGeneral) {
                            await updateDoc(doc(db, "guests", guestId), payload);
                        } else {
                            throw new Error("Identity mismatch");
                        }
                    }
                    else await setDoc(doc(db, "guests", "walk-in-" + Date.now()), { ...payload, isGeneral: true });
                } catch(e) {
                    console.error("RSVP Error:", e);
                    alert("⚠️ Submission failed. Please try again or contact the hosts.");
                    submitRsvpFinal.innerText = "SUBMIT RSVP"; 
                    submitRsvpFinal.disabled = false; 
                    rsvpStep1.style.opacity = '1';
                    return;
                }
            };
            save();
            localStorage.setItem('last_family_count', familyCount);
            setTimeout(() => {
                rsvpStep1.classList.add('hidden'); rsvpStep2.classList.remove('hidden');
                submitRsvpFinal.innerText = "SUBMIT RSVP"; submitRsvpFinal.disabled = false;
                resizeCanvas(); triggerBurst();
            }, 400);
        });
    }

    const canvas = document.getElementById('confetti-canvas'), fCanvas = document.getElementById('foreground-canvas');
    let ctx, fCtx, particles = [], fParticles = [], celebrationStartTime = 0, celebrationIntensity = 1;
    function resizeCanvas() {
        if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        if (fCanvas) { fCanvas.width = window.innerWidth; fCanvas.height = window.innerHeight; }
    }
    if (canvas) { ctx = canvas.getContext('2d'); fCtx = fCanvas ? fCanvas.getContext('2d') : null; resizeCanvas(); window.addEventListener('resize', resizeCanvas); }

    class Particle {
        constructor(isBurst = false, isForeground = false) {
            this.isBurst = isBurst; this.isForeground = isForeground;
            this.x = Math.random() * (canvas ? canvas.width : window.innerWidth);
            this.y = isBurst ? (canvas ? canvas.height + 20 : window.innerHeight) : -10;
            this.size = isForeground ? Math.random() * 8 + 5 : Math.random() * 5 + 3;
            this.color = isForeground ? '#C5A059' : ['#557A54', '#8A7F72', '#EBE5D9'][Math.floor(Math.random() * 3)];
            this.speedX = isBurst ? Math.random() * 10 - 5 : Math.random() * 2 - 1;
            this.speedY = isBurst ? -(Math.random() * 12 + 6) : Math.random() * 3 + 2;
            this.opacity = 1; this.rotation = Math.random() * 360; this.rotationSpeed = isBurst ? Math.random() * 10 - 5 : Math.random() * 2 - 1;
            this.gravity = isBurst ? 0.2 : 0;
        }
        update() {
            this.y += this.speedY; this.x += this.speedX; this.rotation += this.rotationSpeed;
            if (this.isBurst) { this.speedY += this.gravity; this.opacity -= 0.008; }
            else if (this.y > (canvas ? canvas.height : window.innerHeight)) {
                if (Math.random() < celebrationIntensity) { this.y = -10; this.x = Math.random() * (canvas ? canvas.width : window.innerWidth); }
                else this.opacity = 0;
            }
        }
        draw(targetCtx) {
            if (this.opacity <= 0 || !targetCtx) return;
            targetCtx.save(); targetCtx.globalAlpha = this.opacity; targetCtx.fillStyle = this.color;
            targetCtx.translate(this.x, this.y); targetCtx.rotate(this.rotation * Math.PI / 180);
            targetCtx.beginPath(); targetCtx.moveTo(0, -this.size); targetCtx.quadraticCurveTo(this.size, 0, 0, this.size); targetCtx.quadraticCurveTo(-this.size, 0, 0, -this.size); targetCtx.fill(); targetCtx.restore();
        }
    }
    class Firework {
        constructor(x, y) {
            this.x = x; this.y = y; this.particles = [];
            for (let i = 0; i < 30; i++) this.particles.push({ x: this.x, y: this.y, vx: Math.cos(i) * (Math.random() * 10 + 5), vy: Math.sin(i) * (Math.random() * 10 + 5), color: `hsl(${Math.random() * 360}, 70%, 60%)`, opacity: 1, size: Math.random() * 3 + 1 });
        }
        update() { this.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.opacity -= 0.015; }); this.particles = this.particles.filter(p => p.opacity > 0); }
        draw(targetCtx) { this.particles.forEach(p => { targetCtx.save(); targetCtx.globalAlpha = p.opacity; targetCtx.fillStyle = p.color; targetCtx.beginPath(); targetCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2); targetCtx.fill(); targetCtx.restore(); }); }
    }
    function triggerBurst() {
        celebrationStartTime = Date.now();
        for (let i = 0; i < 40; i++) particles.push(new Firework(Math.random() * canvas.width, canvas.height));
        for (let i = 0; i < 20; i++) fParticles.push(new Particle(true, true));
    }
    function animateConfetti() {
        if (!ctx) return; ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (fCtx) fCtx.clearRect(0, 0, fCanvas.width, fCanvas.height);
        particles.forEach(p => { p.update(); p.draw(ctx); });
        fParticles.forEach(p => { p.update(); p.draw(fCtx); });
        if (!modalScreen.classList.contains('hidden')) {
            const elapsed = (Date.now() - celebrationStartTime) / 1000;
            celebrationIntensity = elapsed < 3 ? 1 : Math.max(0, 1 - (elapsed - 3) / 12);
            particles = particles.filter(p => p instanceof Firework ? p.particles.length > 0 : p.opacity > 0);
            fParticles = fParticles.filter(p => p.opacity > 0);
            if (Math.random() < (0.03 * celebrationIntensity)) particles.push(new Firework(Math.random() * canvas.width, Math.random() * canvas.height * 0.5));
            requestAnimationFrame(animateConfetti);
        }
    }
    window.showCelebration = () => { celebrationStartTime = Date.now(); particles = []; fParticles = []; for (let i = 0; i < 100; i++) particles.push(new Particle()); animateConfetti(); };

    const btnChangeMind = document.getElementById('btn-change-mind');
    if (btnChangeMind) btnChangeMind.addEventListener('click', () => { document.getElementById('rsvp-step-3').classList.add('hidden'); rsvpStep1.classList.remove('hidden'); rsvpStep1.style.opacity = '1'; });
});
