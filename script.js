import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ─── Security Utilities ──────────────────────────────────────────────────────

/**
 * Sanitize a string: strips all HTML tags and trims whitespace.
 * Prevents XSS payloads from reaching Firebase or the DOM.
 */
function sanitize(str) {
    if (typeof str !== 'string') return '';
    // Remove HTML/script tags entirely
    return str.replace(/<[^>]*>/g, '').replace(/[<>"'`]/g, '').trim();
}

/**
 * Validate that a name is non-empty, below max length, and only safe characters.
 * Returns { valid: boolean, reason: string }
 */
function validateName(name) {
    const s = sanitize(name);
    if (!s) return { valid: false, reason: 'Name is required.' };
    if (s.length > 80) return { valid: false, reason: 'Name is too long.' };
    // Allow letters, spaces, hyphens, apostrophes, ampersands — typical name chars
    if (!/^[\p{L}\s\-'&.,]+$/u.test(s)) return { valid: false, reason: 'Name contains invalid characters.' };
    return { valid: true, reason: '' };
}

/** 
 * Rate limiter: allows at most `maxCalls` calls within `windowMs` milliseconds.
 * Uses sessionStorage so it resets when the tab is closed.
 */
function createRateLimiter(key, maxCalls, windowMs) {
    return function() {
        const now = Date.now();
        const raw = sessionStorage.getItem(key);
        let log = raw ? JSON.parse(raw) : [];
        // Prune old entries outside the window
        log = log.filter(ts => now - ts < windowMs);
        if (log.length >= maxCalls) return false; // Rate limit exceeded
        log.push(now);
        sessionStorage.setItem(key, JSON.stringify(log));
        return true;
    };
}

// Allow max 3 RSVP submissions per 10 minutes
const rsvpRateOk = createRateLimiter('rsvp_rate', 3, 10 * 60 * 1000);
// ─────────────────────────────────────────────────────────────────────────────

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

// Check for Unique Guest Invitation Link (`?guest=HashedToken`)
const urlParams = new URLSearchParams(window.location.search);
const guestId = urlParams.get('guest');
let currentGuestData = null;

// Start fetching guest data immediately (parallel to HTML parsing)
// Uses sessionStorage to avoid re-fetching on every reload (scales to 500+ visitors)
const guestDataPromise = (async () => {
    if (!guestId) return null;

    // 1. Try sessionStorage cache first (instant, zero Firebase reads)
    const cacheKey = `guest_${guestId}`;
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            currentGuestData = parsed;
            return parsed;
        }
    } catch (_) { /* ignore parse errors */ }

    // 2. Cache miss — fetch from Firestore
    try {
        const guestRef = doc(db, "guests", guestId);
        const guestSnap = await getDoc(guestRef);
        if (guestSnap.exists()) {
            currentGuestData = guestSnap.data();
            // Cache for this session to prevent repeat reads
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(currentGuestData));
            } catch (_) { /* storage might be full — ignore */ }
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
            // Sanitize name before injecting into DOM to prevent stored XSS
            const safeName = sanitize(data.name);
            const subtitle = document.createElement('p');
            subtitle.className = 'guest-subtitle';
            subtitle.textContent = 'EXCLUSIVE INVITATION FOR';
            const heading = document.createElement('h2');
            heading.className = 'guest-name';
            heading.textContent = safeName.toUpperCase();
            greetingContainer.innerHTML = '';
            greetingContainer.appendChild(subtitle);
            greetingContainer.appendChild(heading);
        }
        const nameInput = document.getElementById('guest-name-input');
        if (nameInput) nameInput.value = sanitize(data.name);
    }
}

// Ensure UI is ready but don't block the fetch
document.addEventListener("DOMContentLoaded", injectGuestName);

function showPersonalizedGreeting() {
    const greetingContainer = document.getElementById('personalized-greeting');
    if (greetingContainer && currentGuestData) {
        greetingContainer.classList.remove('hidden');
        greetingContainer.classList.add('visible');
    }
}

// 1. Loading Screen Handler
const loader = document.getElementById('loading-screen');

// We initiate the deliberate delay immediately to ensure it always finishes in 5s
if (loader) {
    setTimeout(() => {
        loader.style.transition = 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 1.5s';
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        
        // Force hero video to play (Browser compatibility)
        const heroVid = document.querySelector('.hero-video');
        if (heroVid) heroVid.play().catch(e => console.warn("Video play failed:", e));
        
        // Show personalized greeting as soon as loader starts to fade
        showPersonalizedGreeting();
        
        lenis.start(); // Unlock scroll as soon as loader starts fading
        document.body.classList.remove('is-loading'); // Fully enable native scrolling
        
        setTimeout(() => {
            loader.style.display = 'none'; // Remove from DOM after fade
            
            // Intersection Observer for reactive section reveals
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                    }
                });
            }, { threshold: 0.1 });

            document.querySelectorAll('.reveal').forEach(el => {
                revealObserver.observe(el);
            });

            // Ensure hero title is seen
            const heroTitle = document.querySelector('.hero-title');
            if(heroTitle) heroTitle.style.opacity = '1';
        }, 1500);
    }, 1500); // Reduced total loader wait time to make it feel snappier
}

