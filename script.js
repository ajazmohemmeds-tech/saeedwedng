import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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

if (guestId) {
    document.addEventListener("DOMContentLoaded", async () => {
        try {
            const guestRef = doc(db, "guests", guestId);
            const guestSnap = await getDoc(guestRef);
            
            if (guestSnap.exists()) {
                currentGuestData = guestSnap.data();
                
                // Inject personalized greeting into the UI
                const greetingContainer = document.getElementById('personalized-greeting');
                if (greetingContainer) {
                    greetingContainer.innerHTML = `
                        <p class="guest-subtitle">EXCLUSIVE INVITATION FOR</p>
                        <h2 class="guest-name">${currentGuestData.name.toUpperCase()}</h2>
                    `;
                    // Brief delay to trigger entry animation after loader starts fading
                    setTimeout(() => {
                        greetingContainer.classList.remove('hidden');
                        greetingContainer.classList.add('visible');
                    }, 4000);
                }

                // Pre-fill name in RSVP modal
                const nameInput = document.getElementById('guest-name-input');
                if (nameInput) nameInput.value = currentGuestData.name;
            } else {
                console.warn("Guest ID invalid or not found.");
            }
        } catch(e) {
            console.error("Error fetching guest data:", e);
        }
    });
}

// 1. Loading Screen Handler
const loader = document.getElementById('loading-screen');

// We initiate the deliberate delay immediately to ensure it always finishes in 5s
if (loader) {
    setTimeout(() => {
        loader.style.transition = 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 1.5s';
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        
        setTimeout(() => {
            loader.style.display = 'none';
            document.body.classList.remove('is-loading'); // Re-enable touch/scroll
            lenis.start(); // Enable scroll once intro is finished
            
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

// 2. Initialize Lenis Smooth Scroll
const lenis = new Lenis({
    duration: 1.0,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
lenis.stop(); // Lock scroll initially for the smooth loading screen

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
            
            // Fix: Explicitly hide the decline step
            const step3 = document.getElementById('rsvp-step-3');
            if(step3) step3.classList.add('hidden');
            
            modalBackBtn.style.display = 'block';
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
            lenis.stop(); // Stop background smooth scroll
            document.body.classList.add('no-scroll');
            // Database integration: Push Decline to Firebase
            if (typeof guestId !== 'undefined' && guestId && currentGuestData) {
                try {
                    const guestRef = doc(db, "guests", guestId);
                    await updateDoc(guestRef, {
                        status: "Not Attending",
                        partyCount: 0,
                        timestamp: new Date().toISOString()
                    });
                } catch(e) {
                    console.error("Failed to save Decline to database:", e);
                }
            }

            modalScreen.classList.remove('hidden');
            rsvpStep1.classList.add('hidden');
            rsvpStep2.classList.add('hidden');
            
            const step3 = document.getElementById('rsvp-step-3');
            if(step3) step3.classList.remove('hidden');
            
            modalBackBtn.style.display = 'block';
            if (musicToggle) musicToggle.classList.add('hidden');
        });
    }
    
    if (modalBackBtn) {
        modalBackBtn.addEventListener('click', () => {
            lenis.start(); // Resume background smooth scroll
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
            modalBackBtn.style.display = 'block';
        });
    }

    if (submitRsvpFinal) {
        submitRsvpFinal.addEventListener('click', async () => {
            const nameInput = document.getElementById('guest-name-input');
            const nameError = document.getElementById('name-error');
            const guestName = nameInput ? nameInput.value.trim() : "";

            // Validation check: Name is mandatory
            if (!guestName) {
                if (nameInput) {
                    nameInput.classList.add('invalid');
                    nameInput.focus();
                }
                if (nameError) nameError.classList.remove('hidden');
                return; // Block submission
            } else {
                if (nameInput) nameInput.classList.remove('invalid');
                if (nameError) nameError.classList.add('hidden');
            }

            // Database integration: Push RSVP to Firebase
            if (typeof guestId !== 'undefined' && guestId && currentGuestData) {
                try {
                    const guestRef = doc(db, "guests", guestId);
                    await updateDoc(guestRef, {
                        name: guestName, // Save the provided name
                        status: "Attending",
                        partyCount: familyCount,
                        timestamp: new Date().toISOString()
                    });
                } catch(e) {
                    console.error("Failed to save RSVP to database:", e);
                }
            } else {
                console.log("No valid guest link detected—saving locally only (Fallback).");
            }

            // Store and calculate data locally
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
            
            // Go to step 2
            submitRsvpFinal.innerText = "SAVING...";
            submitRsvpFinal.disabled = true;

            rsvpStep1.style.opacity = '0';
            setTimeout(() => {
                rsvpStep1.classList.add('hidden');
                rsvpStep2.classList.remove('hidden');
                modalBackBtn.style.display = 'none'; // Lock them in success
                submitRsvpFinal.innerText = "SUBMIT RSVP";
                submitRsvpFinal.disabled = false;
                
                // Trigger celebratory burst from the bottom
                resizeCanvas();
                triggerBurst();
            }, 500);
        });
    }

    // 5. Celebration Logic (Multilayered Confetti & Fireworks)
    const canvas = document.getElementById('confetti-canvas');
    const fCanvas = document.getElementById('foreground-canvas');
    let ctx, fCtx, particles = [], fParticles = [];
    
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
                    this.y = -10;
                    this.x = Math.random() * (canvas ? canvas.width : window.innerWidth);
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
            // Remove dead particles and fireworks to keep performance high
            particles = particles.filter(p => {
                if (p instanceof Firework) return p.particles.length > 0;
                return !p.opacity || p.opacity > 0;
            });
            fParticles = fParticles.filter(p => p.opacity > 0);

            // Random ambient firework
            if (Math.random() < 0.03 && !rsvpStep2.classList.contains('hidden')) {
                particles.push(new Firework(Math.random() * canvas.width, Math.random() * canvas.height * 0.5));
            }

            requestAnimationFrame(animateConfetti);
        }
    }

    window.showCelebration = function() {
        if (!canvas || !ctx) return;
        resizeCanvas();
        createParticles();
        animateConfetti();
    };

    function showCelebration() {
        window.showCelebration();
    }
});
