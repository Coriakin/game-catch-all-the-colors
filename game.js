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
        
        // Game state
        this.gameState = 'playing'; // 'playing' or 'celebrating'
        this.celebrationStartTime = 0;
        this.celebrationWaveOffset = 0;
        
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
        // Spawn rainbow colors in random order
        const availableColors = [...this.rainbowColors];
        
        for (let i = 0; i < 7; i++) {
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
            
            const colorIndex = Math.floor(Math.random() * availableColors.length);
            const color = availableColors.splice(colorIndex, 1)[0];
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
        this.colorDots = this.colorDots.filter(dot => {
            if (this.player.gridX === dot.gridX && this.player.gridY === dot.gridY) {
                this.collectColor(dot.color);
                return false;
            }
            return true;
        });
        
        // Update UI
        this.updateUI();
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
        
        // Lose last collected color
        if (this.collectedColors.length > 0) {
            const lostColor = this.collectedColors.pop();
            // Respawn the lost color somewhere in the maze
            let x, y;
            do {
                x = Math.floor(Math.random() * this.cols);
                y = Math.floor(Math.random() * this.rows);
            } while (
                this.maze.grid[y][x] === 1 || 
                (x === 1 && y === 1) ||
                this.colorDots.some(dot => dot.x === x && dot.y === y) ||
                this.enemies.some(enemy => enemy.gridX === x && enemy.gridY === y)
            );
            
            this.colorDots.push(new ColorDot(x, y, this.cellSize, lostColor));
        }
    }
    
    collectColor(color) {
        this.collectedColors.push(color);
        
        // Check if rainbow is complete
        if (this.collectedColors.length === 7) {
            this.startCelebration();
        }
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
        
        this.collectedColors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-dot';
            colorDiv.style.backgroundColor = color;
            colorsDisplay.appendChild(colorDiv);
        });
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
        if (this.collectedColors.length === 0) return;
        
        const time = Date.now() * 0.005;
        this.collectedColors.forEach((color, index) => {
            const angle = time + index * 0.8;
            const radius = 30 + index * 5;
            const x = this.player.x + this.cellSize / 2 + Math.cos(angle) * radius;
            const y = this.player.y + this.cellSize / 2 + Math.sin(angle) * radius;
            
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add glow effect
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
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
        this.moveTimer++;
        
        if (this.moveTimer >= this.moveDelay) {
            this.moveTimer = 0;
            this.moveDelay = 60 + Math.random() * 60;
            
            // Random movement
            const directions = [
                [0, -1], [1, 0], [0, 1], [-1, 0]
            ];
            
            const direction = directions[Math.floor(Math.random() * directions.length)];
            const newX = this.gridX + direction[0];
            const newY = this.gridY + direction[1];
            
            // Check bounds and walls
            if (newX >= 0 && newX < maze.cols && newY >= 0 && newY < maze.rows && maze.grid[newY][newX] === 0) {
                this.gridX = newX;
                this.gridY = newY;
                this.x = newX * this.cellSize;
                this.y = newY * this.cellSize;
            }
        }
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
        this.x = gridX * cellSize;
        this.y = gridY * cellSize;
        this.color = color;
        this.floatOffset = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
    }
    
    update() {
        this.floatOffset += 0.1;
        this.pulsePhase += 0.1;
    }
    
    render(ctx) {
        const centerX = this.x + this.cellSize / 2;
        const centerY = this.y + this.cellSize / 2 + Math.sin(this.floatOffset) * 2;
        const radius = 5 + Math.sin(this.pulsePhase) * 1;
        
        // Glow effect
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        // Main dot
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(centerX - 1, centerY - 1, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new Game();
});
