// HandTrack.js will be loaded from CDN via script tag in HTML
// Global handTrack object will be available

let video, canvas, ctx, model, isVideo = false;
let score = 0;
let bugs = [];
let splashes = [];
let audioContext;
let missedBugs = 0;
let gameOver = false;
let debugMode = false;
let currentHandBoxes = [];
let backgroundMusic;
let restartHoldStart = 0;
let restartHoldDuration = 5000; // 5 seconds
let isHoldingRestart = false;

// Check if debug mode is enabled
function checkDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    debugMode = urlParams.get('debug') === 'true';
    console.log('Debug mode:', debugMode);
}


// Initialize and control background music
function initBackgroundMusic() {
    backgroundMusic = new Audio('bgmusic.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3; // Adjust volume as needed
    
    backgroundMusic.addEventListener('canplaythrough', () => {
        console.log('Background music loaded and ready');
    });
    
    backgroundMusic.addEventListener('error', (e) => {
        console.log('Background music failed to load:', e);
    });
}

function startBackgroundMusic() {
    if (backgroundMusic && !gameOver) {
        backgroundMusic.play().catch(err => {
            console.log('Could not play background music:', err);
        });
    }
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

// Initialize audio context
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

// Sound effect functions
function playSound(frequency, duration, type = 'sine', volume = 0.3) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playBugSpawnSound() {
    // Bug buzzing sound
    playSound(300, 0.3, 'sawtooth', 0.15);
}

function playBugCaughtSound() {
    // Play custom bug smash sound
    const audio = new Audio('bugsmash.mp3');
    audio.volume = 0.5; // Adjust volume as needed
    audio.play().catch(err => {
        console.log('Could not play sound:', err);
    });
}

function playBugEscapedSound() {
    // Bug escape buzzing sound
    playSound(250, 0.4, 'sawtooth', 0.2);
    setTimeout(() => playSound(280, 0.3, 'sawtooth', 0.15), 200);
}

const modelParams = {
    flipHorizontal: true,
    maxNumBoxes: 5, // Limit to 2 hands
    iouThreshold: 0.2,
    scoreThreshold: 0.5,
};

// Check if a position overlaps with any hand bounding box
function isPositionInHand(x, y, radius) {
    return currentHandBoxes.some(bbox => {
        const [handX, handY, handWidth, handHeight] = bbox;
        // Check if bug (with radius) would overlap with hand box
        return (x - radius < handX + handWidth && 
                x + radius > handX && 
                y - radius < handY + handHeight && 
                y + radius > handY);
    });
}

// Splash effect class for when bugs are squashed
class Splash {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.createdAt = Date.now();
        this.lifetime = 800; // 0.8 seconds
        
        // Create splash particles
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8, // Random velocity X
                vy: (Math.random() - 0.5) * 8, // Random velocity Y
                size: Math.random() * 6 + 3, // Random size 3-9
                color: this.getRandomSplashColor(),
                life: 1.0 // Full life at start
            });
        }
    }
    
    getRandomSplashColor() {
        const colors = ['#FF4444', '#FF6666', '#CC0000', '#AA0000', '#FF8888'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    update() {
        const age = Date.now() - this.createdAt;
        const lifeRatio = 1 - (age / this.lifetime);
        
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Apply gravity
            particle.vy += 0.2;
            
            // Apply air resistance
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            // Update life (for fading)
            particle.life = Math.max(0, lifeRatio);
            
            // Shrink over time
            particle.size = Math.max(0, particle.size * 0.99);
        });
    }
    
    draw(ctx) {
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                ctx.save();
                ctx.globalAlpha = particle.life;
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
            }
        });
    }
    
    isExpired() {
        return Date.now() - this.createdAt > this.lifetime;
    }
}

// Bug class
class Bug {
    constructor() {
        let attempts = 0;
        let validPosition = false;
        
        // Try to find a position that doesn't overlap with hands
        while (!validPosition && attempts < 50) {
            this.x = Math.random() * (canvas?.width - 60) + 30 || Math.random() * window.innerWidth;
            this.y = Math.random() * (canvas?.height - 60) + 30 || Math.random() * window.innerHeight;
            
            // Check if this position overlaps with any hand
            if (!isPositionInHand(this.x, this.y, 25)) {
                validPosition = true;
            }
            attempts++;
        }
        
        // If we couldn't find a valid position after 50 attempts, use the last position anyway
        // (This prevents infinite loops if hands cover most of the screen)
        
        this.radius = 25;
        this.lifetime = Math.random() * 3700 + 300; // 0.3-4 seconds
        this.createdAt = Date.now();
        this.caught = false;
        this.wiggle = 0; // For animation
    }
    
