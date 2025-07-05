class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        console.log('Game starting...', this.width, 'x', this.height);
        
        // Game settings
        this.cellSize = 20;
        this.cols = Math.floor(this.width / this.cellSize);
        this.rows = Math.floor(this.height / this.cellSize);
        
        // Initialize game objects
        this.maze = new Maze(this.cols, this.rows);
        this.player = new Player(1, 1, this.cellSize);
        this.enemies = [];
        this.colorDots = [];
        this.collectedColors = [];
        this.rainbowColors = [
            '#FF0000', // Red
            '#FF8800', // Orange
            '#FFFF00', // Yellow
            '#00FF00', // Green
            '#0088FF', // Blue
            '#4400FF', // Indigo
            '#8800FF'  // Violet
        ];
        this.availableColors = [...this.rainbowColors]; // Track which colors haven't been collected yet
        
        // Trail system for snake-like following
        this.playerTrail = []; // Store player's recent positions
        this.maxTrailLength = 60; // Maximum positions to remember (increased for spaced segments)
        
        // Game state
        this.gameState = 'playing'; // 'playing' or 'celebrating'
        this.celebrationStartTime = 0;
        this.celebrationWaveOffset = 0;
        this.score = 0; // Track total colors collected
        
        this.setupGame();
        this.setupControls();
        this.gameLoop();
    }
    
    setupGame() {
        // Generate maze
        this.maze.generate();
        
        // Create enemies (avoid placing them in narrow chokepoints)
        for (let i = 0; i < 5; i++) {
            let x, y;
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * this.cols);
                y = Math.floor(Math.random() * this.rows);
                attempts++;
            } while (
                attempts < 100 && (
                    this.maze.grid[y][x] === 1 || 
                    (x <= 3 && y <= 3) || // Avoid starting area
                    this.isChokepoint(x, y) || // Avoid critical chokepoints
                    this.enemies.some(enemy => 
                        Math.abs(enemy.gridX - x) <= 2 && Math.abs(enemy.gridY - y) <= 2
                    ) // Spread enemies out
                )
            );
            
            // If we couldn't find a good spot, place it anywhere valid
            if (attempts >= 100) {
                do {
                    x = Math.floor(Math.random() * this.cols);
                    y = Math.floor(Math.random() * this.rows);
                } while (this.maze.grid[y][x] === 1 || (x <= 3 && y <= 3));
            }
            
            this.enemies.push(new Enemy(x, y, this.cellSize));
        }
        
        // Create color dots
        this.spawnColorDots();
    }
    
    // Check if a position is a critical chokepoint (only one path through)
    isChokepoint(x, y) {
        if (this.maze.grid[y][x] === 1) return false;
        
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        let pathCount = 0;
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.maze.grid[ny][nx] === 0) {
                pathCount++;
            }
        }
        
        // If only 2 paths and they're opposite each other, it's a chokepoint
        if (pathCount === 2) {
            const paths = [];
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.maze.grid[ny][nx] === 0) {
                    paths.push([dx, dy]);
                }
            }
            
            // Check if paths are opposite (vertical or horizontal corridor)
            if (paths.length === 2) {
                const [p1, p2] = paths;
                return (p1[0] === -p2[0] && p1[1] === -p2[1]);
            }
        }
        
        return false;
    }
    
    spawnColorDots() {
        // Spawn initial colors from available colors
        for (let i = 0; i < 3; i++) { // Start with 3 colors
            if (this.availableColors.length === 0) {
                this.availableColors = [...this.rainbowColors];
            }
            
            let x, y;
            let attempts = 0;
            do {
                x = Math.floor(Math.random() * this.cols);
                y = Math.floor(Math.random() * this.rows);
                attempts++;
            } while (
                attempts < 50 && (
                    this.maze.grid[y][x] === 1 || 
                    (x <= 3 && y <= 3) || // Avoid starting area
                    this.colorDots.some(dot => dot.gridX === x && dot.gridY === y) ||
                    this.enemies.some(enemy => enemy.gridX === x && enemy.gridY === y)
                )
            );
            
            // If we couldn't find a good spot, place it anywhere valid
            if (attempts >= 50) {
                do {
                    x = Math.floor(Math.random() * this.cols);
                    y = Math.floor(Math.random() * this.rows);
                } while (
                    this.maze.grid[y][x] === 1 || 
                    (x <= 3 && y <= 3) ||
                    this.colorDots.some(dot => dot.gridX === x && dot.gridY === y) ||
                    this.enemies.some(enemy => enemy.gridX === x && enemy.gridY === y)
                );
            }
            
            // Pick a unique color
            const colorIndex = Math.floor(Math.random() * this.availableColors.length);
            const color = this.availableColors[colorIndex];
            this.availableColors.splice(colorIndex, 1); // Remove from available
            this.colorDots.push(new ColorDot(x, y, this.cellSize, color));
        }
    }
    
    setupControls() {
        this.keys = {
            w: false,
            s: false,
            a: false,
            d: false,
            arrowup: false,
            arrowdown: false,
            arrowleft: false,
            arrowright: false,
            space: false
        };

        this.lastDirection = { x: 0, y: -1 }; // Default facing up

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
                e.preventDefault();
            } else if (e.key === ' ') {
                this.keys.space = true;
                e.preventDefault();
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = false;
                e.preventDefault();
            } else if (e.key === ' ') {
                this.keys.space = false;
                e.preventDefault();
            }
        });
    }
    
    update() {
        if (this.gameState === 'celebrating') {
            this.updateCelebration();
            return;
        }
        
        // Handle smooth player movement
        this.handlePlayerInput();
        
        // Update player movement
        this.player.update();
        
        // Update player trail for snake-like color following
        this.updatePlayerTrail();
        
        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.update(this.maze);
        });
        
        // Update color dots floating animation
        this.colorDots.forEach(dot => {
            dot.update();
        });

        // Update wall break effects
        this.updateWallBreakEffects();
        
        // Check collisions with enemies (using grid positions for accuracy)
        this.enemies.forEach(enemy => {
            if (this.player.gridX === enemy.gridX && this.player.gridY === enemy.gridY) {
                this.handleEnemyCollision();
            }
        });
        
        // Check collisions with color dots (using grid positions for accuracy)
        let collectedColors = [];
        this.colorDots = this.colorDots.filter(dot => {
            if (this.player.gridX === dot.gridX && this.player.gridY === dot.gridY) {
                collectedColors.push(dot.color);
                return false;
            }
            return true;
        });
        
        // Process collected colors after filtering
        collectedColors.forEach(color => {
            this.collectColor(color);
        });
        
        // Update UI
        this.updateUI();
    }

    
    updatePlayerTrail() {
        // Add current player position to trail
        const playerCenterX = this.player.x + this.cellSize / 2;
        const playerCenterY = this.player.y + this.cellSize / 2;
        
        // Only add if player has moved enough distance
        if (this.playerTrail.length === 0 || 
            Math.abs(this.playerTrail[0].x - playerCenterX) > 2 || 
            Math.abs(this.playerTrail[0].y - playerCenterY) > 2) {
            
            this.playerTrail.unshift({ x: playerCenterX, y: playerCenterY });
            
            // Calculate needed trail length for spaced segments
            const segmentLength = 4; // Dots per color
            const gapLength = 2; // Gap between colors
            const neededLength = this.collectedColors.length * (segmentLength + gapLength) + 10; // Extra buffer
            const dynamicTrailLength = Math.min(this.maxTrailLength, Math.max(15, neededLength));
            
            // Keep trail length manageable
            if (this.playerTrail.length > dynamicTrailLength) {
                this.playerTrail.pop();
            }
        }
    }

    updateWallBreakEffects() {
        if (!this.wallBreakEffects) return;
        
        const currentTime = Date.now();
        this.wallBreakEffects = this.wallBreakEffects.filter(effect => {
            const elapsed = currentTime - effect.startTime;
            const progress = elapsed / effect.duration;
            
            if (progress >= 1) return false; // Remove completed effects
            
            // Update particles
            effect.particles.forEach(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vx *= 0.95; // Slow down over time
                particle.vy *= 0.95;
                particle.life = 1 - progress;
            });
            
            return true;
        });
    }

    handlePlayerInput() {
        let dx = 0;
        let dy = 0;

        // Check horizontal movement
        if (this.keys.a || this.keys.arrowleft) {
            dx = -1;
            this.lastDirection = { x: -1, y: 0 };
        } else if (this.keys.d || this.keys.arrowright) {
            dx = 1;
            this.lastDirection = { x: 1, y: 0 };
        }

        // Check vertical movement
        if (this.keys.w || this.keys.arrowup) {
            dy = -1;
            this.lastDirection = { x: 0, y: -1 };
        } else if (this.keys.s || this.keys.arrowdown) {
            dy = 1;
            this.lastDirection = { x: 0, y: 1 };
        }

        // Apply movement
        if (dx !== 0 || dy !== 0) {
            this.player.move(dx, dy, this.maze);
        }

        // Handle wall breaking
        if (this.keys.space) {
            this.breakWall();
            this.keys.space = false; // Prevent continuous breaking
        }
    }

    breakWall() {
        const targetX = this.player.gridX + this.lastDirection.x;
        const targetY = this.player.gridY + this.lastDirection.y;

        // Check if target position is within bounds
        if (targetX >= 0 && targetX < this.cols && targetY >= 0 && targetY < this.rows) {
            // Check if there's a wall to break
            if (this.maze.grid[targetY][targetX] === 1) {
                // Break the wall
                this.maze.grid[targetY][targetX] = 0;
                
                // Create visual effect for wall breaking
                this.createWallBreakEffect(targetX, targetY);
                
                // Optional: Add some limitation like cooldown or limited uses
                // You could add a wall-breaking counter or energy system here
            }
        }
    }

    createWallBreakEffect(x, y) {
        // Create particles or visual effect for wall breaking
        const effectX = x * this.cellSize + this.cellSize / 2;
        const effectY = y * this.cellSize + this.cellSize / 2;
        
        // Store effect data for rendering
        if (!this.wallBreakEffects) {
            this.wallBreakEffects = [];
        }
        
        this.wallBreakEffects.push({
            x: effectX,
            y: effectY,
            particles: this.createBreakParticles(effectX, effectY),
            startTime: Date.now(),
            duration: 500 // Effect lasts 500ms
        });
    }

    createBreakParticles(centerX, centerY) {
        const particles = [];
        const numParticles = 8;
        
        for (let i = 0; i < numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2;
            particles.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(angle) * (2 + Math.random() * 3),
                life: 1.0,
                size: 3 + Math.random() * 4
            });
        }
        
        return particles;
    }
    
    handleEnemyCollision() {
        // Respawn player
        this.player.gridX = 1;
        this.player.gridY = 1;
        this.player.x = this.cellSize;
        this.player.y = this.cellSize;
        this.player.targetX = this.cellSize;
        this.player.targetY = this.cellSize;
        this.player.isMoving = false;
        
        // Lose last collected color and decrement score
        if (this.collectedColors.length > 0) {
            const lostColor = this.collectedColors.pop();
            this.score--; // Decrement score when losing a color
            
            console.log('Color lost due to enemy collision:', lostColor, 'Score decreased to:', this.score);
            
            // Respawn the lost color somewhere in the maze
            let x, y;
            do {
                x = Math.floor(Math.random() * this.cols);
                y = Math.floor(Math.random() * this.rows);
            } while (
                this.maze.grid[y][x] === 1 || 
                (x === 1 && y === 1) ||
                this.colorDots.some(dot => dot.gridX === x && dot.gridY === y) ||
                this.enemies.some(enemy => enemy.gridX === x && enemy.gridY === y)
            );
            
            this.colorDots.push(new ColorDot(x, y, this.cellSize, lostColor));
        }
    }
    
    collectColor(color) {
        this.collectedColors.push(color);
        this.score++; // Increment score
        
        console.log('Color collected:', color, 'Total collected:', this.collectedColors.length, 'Score:', this.score);
        
        // Spawn a new color dot immediately
        this.spawnNewColorDot();
        
        // Check if we've collected a complete rainbow (7 colors) for celebration
        if (this.collectedColors.length === 7 && this.availableColors.length === 0) {
            console.log('Complete rainbow collected! 🌈');
            // Brief celebration effect but keep playing
            this.startRainbowCompleteEffect();
        }
        
        // Keep colors manageable - remove oldest if we have too many
        if (this.collectedColors.length > 14) { // Allow 2 full rainbows
            this.collectedColors.shift();
        }
    }
    
    spawnNewColorDot() {
        // If no more unique colors available, reset the available colors
        if (this.availableColors.length === 0) {
            this.availableColors = [...this.rainbowColors];
            console.log('All rainbow colors collected! Starting new rainbow cycle.');
        }
        
        // Choose a random color from available colors (ensuring uniqueness)
        const colorIndex = Math.floor(Math.random() * this.availableColors.length);
        const color = this.availableColors[colorIndex];
        // Remove the color from available colors so it won't be picked again until cycle resets
        this.availableColors.splice(colorIndex, 1);
        
        let x, y;
        let attempts = 0;
        do {
            x = Math.floor(Math.random() * this.cols);
            y = Math.floor(Math.random() * this.rows);
            attempts++;
        } while (
            attempts < 50 && (
                this.maze.grid[y][x] === 1 || 
                (x <= 3 && y <= 3) || // Avoid starting area
                this.colorDots.some(dot => dot.gridX === x && dot.gridY === y) ||
                this.enemies.some(enemy => enemy.gridX === x && enemy.gridY === y) ||
                (this.player.gridX === x && this.player.gridY === y) // Avoid player position
            )
        );
        
        // If we couldn't find a good spot, place it anywhere valid
        if (attempts >= 50) {
            do {
                x = Math.floor(Math.random() * this.cols);
                y = Math.floor(Math.random() * this.rows);
            } while (
                this.maze.grid[y][x] === 1 || 
                (x <= 3 && y <= 3) ||
                (this.player.gridX === x && this.player.gridY === y)
            );
        }
        
        // Actually create and add the new color dot
        this.colorDots.push(new ColorDot(x, y, this.cellSize, color));
        console.log('New color spawned:', color, 'at', x, y, 'Remaining colors:', this.availableColors.length);
    }
    
    startCelebration() {
        this.gameState = 'celebrating';
        this.celebrationStartTime = Date.now();
        this.celebrationWaveOffset = 0;
    }
    
    updateCelebration() {
        this.celebrationWaveOffset += 0.1;
        
        // Check for any key press to end celebration
        const anyKeyPressed = Object.values(this.keys).some(key => key);
        if (anyKeyPressed) {
            this.endCelebration();
        }
    }
    
    endCelebration() {
        this.gameState = 'playing';
        setTimeout(() => {
            this.resetGame();
        }, 100);
    }
    
    resetGame() {
        this.collectedColors = [];
        this.colorDots = [];
        this.availableColors = [...this.rainbowColors]; // Reset available colors
        this.playerTrail = []; // Reset trail
        this.score = 0; // Reset score
        this.player.gridX = 1;
        this.player.gridY = 1;
        this.player.x = this.cellSize;
        this.player.y = this.cellSize;
        this.player.targetX = this.cellSize;
        this.player.targetY = this.cellSize;
        this.player.isMoving = false;
        this.spawnColorDots();
    }
    
    updateUI() {
        const colorsDisplay = document.getElementById('colorsDisplay');
        colorsDisplay.innerHTML = '';
        
        console.log('Updating UI with collected colors:', this.collectedColors.length, this.collectedColors);
        
        this.collectedColors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-dot';
            colorDiv.style.backgroundColor = color;
            colorsDisplay.appendChild(colorDiv);
        });
        
        // Update score display
        this.updateScoreDisplay();
    }
    
    updateScoreDisplay() {
        let scoreElement = document.getElementById('scoreDisplay');
        if (!scoreElement) {
            // Create score display if it doesn't exist
            scoreElement = document.createElement('div');
            scoreElement.id = 'scoreDisplay';
            scoreElement.style.position = 'absolute';
            scoreElement.style.top = '20px';
            scoreElement.style.right = '20px';
            scoreElement.style.color = 'white';
            scoreElement.style.fontSize = '24px';
            scoreElement.style.fontWeight = 'bold';
            scoreElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
            scoreElement.style.zIndex = '1000';
            document.body.appendChild(scoreElement);
        }
        scoreElement.textContent = `Score: ${this.score}`;
    }
    
    render() {
        // Clear canvas with dark background
        this.ctx.fillStyle = '#2a2a2a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        if (this.gameState === 'celebrating') {
            this.renderCelebration();
            return;
        }
        
        // Render maze
        if (this.maze && this.maze.grid) {
            this.maze.render(this.ctx, this.cellSize);
        }
        
        // Render wall break effects
        this.renderWallBreakEffects();
        
        // Render color dots
        if (this.colorDots) {
            this.colorDots.forEach(dot => {
                dot.render(this.ctx);
            });
        }
        
        // Render enemies
        if (this.enemies) {
            this.enemies.forEach(enemy => {
                enemy.render(this.ctx);
            });
        }
        
        // Render player
        if (this.player) {
            this.player.render(this.ctx);
        }
        
        // Render rainbow trail if colors collected
        this.renderRainbowTrail();
        
        // Render rainbow complete effect if active
        this.renderRainbowCompleteEffect();
    }

    renderWallBreakEffects() {
        if (!this.wallBreakEffects) return;
        
        this.wallBreakEffects.forEach(effect => {
            effect.particles.forEach(particle => {
                const alpha = particle.life;
                
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = '#888';
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
            });
        });
    }
    
    renderRainbowTrail() {
        if (this.collectedColors.length === 0 || this.playerTrail.length < 2) return;
        
        // Calculate spacing between colors - each color gets a segment with gaps
        const segmentLength = 4; // Number of trail positions per color segment
        const gapLength = 2; // Number of empty positions between color segments
        const totalSegmentSize = segmentLength + gapLength;
        
        this.collectedColors.forEach((color, colorIndex) => {
            // Calculate the starting position for this color segment
            const segmentStart = (colorIndex * totalSegmentSize) + gapLength; // Start after initial gap
            const segmentEnd = segmentStart + segmentLength;
            
            // Skip if this segment is beyond our trail
            if (segmentStart >= this.playerTrail.length) return;
            
            // Draw the color segment
            for (let i = segmentStart; i < Math.min(segmentEnd, this.playerTrail.length); i++) {
                const trailPos = this.playerTrail[i];
                const segmentProgress = (i - segmentStart) / (segmentLength - 1);
                
                // Size varies within the segment - larger at the front, smaller at the back
                const baseSize = 8 - (colorIndex * 0.2); // Slight size decrease for older colors
                const sizeMultiplier = 1 - (segmentProgress * 0.4); // Size decreases within segment
                const dotSize = Math.max(3, baseSize * sizeMultiplier);
                
                // Alpha decreases for older trail positions but stays strong within each segment
                const segmentAlpha = Math.max(0.4, 1 - (colorIndex * 0.05)); // Very gradual fade per color
                const positionAlpha = 1 - (segmentProgress * 0.3); // Slight fade within segment
                const alpha = segmentAlpha * positionAlpha;
                
                // Create the main dot
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(trailPos.x, trailPos.y, dotSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Add glow effect
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 12;
                this.ctx.beginPath();
                this.ctx.arc(trailPos.x, trailPos.y, dotSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                
                // Draw connecting line to previous dot within the same segment
                if (i > segmentStart && i > 0) {
                    const prevPos = this.playerTrail[i - 1];
                    this.ctx.save();
                    this.ctx.globalAlpha = alpha * 0.7;
                    this.ctx.strokeStyle = color;
                    this.ctx.lineWidth = dotSize * 0.6;
                    this.ctx.lineCap = 'round';
                    this.ctx.beginPath();
                    this.ctx.moveTo(prevPos.x, prevPos.y);
                    this.ctx.lineTo(trailPos.x, trailPos.y);
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            }
        });
    }
    
    renderCelebration() {
        // Create a dramatic starry background
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, '#000428');
        gradient.addColorStop(1, '#004e92');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Add twinkling stars
        this.renderStars();
        
        // Render the main rainbow wave
        this.renderRainbowWave();
        
        // Render celebration text
        this.renderCelebrationText();
        
        // Render continue instruction
        this.renderContinueText();
    }
    
    renderStars() {
        const time = Date.now() * 0.002;
        this.ctx.fillStyle = '#ffffff';
        
        for (let i = 0; i < 50; i++) {
            const x = (i * 16.7) % this.width;
            const y = (i * 23.3) % this.height;
            const twinkle = Math.sin(time + i) * 0.5 + 0.5;
            
            this.ctx.globalAlpha = twinkle * 0.8;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1 + twinkle, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }
    
    renderRainbowWave() {
        const time = Date.now() - this.celebrationStartTime;
        const amplitude = 80;
        const frequency = 0.02;
        const waveSpeed = 0.005;
        const centerY = this.height / 2;
        
        // Draw multiple rainbow arcs
        for (let arc = 0; arc < 3; arc++) {
            const arcOffset = arc * 40;
            
            for (let colorIndex = 0; colorIndex < this.rainbowColors.length; colorIndex++) {
                this.ctx.strokeStyle = this.rainbowColors[colorIndex];
                this.ctx.lineWidth = 8;
                this.ctx.globalAlpha = 0.8 - arc * 0.2;
                
                this.ctx.beginPath();
                
                for (let x = 0; x <= this.width; x += 2) {
                    const waveY = centerY + 
                        Math.sin(x * frequency + time * waveSpeed + this.celebrationWaveOffset) * amplitude +
                        Math.sin(x * frequency * 2 + time * waveSpeed * 1.5) * (amplitude * 0.3) -
                        colorIndex * 12 - arcOffset;
                    
                    if (x === 0) {
                        this.ctx.moveTo(x, waveY);
                    } else {
                        this.ctx.lineTo(x, waveY);
                    }
                }
                
                this.ctx.stroke();
            }
        }
        
        this.ctx.globalAlpha = 1;
    }
    
    renderCelebrationText() {
        const time = Date.now() - this.celebrationStartTime;
        const pulse = Math.sin(time * 0.008) * 0.2 + 1;
        
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Main celebration text
        this.ctx.font = `${Math.floor(48 * pulse)}px Arial`;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        
        const mainText = '🌈 RAINBOW COMPLETE! 🌈';
        this.ctx.strokeText(mainText, this.width / 2, this.height / 2 - 100);
        this.ctx.fillText(mainText, this.width / 2, this.height / 2 - 100);
        
        // Subtitle
        this.ctx.font = '24px Arial';
        const subText = 'Congratulations! You collected all the colors!';
        this.ctx.strokeText(subText, this.width / 2, this.height / 2 - 50);
        this.ctx.fillText(subText, this.width / 2, this.height / 2 - 50);
        
        this.ctx.restore();
    }
    
    renderContinueText() {
        const time = Date.now() - this.celebrationStartTime;
        const blink = Math.sin(time * 0.01) > 0;
        
        if (blink) {
            this.ctx.save();
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.font = '20px Arial';
            this.ctx.fillStyle = '#ffff00';
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            
            const continueText = 'Press any key to play again';
            this.ctx.strokeText(continueText, this.width / 2, this.height / 2 + 100);
            this.ctx.fillText(continueText, this.width / 2, this.height / 2 + 100);
            
            this.ctx.restore();
        }
    }
    
    startRainbowCompleteEffect() {
        // Store the effect data for a brief visual celebration
        this.rainbowCompleteEffect = {
            startTime: Date.now(),
            duration: 2000 // 2 seconds
        };
    }
    
    renderRainbowCompleteEffect() {
        if (!this.rainbowCompleteEffect) return;
        
        const elapsed = Date.now() - this.rainbowCompleteEffect.startTime;
        if (elapsed > this.rainbowCompleteEffect.duration) {
            this.rainbowCompleteEffect = null;
            return;
        }
        
        const progress = elapsed / this.rainbowCompleteEffect.duration;
        const alpha = Math.sin(progress * Math.PI) * 0.8; // Fade in and out
        
        // Create a rainbow burst effect
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        
        const text = '🌈 RAINBOW COMPLETE! 🌈';
        const x = this.width / 2;
        const y = 80;
        
        this.ctx.strokeText(text, x, y);
        this.ctx.fillText(text, x, y);
        this.ctx.restore();
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

class Maze {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
    }
    
    generate() {
        // Initialize grid with walls
        for (let y = 0; y < this.rows; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.grid[y][x] = 1; // 1 = wall, 0 = path
            }
        }
        
        // Create paths using recursive backtracking
        this.carvePassage(1, 1);
        
        // Add additional paths to ensure connectivity and avoid bottlenecks
        this.addAlternatePaths();
        
        // Create wider corridors in some areas
        this.widenCorridors();
        
        // Ensure player starting area is clear and accessible
        this.clearStartingArea();
    }
    
    carvePassage(x, y) {
        this.grid[y][x] = 0;
        
        const directions = [
            [0, -2], [2, 0], [0, 2], [-2, 0]
        ];
        
        // Shuffle directions
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx > 0 && nx < this.cols - 1 && ny > 0 && ny < this.rows - 1 && this.grid[ny][nx] === 1) {
                this.grid[y + dy / 2][x + dx / 2] = 0;
                this.carvePassage(nx, ny);
            }
        }
    }
    
    addAlternatePaths() {
        // Add some random connections to create loops and alternate routes
        const numConnections = Math.floor((this.cols * this.rows) / 80);
        
        for (let i = 0; i < numConnections; i++) {
            let attempts = 0;
            while (attempts < 50) {
                const x = 2 + Math.floor(Math.random() * (this.cols - 4));
                const y = 2 + Math.floor(Math.random() * (this.rows - 4));
                
                // Only add paths where they connect existing paths
                if (this.grid[y][x] === 1) {
                    let adjacentPaths = 0;
                    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
                    
                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.grid[ny][nx] === 0) {
                            adjacentPaths++;
                        }
                    }
                    
                    // Create connection if it would connect at least 2 paths
                    if (adjacentPaths >= 2) {
                        this.grid[y][x] = 0;
                        break;
                    }
                }
                attempts++;
            }
        }
    }
    
    widenCorridors() {
        // Create some 2x2 open areas to give more maneuvering space
        const numAreas = Math.floor((this.cols * this.rows) / 200);
        
        for (let i = 0; i < numAreas; i++) {
            let attempts = 0;
            while (attempts < 30) {
                const x = 2 + Math.floor(Math.random() * (this.cols - 5));
                const y = 2 + Math.floor(Math.random() * (this.rows - 5));
                
                // Check if we can create a 2x2 area
                let canCreate = true;
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        if (this.grid[y + dy][x + dx] === 1) {
                            // Check if at least one adjacent cell is already a path
                            let hasAdjacentPath = false;
                            const checkDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                            for (const [cdx, cdy] of checkDirs) {
                                const cx = x + dx + cdx;
                                const cy = y + dy + cdy;
                                if (cx >= 0 && cx < this.cols && cy >= 0 && cy < this.rows && this.grid[cy][cx] === 0) {
                                    hasAdjacentPath = true;
                                    break;
                                }
                            }
                            if (!hasAdjacentPath) {
                                canCreate = false;
                                break;
                            }
                        }
                    }
                    if (!canCreate) break;
                }
                
                if (canCreate) {
                    for (let dy = 0; dy < 2; dy++) {
                        for (let dx = 0; dx < 2; dx++) {
                            this.grid[y + dy][x + dx] = 0;
                        }
                    }
                    break;
                }
                attempts++;
            }
        }
    }
    
    clearStartingArea() {
        // Ensure a 3x3 area around the starting position is accessible
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
                if (x < this.cols && y < this.rows) {
                    this.grid[y][x] = 0;
                }
            }
        }
        
        // Ensure there's at least one path leading away from start
        if (this.cols > 5) this.grid[1][4] = 0;
        if (this.rows > 5) this.grid[4][1] = 0;
    }
    
    render(ctx, cellSize) {
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === 1) {
                    // Wall
                    ctx.fillStyle = '#4a4a4a';
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    
                    // Add border for 3D effect
                    ctx.strokeStyle = '#6a6a6a';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                } else {
                    // Path
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
        }
    }
}