// 2. Initialize Lenis Smooth Scroll (Main Page)
const lenis = new Lenis({
    duration: 1.5, // Increased for a more 'luxury' feel
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.8, // High momentum for mobile
    lerp: 0.06, // Heavier, smoother momentum
});

// 2b. Initialize Lenis for RSVP Modal (Everything smooth!)
const modalLenis = new Lenis({
    wrapper: document.querySelector('.rsvp-modal-card'),
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.5,
});

function raf(time) {
    lenis.raf(time);
    modalLenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
lenis.stop();
modalLenis.stop(); // Keep modal scroll locked until opened

document.addEventListener('DOMContentLoaded', () => {


    // 3. Countdown Timer Logic
    const targetDate = new Date('May 24, 2026 19:00:00').getTime();

    function updateCountdown() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const fillCount = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.innerText = val.toString().padStart(2, '0');
        };

        fillCount('days', days); fillCount('m-days', days);
        fillCount('hours', hours); fillCount('m-hours', hours);
        fillCount('minutes', minutes); fillCount('m-minutes', minutes);
        fillCount('seconds', seconds); fillCount('m-seconds', seconds);
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();

    // 4. RSVP Multi-Step Modal Logic
    const btnYes = document.getElementById('btn-yes');
    const btnNo = document.getElementById('btn-no');
    const countVal = document.getElementById('count-val');
    const rsvpMessage = document.getElementById('rsvp-message');
    
    // Modal Elements
    const modalScreen = document.getElementById('rsvp-modal-screen');
    const rsvpStep1 = document.getElementById('rsvp-step-1');
    const rsvpStep2 = document.getElementById('rsvp-step-2');
    const modalBackBtn = document.getElementById('modal-back-btn');
    const submitRsvpFinal = document.getElementById('submit-rsvp-final');
    const btnEditResponse = document.getElementById('btn-edit-response');
    
    // Counter Elements
    const btnMinus = document.getElementById('btn-minus');
    const btnPlus = document.getElementById('btn-plus');
    const familyCountEl = document.getElementById('family-count');
    // Initialize count to what they had before, or 1
    let familyCount = parseInt(localStorage.getItem('last_family_count')) || 1;
    if(familyCountEl) familyCountEl.innerText = familyCount;

    let totalGuestCount = parseInt(localStorage.getItem('wedding_guest_count')) || 42;
    if(countVal) countVal.innerText = totalGuestCount;

    if (btnMinus && btnPlus) {
        btnMinus.addEventListener('click', () => {
            if (familyCount > 1) {
                familyCount--;
                familyCountEl.innerText = familyCount;
            }
        });
        
        btnPlus.addEventListener('click', () => {
            if (familyCount < 10) {
                familyCount++;
                familyCountEl.innerText = familyCount;
            }
        });
    }

    const celebrationAudio = new Audio('celebration.mp3');
    celebrationAudio.loop = true;
    let isMuted = localStorage.getItem('music_muted') === 'true';
    const musicToggle = document.getElementById('music-toggle');
    
    function updateMusicUI() {
        if (!musicToggle) return;
        const iconOn = musicToggle.querySelector('.icon-on');
        const iconOff = musicToggle.querySelector('.icon-off');
        if (isMuted) {
            musicToggle.classList.add('muted');
            iconOn.classList.add('hidden');
            iconOff.classList.remove('hidden');
        } else {
            musicToggle.classList.remove('muted');
            iconOn.classList.remove('hidden');
            iconOff.classList.add('hidden');
        }
    }
    
    updateMusicUI();

    if (musicToggle) {
        musicToggle.addEventListener('click', () => {
            isMuted = !isMuted;
            localStorage.setItem('music_muted', isMuted);
            updateMusicUI();
            if (isMuted) {
                celebrationAudio.pause();
            } else {
                // Resume play if the modal is open and it's not the decline screen
                const isModalOpen = !modalScreen.classList.contains('hidden');
                const rsvpStep3 = document.getElementById('rsvp-step-3');
                const isDeclineScreen = rsvpStep3 && !rsvpStep3.classList.contains('hidden');
                
                if (isModalOpen && !isDeclineScreen) {
                    celebrationAudio.play().catch(e => console.log("Audio resume failed:", e));
                }
            }
        });
    }

    if (btnYes && btnNo) {
        btnYes.addEventListener('click', () => {
            lenis.stop(); // Stop background smooth scroll
            document.body.classList.add('no-scroll');
            modalScreen.classList.remove('hidden');
            rsvpStep1.classList.remove('hidden');
            rsvpStep1.style.opacity = '1';
            rsvpStep2.classList.add('hidden');
            
            // Start modal-specific smooth scroll
            modalLenis.start();
            
            // Fix: Explicitly hide the decline step
            const step3 = document.getElementById('rsvp-step-3');
            if(step3) step3.classList.add('hidden');
            
            // Hide back button for all modal screens as requested
            if (modalBackBtn) modalBackBtn.style.display = 'none';
            if (musicToggle) musicToggle.classList.remove('hidden');
            
            // Fix: Ensure canvas is ready for mobile celebration
            resizeCanvas();
            setTimeout(showCelebration, 150); 
            
            // Play celebration audio if not muted
            if (!isMuted) {
                celebrationAudio.currentTime = 0;
                celebrationAudio.play().catch(e => console.log("Audio playback failed:", e));
            }
        });
        btnNo.addEventListener('click', async () => {
            lenis.stop();
            document.body.classList.add('no-scroll');
            // Rate limit check for decline
            if (!rsvpRateOk()) {
                console.warn('Rate limit: too many RSVP attempts.');
                // Continue to show the decline screen — just don't write
            } else if (typeof guestId !== 'undefined' && guestId && currentGuestData) {
                try {
                    const guestRef = doc(db, "guests", guestId);
                    await updateDoc(guestRef, {
                        status: "Not Attending",
                        partyCount: 0,
                        timestamp: new Date().toISOString()
                    });
                } catch(e) {
                    // Generic error — do not expose internal details
                    console.warn('Could not save response.');
                }
            }

            modalScreen.classList.remove('hidden');
            rsvpStep1.classList.add('hidden');
            rsvpStep2.classList.add('hidden');
            
            const step3 = document.getElementById('rsvp-step-3');
            if(step3) step3.classList.remove('hidden');
            
            // Hide back button for all modal screens as requested
            if (modalBackBtn) modalBackBtn.style.display = 'none';

            // Start modal-specific smooth scroll to fix the "stuck" card on mobile
            modalLenis.start();
            resizeCanvas();
            
            if (musicToggle) musicToggle.classList.add('hidden');
        });
    }
    
    if (modalBackBtn) {
        modalBackBtn.addEventListener('click', () => {
            lenis.start(); // Resume background smooth scroll
            modalLenis.stop(); // Stop modal-specific smooth scroll
            document.body.classList.remove('no-scroll'); // Re-enable background scrolling
            modalScreen.classList.add('hidden');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles = [];
            celebrationAudio.pause();
            if (musicToggle) musicToggle.classList.add('hidden');
        });
    }

    // Close modal when clicking outside the card disabled as requested
    /*
    modalScreen.addEventListener('click', (e) => {
        if (e.target === modalScreen) {
            lenis.start(); // Resume background smooth scroll
            modalScreen.classList.add('hidden');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles = [];
            celebrationAudio.pause();
            if (musicToggle) musicToggle.classList.add('hidden');
        }
    });
    */
    
    if (btnEditResponse) {
        btnEditResponse.addEventListener('click', () => {
            rsvpStep2.classList.add('hidden');
            // Fix: Hide decline step when editing response
            const step3 = document.getElementById('rsvp-step-3');
            if(step3) step3.classList.add('hidden');
            
            rsvpStep1.classList.remove('hidden');
            rsvpStep1.style.opacity = '1';
            // Hide back button for all modal screens as requested
            if (modalBackBtn) modalBackBtn.style.display = 'none';
        });
    }

    if (submitRsvpFinal) {
        submitRsvpFinal.addEventListener('click', async () => {
            const nameInput = document.getElementById('guest-name-input');
            const nameError = document.getElementById('name-error');
            const rawName = nameInput ? nameInput.value : "";
            const guestName = sanitize(rawName);

            // ── Honeypot anti-bot check (hidden field must be empty) ──
            const honeypot = document.getElementById('_rsvp_trap');
            if (honeypot && honeypot.value) {
                // Bot filled the invisible field — silently reject
                return;
            }

            // ── Rate limiting ──
            if (!rsvpRateOk()) {
                if (nameError) {
                    nameError.textContent = 'Too many submissions. Please wait a few minutes.';
                    nameError.classList.remove('hidden');
                }
                return;
            }

            // ── Input validation ──
            const nameCheck = validateName(guestName);
            if (!nameCheck.valid) {
                if (nameInput) {
                    nameInput.classList.add('invalid');
                    nameInput.focus();
                }
                if (nameError) {
                    nameError.textContent = nameCheck.reason;
                    nameError.classList.remove('hidden');
                }
                return;
            } else {
                if (nameInput) nameInput.classList.remove('invalid');
                if (nameError) nameError.classList.add('hidden');
            }

            // IMMEDIATELY provide visual feedback to make it feel fast
            submitRsvpFinal.innerText = "SAVING...";
            submitRsvpFinal.disabled = true;
            rsvpStep1.style.opacity = '0';

            // Start Database integration (non-blocking for UI transition)
            const saveToFirebase = async () => {
                if (typeof guestId !== 'undefined' && guestId && currentGuestData) {
                    try {
                        const guestRef = doc(db, "guests", guestId);
                        await updateDoc(guestRef, {
                            name: guestName, // Already sanitized above
                            status: "Attending",
                            partyCount: Math.min(Math.max(parseInt(familyCount) || 1, 1), 20), // Clamp 1–20
                            timestamp: new Date().toISOString()
                        });
                    } catch(e) {
                        // Generic error — no internal details exposed
                        console.warn('Could not save response.');
                    }
                } else {
                    try {
                        // Build safe document ID — no user input in key path
                        const generalId = "walk-in-" + Date.now().toString();
                        const guestRef = doc(db, "guests", generalId);
                        await setDoc(guestRef, {
                            name: guestName,
                            status: "Attending",
                            partyCount: Math.min(Math.max(parseInt(familyCount) || 1, 1), 20),
                            timestamp: new Date().toISOString(),
                            isGeneral: true
                        });
                    } catch(e) {
                        console.warn('Could not save response.');
                    }
                }
            };

            // Calculate guest count locally while saving
            if (!localStorage.getItem('rsvp_done')) {
                totalGuestCount += familyCount;
                localStorage.setItem('wedding_guest_count', totalGuestCount);
                localStorage.setItem('rsvp_done', 'true');
                localStorage.setItem('last_family_count', familyCount);
                if(countVal) countVal.innerText = totalGuestCount;
            } else {
                let previousCount = parseInt(localStorage.getItem('last_family_count')) || 0;
                let difference = familyCount - previousCount;
                totalGuestCount += difference;
                localStorage.setItem('wedding_guest_count', totalGuestCount);
                localStorage.setItem('last_family_count', familyCount);
                if(countVal) countVal.innerText = totalGuestCount;
            }

            // Run save in background and transition UI simultaneously
            saveToFirebase();

            setTimeout(() => {
                rsvpStep1.classList.add('hidden');
                rsvpStep2.classList.remove('hidden');
                modalBackBtn.style.display = 'none'; // Lock them in success
                submitRsvpFinal.innerText = "SUBMIT RSVP";
                submitRsvpFinal.disabled = false;
                
                // Trigger celebratory burst from the bottom
                resizeCanvas();
                triggerBurst();
            }, 400); // Slightly faster transition (0.4s)
        });
    }

    // 5. Celebration Logic (Multilayered Confetti & Fireworks)
    const canvas = document.getElementById('confetti-canvas');
    const fCanvas = document.getElementById('foreground-canvas');
    let ctx, fCtx, particles = [], fParticles = [];
    let celebrationStartTime = 0;
    let celebrationIntensity = 1;
    
    function showCelebration() {
        if (!canvas) return;
        resizeCanvas();
        if (particles.length < 50) {
            createParticles();
            animateConfetti();
        }
    }

    function triggerBurst() {
        if (!canvas) return;
        celebrationStartTime = Date.now(); // Reset timer for the main success burst
        showCelebration(); 
        // Background Burst (behind card)
        for (let i = 0; i < 40; i++) {
            particles.push(new Firework(Math.random() * canvas.width, canvas.height));
        }
        // Foreground Burst (in front of card)
        for (let i = 0; i < 20; i++) {
            fParticles.push(new Particle(true, true));
        }
    }

    function resizeCanvas() {
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        if (fCanvas) {
            fCanvas.width = window.innerWidth;
            fCanvas.height = window.innerHeight;
        }
    }

    if (canvas) {
        ctx = canvas.getContext('2d');
        if (fCanvas) fCtx = fCanvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }


    // 6. Change My Mind Button Logic
    const btnChangeMind = document.getElementById('btn-change-mind');
    if (btnChangeMind) {
        btnChangeMind.addEventListener('click', () => {
            const step3 = document.getElementById('rsvp-step-3');
            if(step3) step3.classList.add('hidden');
            
            rsvpStep1.classList.remove('hidden');
            rsvpStep1.style.opacity = '1';
        });
    }

    class Particle {
        constructor(isBurst = false, isForeground = false) {
            this.isBurst = isBurst;
            this.isForeground = isForeground;
            this.x = Math.random() * (canvas ? canvas.width : window.innerWidth);
            this.y = isBurst ? (canvas ? canvas.height + 20 : window.innerHeight) : -10;
            this.size = isForeground ? Math.random() * 8 + 5 : Math.random() * 5 + 3;
            this.color = isForeground ? '#C5A059' : ['#557A54', '#8A7F72', '#EBE5D9'][Math.floor(Math.random() * 3)];
            this.speedX = isBurst ? Math.random() * 10 - 5 : Math.random() * 2 - 1;
            this.speedY = isBurst ? -(Math.random() * 12 + 6) : Math.random() * 3 + 2;
            this.opacity = 1;
            this.rotation = Math.random() * 360;
            this.rotationSpeed = isBurst ? Math.random() * 10 - 5 : Math.random() * 2 - 1;
            this.gravity = isBurst ? 0.2 : 0;
            this.blur = isForeground ? '4px' : '0px';
        }

        update() {
            this.y += this.speedY;
            this.x += this.speedX;
            this.rotation += this.rotationSpeed;
            
            if (this.isBurst) {
                this.speedY += this.gravity;
                this.opacity -= 0.008;
            } else {
                if (this.y > (canvas ? canvas.height : window.innerHeight)) {
                    // Only recycle particles if celebration is still active
                    if (Math.random() < celebrationIntensity) {
                        this.y = -10;
                        this.x = Math.random() * (canvas ? canvas.width : window.innerWidth);
                    } else {
                        // Let it fall out and die (will be filtered out in animate loop)
                        this.opacity = 0;
                    }
                }
            }
        }

        draw(targetCtx) {
            if (this.opacity <= 0 || !targetCtx) return;
            targetCtx.save();
            targetCtx.filter = this.isForeground ? `blur(${this.blur})` : 'none';
            targetCtx.globalAlpha = this.opacity;
            targetCtx.fillStyle = this.color;
            targetCtx.translate(this.x, this.y);
            targetCtx.rotate(this.rotation * Math.PI / 180);
            
            targetCtx.beginPath();
            targetCtx.moveTo(0, -this.size);
            targetCtx.quadraticCurveTo(this.size, 0, 0, this.size);
            targetCtx.quadraticCurveTo(-this.size, 0, 0, -this.size);
            targetCtx.fill();
            
            targetCtx.restore();
        }
    }

    class Firework {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.particles = [];
            for (let i = 0; i < 30; i++) {
                this.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(i) * (Math.random() * 10 + 5),
                    vy: Math.sin(i) * (Math.random() * 10 + 5),
                    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    opacity: 1,
                    size: Math.random() * 3 + 1
                });
            }
        }

        update() {
            this.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // Gravity
                p.opacity -= 0.015;
            });
            this.particles = this.particles.filter(p => p.opacity > 0);
        }

        draw(targetCtx) {
            this.particles.forEach(p => {
                targetCtx.save();
                targetCtx.globalAlpha = p.opacity;
                targetCtx.fillStyle = p.color;
                targetCtx.beginPath();
                targetCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                targetCtx.fill();
                targetCtx.restore();
            });
        }
    }

    function createParticles() {
        particles = [];
        fParticles = [];
        for (let i = 0; i < 100; i++) particles.push(new Particle(false, false));
        for (let i = 0; i < 20; i++) fParticles.push(new Particle(false, true));
    }

    function animateConfetti() {
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (fCtx) fCtx.clearRect(0, 0, fCanvas.width, fCanvas.height);

        // Update & Draw Background Particles
        particles.forEach((p) => {
            p.update();
            p.draw(ctx);
        });

        // Update & Draw Foreground Particles
        fParticles.forEach((p) => {
            p.update();
            p.draw(fCtx);
        });

        if ((particles.length > 0 || fParticles.length > 0) && !modalScreen.classList.contains('hidden')) {
            // Update Intensity based on time
            const elapsed = (Date.now() - celebrationStartTime) / 1000;
            if (elapsed < 3) {
                celebrationIntensity = 1;
            } else if (elapsed < 15) {
                // Linear fade from 3s to 15s (takes 12s to fade)
                celebrationIntensity = Math.max(0, 1 - (elapsed - 3) / 12);
            } else {
                celebrationIntensity = 0;
            }

            // Remove dead particles and fireworks to keep performance high
            particles = particles.filter(p => {
                if (p instanceof Firework) return p.particles.length > 0;
                return p.opacity > 0;
            });
            fParticles = fParticles.filter(p => p.opacity > 0);

            // Random ambient firework - probability decreases with intensity
            if (Math.random() < (0.03 * celebrationIntensity) && !rsvpStep2.classList.contains('hidden')) {
                particles.push(new Firework(Math.random() * canvas.width, Math.random() * canvas.height * 0.5));
            }

            requestAnimationFrame(animateConfetti);
        }
    }

    window.showCelebration = function() {
        if (!canvas || !ctx) return;
        celebrationStartTime = Date.now(); // Reset timer
        resizeCanvas();
        createParticles();
        animateConfetti();
    };

    function showCelebration() {
        window.showCelebration();
    }
});