    draw(ctx) {
        if (this.caught) return;
        
        // Animate wiggle
        this.wiggle += 0.3;
        const wiggleX = Math.sin(this.wiggle) * 2;
        const wiggleY = Math.cos(this.wiggle * 1.5) * 1;
        
        // Draw bug body (red/orange for visibility)
        ctx.beginPath();
        ctx.ellipse(this.x + wiggleX, this.y + wiggleY, this.radius, this.radius * 0.7, 0, 0, 2 * Math.PI);
        ctx.fillStyle = '#FF4444'; // Red bug body
        ctx.fill();
        ctx.strokeStyle = '#CC0000'; // Dark red border
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw bug head
        ctx.beginPath();
        ctx.arc(this.x + wiggleX, this.y - this.radius * 0.5 + wiggleY, this.radius * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = '#AA0000'; // Darker red head
        ctx.fill();
        
        // Draw antennae
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x - 8 + wiggleX, this.y - this.radius * 0.7 + wiggleY);
        ctx.lineTo(this.x - 12 + wiggleX, this.y - this.radius * 0.9 + wiggleY);
        ctx.moveTo(this.x + 8 + wiggleX, this.y - this.radius * 0.7 + wiggleY);
        ctx.lineTo(this.x + 12 + wiggleX, this.y - this.radius * 0.9 + wiggleY);
        ctx.stroke();
        
        // Draw legs
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            const legY = this.y - this.radius * 0.2 + (i * this.radius * 0.3);
            // Left legs
            ctx.beginPath();
            ctx.moveTo(this.x - this.radius * 0.8 + wiggleX, legY + wiggleY);
            ctx.lineTo(this.x - this.radius * 1.2 + wiggleX, legY + 5 + wiggleY);
            ctx.stroke();
            // Right legs
            ctx.beginPath();
            ctx.moveTo(this.x + this.radius * 0.8 + wiggleX, legY + wiggleY);
            ctx.lineTo(this.x + this.radius * 1.2 + wiggleX, legY + 5 + wiggleY);
            ctx.stroke();
        }
        
        // Draw eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(this.x - 5 + wiggleX, this.y - this.radius * 0.5 + wiggleY, 2, 0, 2 * Math.PI);
        ctx.arc(this.x + 5 + wiggleX, this.y - this.radius * 0.5 + wiggleY, 2, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    isExpired() {
        return Date.now() - this.createdAt > this.lifetime;
    }
    
    checkCollision(handBbox) {
        if (this.caught) return false;
        
        const [handX, handY, handWidth, handHeight] = handBbox;
        
        // Check if bug center is inside hand bounding box
        return (this.x >= handX && this.x <= handX + handWidth &&
                this.y >= handY && this.y <= handY + handHeight);
    }
}

async function init() {
    console.log('Starting hand tracking test...');
    
    // Check debug mode
    checkDebugMode();
    
    // Initialize audio
    initAudio();
    initBackgroundMusic();
    
    // Get elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    
    // Load model first
    console.log('Loading hand tracking model...');
    model = await handTrack.load(modelParams);
    console.log('Model loaded successfully!');
    
    // Use handTrack's built-in video starter
    handTrack.startVideo(video).then(function(status) {
        console.log("handTrack.startVideo status:", status);
        if (status) {
            console.log("Video started successfully via handTrack");
            
            // Set canvas size after video is ready
            canvas.width = video.videoWidth || window.innerWidth;
            canvas.height = video.videoHeight || window.innerHeight;
            console.log("Canvas size set to:", canvas.width, "x", canvas.height);
            console.log("Video size:", video.videoWidth, "x", video.videoHeight);
            
            isVideo = true;
            startBackgroundMusic(); // Start music when game begins
            runDetection();
        } else {
            console.log("Failed to start video via handTrack");
        }
    }).catch(err => {
        console.error('handTrack.startVideo error:', err);
    });
}


function runDetection() {
    model.detect(video).then(predictions => {
        // Debug: Log all predictions, even low confidence ones
        if (predictions.length > 0) {
            console.log("Raw predictions found:", predictions.length);
            predictions.forEach((pred, i) => {
                console.log(`Prediction ${i}:`, {
                    class: pred.class,
                    score: pred.score,
                    bbox: pred.bbox
                });
            });
        } else {
            console.log("No predictions at all - model may not be detecting anything");
        }
        
        showPredictions(predictions);
        if (isVideo) {
            requestAnimationFrame(runDetection);
        }
    }).catch(err => {
        console.error("Detection error:", err);
        if (isVideo) {
            requestAnimationFrame(runDetection);
        }
    });
}

function showPredictions(predictions) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Filter to only show hand detections
    const handPredictions = predictions.filter(prediction => {
        return prediction.class !== 5; // Exclude class 5 (faces)
    });
    