class Player {
    constructor(gridX, gridY, cellSize) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.cellSize = cellSize;
        this.x = gridX * cellSize;
        this.y = gridY * cellSize;
        
        // Smooth movement properties
        this.targetX = this.x;
        this.targetY = this.y;
        this.speed = 0.15; // Movement interpolation speed (0-1, higher = faster)
        this.moveThreshold = 0.8; // How close to target before allowing new movement
        this.isMoving = false;
        this.lastMoveTime = 0;
        this.moveDelay = 150; // Minimum milliseconds between grid movements
    }
    
    move(dx, dy, maze) {
        const currentTime = Date.now();
        
        // Prevent too rapid movement changes
        if (currentTime - this.lastMoveTime < this.moveDelay) {
            return;
        }
        
        // Only allow new movement if we're close to our current target
        const distToTarget = Math.sqrt(
            Math.pow(this.x - this.targetX, 2) + Math.pow(this.y - this.targetY, 2)
        );
        
        if (this.isMoving && distToTarget > this.cellSize * this.moveThreshold) {
            return;
        }
        
        const newGridX = this.gridX + dx;
        const newGridY = this.gridY + dy;
        
        // Check bounds and walls
        if (newGridX >= 0 && newGridX < maze.cols && 
            newGridY >= 0 && newGridY < maze.rows && 
            maze.grid[newGridY][newGridX] === 0) {
            
            this.gridX = newGridX;
            this.gridY = newGridY;
            this.targetX = newGridX * this.cellSize;
            this.targetY = newGridY * this.cellSize;
            this.isMoving = true;
            this.lastMoveTime = currentTime;
        }
    }
    
    update() {
        // Smoothly interpolate towards target position
        if (this.isMoving) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            
            this.x += dx * this.speed;
            this.y += dy * this.speed;
            
            // Check if we've reached the target (within a small threshold)
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.isMoving = false;
            }
        }
    }
    
    render(ctx) {
        const centerX = this.x + this.cellSize / 2;
        const centerY = this.y + this.cellSize / 2;
        
        // Draw girl character
        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(centerX, centerY - 3, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Hair
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.arc(centerX, centerY - 5, 7, Math.PI, 2 * Math.PI);
        ctx.fill();
        
        // Body (dress)
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.arc(centerX, centerY + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(centerX - 2, centerY - 4, 1, 1);
        ctx.fillRect(centerX + 1, centerY - 4, 1, 1);
        
        // Smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY - 2, 2, 0, Math.PI);
        ctx.stroke();
    }
}

class Enemy {
    constructor(gridX, gridY, cellSize) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.cellSize = cellSize;
        this.x = gridX * cellSize;
        this.y = gridY * cellSize;
        this.moveTimer = 0;
        this.moveDelay = 60 + Math.random() * 60; // Random movement speed
    }
    
    update(maze) {
        // Enemies are now stationary by default
        // They don't move unless specifically told to do so
        // You can add movement logic here later if needed
    }
    
    render(ctx) {
        const centerX = this.x + this.cellSize / 2;
        const centerY = this.y + this.cellSize / 2;
        
        // Draw poop emoji style enemy
        ctx.fillStyle = '#8b4513';
        
        // Main body
        ctx.beginPath();
        ctx.arc(centerX, centerY + 2, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Top swirl
        ctx.beginPath();
        ctx.arc(centerX, centerY - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Small top
        ctx.beginPath();
        ctx.arc(centerX + 1, centerY - 5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(centerX - 2, centerY, 2, 2);
        ctx.fillRect(centerX + 1, centerY, 2, 2);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(centerX - 1, centerY + 1, 1, 1);
        ctx.fillRect(centerX + 2, centerY + 1, 1, 1);
        
        // Smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY + 3, 2, 0, Math.PI);
        ctx.stroke();
    }
}

class ColorDot {
    constructor(gridX, gridY, cellSize, color) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.cellSize = cellSize;
        this.x = gridX * cellSize + cellSize / 2; // Start at center of cell
        this.y = gridY * cellSize + cellSize / 2;
        this.color = color;
        this.floatOffset = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
        
        // Fairy-like movement properties
        this.velocity = { x: 0, y: 0 };
        this.targetVelocity = { x: 0, y: 0 };
        this.speed = 0.3 + Math.random() * 0.4; // Random speed between 0.3 and 0.7
        this.directionChangeTimer = 0;
        this.directionChangeDelay = 60 + Math.random() * 120; // Change direction every 1-3 seconds
        this.maxDistance = cellSize * 1.5; // Maximum distance from original grid position
        this.originalX = this.x;
        this.originalY = this.y;
        this.flutterIntensity = 0.5 + Math.random() * 0.5; // How erratic the movement is
    }
    
    update() {
        this.floatOffset += 0.1;
        this.pulsePhase += 0.1;
        this.directionChangeTimer++;
        
        // Change direction periodically or when too far from original position
        const distanceFromOrigin = Math.sqrt(
            Math.pow(this.x - this.originalX, 2) + Math.pow(this.y - this.originalY, 2)
        );
        
        if (this.directionChangeTimer >= this.directionChangeDelay || distanceFromOrigin > this.maxDistance) {
            this.chooseNewDirection(distanceFromOrigin > this.maxDistance);
            this.directionChangeTimer = 0;
            this.directionChangeDelay = 30 + Math.random() * 90; // Vary the timing
        }
        
        // Smoothly interpolate towards target velocity
        this.velocity.x += (this.targetVelocity.x - this.velocity.x) * 0.1;
        this.velocity.y += (this.targetVelocity.y - this.velocity.y) * 0.1;
        
        // Add some flutter/erratic movement
        const flutter = Math.sin(this.floatOffset * 3) * this.flutterIntensity;
        const flutterX = Math.cos(this.floatOffset * 2.3 + flutter) * 0.3;
        const flutterY = Math.sin(this.floatOffset * 1.7 + flutter) * 0.3;
        
        // Apply movement
        this.x += this.velocity.x + flutterX;
        this.y += this.velocity.y + flutterY;
        
        // Update grid position for collision detection
        this.gridX = Math.floor(this.x / this.cellSize);
        this.gridY = Math.floor(this.y / this.cellSize);
    }
    
    chooseNewDirection(returnToOrigin = false) {
        if (returnToOrigin) {
            // Move back towards original position
            const dx = this.originalX - this.x;
            const dy = this.originalY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                this.targetVelocity.x = (dx / distance) * this.speed;
                this.targetVelocity.y = (dy / distance) * this.speed;
            }
        } else {
            // Choose a random direction
            const angle = Math.random() * Math.PI * 2;
            const speedVariation = 0.5 + Math.random() * 0.5; // Vary speed
            
            this.targetVelocity.x = Math.cos(angle) * this.speed * speedVariation;
            this.targetVelocity.y = Math.sin(angle) * this.speed * speedVariation;
        }
    }
    
    render(ctx) {
        const centerX = this.x;
        const centerY = this.y + Math.sin(this.floatOffset) * 2;
        const radius = 5 + Math.sin(this.pulsePhase) * 1;
        
        // Add trailing sparkle effect for fairy-like appearance
        const trailLength = 3;
        for (let i = 0; i < trailLength; i++) {
            const trailAlpha = (1 - i / trailLength) * 0.3;
            const trailSize = radius * (1 - i * 0.2);
            const trailX = centerX - this.velocity.x * i * 3;
            const trailY = centerY - this.velocity.y * i * 3;
            
            ctx.save();
            ctx.globalAlpha = trailAlpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(trailX, trailY, trailSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Glow effect
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20; // Increased glow for fairy effect
        
        // Main dot
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX - 1, centerY - 1, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Sparkle effect
        const sparkleTime = Date.now() * 0.01;
        for (let i = 0; i < 3; i++) {
            const sparkleAngle = sparkleTime + i * (Math.PI * 2 / 3);
            const sparkleDistance = radius + 8 + Math.sin(sparkleTime * 2 + i) * 3;
            const sparkleX = centerX + Math.cos(sparkleAngle) * sparkleDistance;
            const sparkleY = centerY + Math.sin(sparkleAngle) * sparkleDistance;
            const sparkleAlpha = (Math.sin(sparkleTime * 3 + i * 1.5) + 1) * 0.3;
            
            ctx.save();
            ctx.globalAlpha = sparkleAlpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.shadowBlur = 0;
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new Game();
});