    // Store current hand boxes for bug spawn collision avoidance
    currentHandBoxes = handPredictions.map(pred => pred.bbox);
    
    if (gameOver) {
        drawGameOverScreen();
        
        // Still check for play again button interaction
        if (handPredictions.length > 0) {
            handPredictions.forEach(prediction => {
                checkPlayAgainButton(prediction.bbox);
                
                // Only draw debug info in debug mode
                if (debugMode) {
                    const [x, y, width, height] = prediction.bbox;
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(x, y, width, height);
                }
            });
        }
        return;
    }
    
    // Update game state
    updateGame();
    
    // Update and draw splash effects
    updateSplashes();
    
    // Draw bugs first (behind hands)
    drawBugs();
    
    // Draw splash effects (on top of bugs, behind hands)
    drawSplashes();
    
    // Check collisions and draw hands
    if (handPredictions.length > 0) {
        handPredictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            
            // Check bug collisions for this hand
            checkBugCollisions(prediction.bbox);
            
            // Only draw debug info in debug mode
            if (debugMode) {
                // Draw green box
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.strokeRect(x, y, width, height);
                
                // Draw label
                ctx.fillStyle = '#00ff00';
                ctx.font = '16px Arial';
                ctx.fillText(
                    'Class ' + prediction.class + ' - ' + Math.round(prediction.score * 100) + '%',
                    x, y > 10 ? y - 5 : 10
                );
            }
        });
    }
    
    // Draw score and missed bugs counter
    drawScore();
}

function updateGame() {
    if (gameOver) return;
    
    // Spawn new bugs randomly (about every 2 seconds on average)
    if (Math.random() < 0.008) { // Roughly 0.8% chance per frame at 60fps
        bugs.push(new Bug());
        // No sound when bug appears
    }
    
    // Check for expired bugs and apply penalty
    bugs.forEach(bug => {
        if (bug.isExpired() && !bug.caught && !bug.processed) {
            // Bug escaped - deduct points (no sound)
            score = Math.max(0, score - 1); // Deduct 1 point
            missedBugs++;
            bug.processed = true; // Mark as processed to avoid double counting
            console.log('Bug escaped! Score:', score, 'Missed:', missedBugs);
            
            // Check for game over
            if (missedBugs >= 3) {
                gameOver = true;
                stopBackgroundMusic(); // Stop music on game over
                console.log('Game Over! Final Score:', score);
            }
        }
    });
    
    // Remove expired bugs
    bugs = bugs.filter(bug => !bug.isExpired() && !bug.caught);
}

function updateSplashes() {
    // Update all splash effects
    splashes.forEach(splash => {
        splash.update();
    });
    
    // Remove expired splashes
    splashes = splashes.filter(splash => !splash.isExpired());
}

function drawSplashes() {
    splashes.forEach(splash => {
        splash.draw(ctx);
    });
}

function drawBugs() {
    bugs.forEach(bug => {
        bug.draw(ctx);
    });
}

function checkBugCollisions(handBbox) {
    bugs.forEach(bug => {
        if (bug.checkCollision(handBbox)) {
            bug.caught = true;
            score += 1; // +1 point for each bug caught
            
            // Create splash effect at bug position
            splashes.push(new Splash(bug.x, bug.y));
            
            playBugCaughtSound(); // Play squash sound when bug is caught
            console.log('Bug caught! Score:', score);
        }
    });
}

function drawScore() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    // Position score at top-left of canvas area (below HTML header)
    const scoreY = 40;
    
    // Draw score
    ctx.strokeText('Bugs Caught: ' + score, 20, scoreY);
    ctx.fillText('Bugs Caught: ' + score, 20, scoreY);
    
    // Draw missed bugs counter
    ctx.fillStyle = '#FF4444';
    ctx.strokeText('Missed: ' + missedBugs + '/3', 20, scoreY + 40);
    ctx.fillText('Missed: ' + missedBugs + '/3', 20, scoreY + 40);
}

function drawGameOverScreen() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Game Over title
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 48px Arial';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.strokeText('GAME OVER', centerX, centerY - 100);
    ctx.fillText('GAME OVER', centerX, centerY - 100);
    
    // Final score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.lineWidth = 2;
    
    ctx.strokeText('Final Score: ' + score, centerX, centerY - 40);
    ctx.fillText('Final Score: ' + score, centerX, centerY - 40);
    
    ctx.strokeText('Bugs Missed: ' + missedBugs, centerX, centerY);
    ctx.fillText('Bugs Missed: ' + missedBugs, centerX, centerY);
    
    // Play Again button (smaller size)
    const buttonWidth = 160;
    const buttonHeight = 50;
    const buttonX = centerX - buttonWidth / 2;
    const buttonY = centerY + 40;
    
    // Calculate hold progress
    let holdProgress = 0;
    if (isHoldingRestart && restartHoldStart > 0) {
        const elapsed = Date.now() - restartHoldStart;
        holdProgress = Math.min(elapsed / restartHoldDuration, 1);
    }
    
    // Button background
    ctx.fillStyle = isHoldingRestart ? '#45a049' : '#4CAF50';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#45a049';
    ctx.lineWidth = 3;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // Progress indicator (fill from left to right)
    if (isHoldingRestart && holdProgress > 0) {
        ctx.fillStyle = '#2E7D32'; // Darker green for progress
        ctx.fillRect(buttonX, buttonY, buttonWidth * holdProgress, buttonHeight);
    }
    
    // Button text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px Arial';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    if (isHoldingRestart) {
        const remainingTime = Math.ceil((restartHoldDuration - (Date.now() - restartHoldStart)) / 1000);
        ctx.strokeText(`HOLD (${remainingTime}s)`, centerX, buttonY + 32);
        ctx.fillText(`HOLD (${remainingTime}s)`, centerX, buttonY + 32);
    } else {
        ctx.strokeText('PLAY AGAIN', centerX, buttonY + 32);
        ctx.fillText('PLAY AGAIN', centerX, buttonY + 32);
    }
    
    // Instructions
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '16px Arial';
    ctx.lineWidth = 1;
    
    ctx.strokeText('Hold your hand over the button for 5 seconds', centerX, buttonY + 75);
    ctx.fillText('Hold your hand over the button for 5 seconds', centerX, buttonY + 75);
    
    // Reset text alignment
    ctx.textAlign = 'left';
}

function checkPlayAgainButton(handBbox) {
    if (!gameOver) return;
    
    const [handX, handY, handWidth, handHeight] = handBbox;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const buttonWidth = 160; // Updated to match smaller button
    const buttonHeight = 50; // Updated to match smaller button
    const buttonX = centerX - buttonWidth / 2;
    const buttonY = centerY + 40;
    
    // Check if hand overlaps with play again button
    const isOverButton = (handX < buttonX + buttonWidth && handX + handWidth > buttonX &&
                         handY < buttonY + buttonHeight && handY + handHeight > buttonY);
    
    if (isOverButton) {
        // Start holding if not already holding
        if (!isHoldingRestart) {
            isHoldingRestart = true;
            restartHoldStart = Date.now();
            console.log('Started holding restart button');
        }
        
        // Check if hold duration is complete
        const elapsed = Date.now() - restartHoldStart;
        if (elapsed >= restartHoldDuration) {
            // Restart game
            score = 0;
            missedBugs = 0;
            gameOver = false;
            bugs = [];
            splashes = []; // Clear splash effects
            isHoldingRestart = false;
            restartHoldStart = 0;
            startBackgroundMusic(); // Restart music when game restarts
            console.log('Game restarted after 5 second hold!');
        }
    } else {
        // Hand is not over button, reset hold
        if (isHoldingRestart) {
            isHoldingRestart = false;
            restartHoldStart = 0;
            console.log('Hold cancelled - hand moved away from button');
        }
    }
}

// Start when page loads
window.addEventListener('DOMContentLoaded', init);
