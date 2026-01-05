import * as THREE from 'three';

// Health bar UI system
class HealthBar {
    constructor(scene, target, options = {}) {
        this.scene = scene;
        this.target = target;
        this.maxHealth = options.maxHealth || 100;
        this.currentHealth = this.maxHealth;
        this.width = options.width || 1.0;
        this.height = options.height || 0.05; // Ultra-thin modern design
        this.offset = options.offset || new THREE.Vector3(0, 1.5, 0);
        this.visible = options.visible !== false;
        this.animatedHealth = this.currentHealth; // For smooth animations

        // Create health bar group
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // Outer glow/shadow layer (subtle)
        const glowGeometry = new THREE.PlaneGeometry(this.width + 0.04, this.height + 0.04);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.3
        });
        this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glow.position.set(0, 0, -0.03);
        this.group.add(this.glow);

        // Background (sleek dark)
        const bgGeometry = new THREE.PlaneGeometry(this.width, this.height);
        const bgMaterial = new THREE.MeshBasicMaterial({
            color: 0x0a0a0a,
            transparent: true,
            opacity: 0.75
        });
        this.background = new THREE.Mesh(bgGeometry, bgMaterial);
        this.background.position.set(0, 0, -0.01);
        this.group.add(this.background);

        // Damage indicator (red layer behind health)
        const damageGeometry = new THREE.PlaneGeometry(this.width, this.height);
        const damageMaterial = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            transparent: true,
            opacity: 0.7
        });
        this.damageBar = new THREE.Mesh(damageGeometry, damageMaterial);
        this.damageBar.position.set(-this.width * 0.5, 0, -0.005);
        this.damageBar.scale.x = 1.0;
        this.group.add(this.damageBar);

        // Health bar (gradient effect) - positioned to empty from right to left
        const healthGeometry = new THREE.PlaneGeometry(this.width, this.height);
        const healthMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.95
        });
        this.healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
        this.healthBar.position.set(-this.width * 0.5, 0, 0);
        this.group.add(this.healthBar);

        // Inner glow for health bar (subtle highlight)
        const innerGlowGeometry = new THREE.PlaneGeometry(this.width, this.height * 0.3);
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25
        });
        this.innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        this.innerGlow.position.set(-this.width * 0.5, this.height * 0.1, 0.001);
        this.group.add(this.innerGlow);

        // Sleek border (ultra-thin outline)
        const borderGeometry = new THREE.PlaneGeometry(this.width + 0.015, this.height + 0.015);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xaaaaaa,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        this.border = new THREE.Mesh(borderGeometry, borderMaterial);
        this.border.position.set(0, 0, -0.02);
        this.group.add(this.border);

        this.updatePosition();
        this.updateHealth();
    }

    updatePosition() {
        if (!this.target || !this.target.position) return;

        // Position above target
        this.group.position.copy(this.target.position);
        this.group.position.add(this.offset);

        // Always face camera (billboard effect)
        if (this.scene.userData.camera) {
            this.group.lookAt(this.scene.userData.camera.position);
        }
    }

    setHealth(health) {
        this.currentHealth = Math.max(0, Math.min(this.maxHealth, health));
        this.updateHealth();
    }

    getHealth() {
        return this.currentHealth;
    }

    getHealthPercentage() {
        return this.currentHealth / this.maxHealth;
    }

    takeDamage(damage) {
        this.setHealth(this.currentHealth - damage);
        return this.currentHealth <= 0;
    }

    heal(amount) {
        this.setHealth(this.currentHealth + amount);
    }

    updateHealth(deltaTime = 0.016) {
        const percentage = this.getHealthPercentage();

        // Smooth animation for health changes
        const animSpeed = 3.0; // Speed of health bar animation
        const diff = this.currentHealth - this.animatedHealth;
        if (Math.abs(diff) > 0.1) {
            this.animatedHealth += diff * animSpeed * deltaTime;
        } else {
            this.animatedHealth = this.currentHealth;
        }
        const animPercentage = this.animatedHealth / this.maxHealth;

        // Scale health bar from right to left (scale from left edge)
        this.healthBar.scale.x = animPercentage;
        this.healthBar.position.x = -this.width * 0.5 + (this.width * animPercentage * 0.5);

        // Scale inner glow with health bar
        this.innerGlow.scale.x = animPercentage;
        this.innerGlow.position.x = -this.width * 0.5 + (this.width * animPercentage * 0.5);

        // Damage bar (red indicator) follows slowly
        this.damageBar.scale.x = Math.max(animPercentage, this.damageBar.scale.x - 0.8 * deltaTime);
        this.damageBar.position.x = -this.width * 0.5 + (this.width * this.damageBar.scale.x * 0.5);

        // Modern vibrant color based on health percentage
        if (percentage > 0.6) {
            this.healthBar.material.color.setHex(0x00ffaa); // Vibrant cyan-green
            this.border.material.color.setHex(0x00dd88);
            this.innerGlow.material.opacity = 0.3;
        } else if (percentage > 0.3) {
            this.healthBar.material.color.setHex(0xffbb33); // Vibrant orange
            this.border.material.color.setHex(0xff9900);
            this.innerGlow.material.opacity = 0.28;
        } else {
            this.healthBar.material.color.setHex(0xff3355); // Bright red
            this.border.material.color.setHex(0xff1144);
            this.innerGlow.material.opacity = 0.4;
            // Pulse effect when critical
            const pulse = Math.sin(Date.now() * 0.008) * 0.15 + 0.85;
            this.healthBar.material.opacity = pulse;
        }

        // Hide if health is 0
        this.group.visible = this.visible && this.currentHealth > 0;
    }

    setVisible(visible) {
        this.visible = visible;
        this.group.visible = this.visible && this.currentHealth > 0;
    }

    dispose() {
        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
        this.glow.geometry.dispose();
        this.glow.material.dispose();
        this.background.geometry.dispose();
        this.background.material.dispose();
        this.damageBar.geometry.dispose();
        this.damageBar.material.dispose();
        this.healthBar.geometry.dispose();
        this.healthBar.material.dispose();
        this.innerGlow.geometry.dispose();
        this.innerGlow.material.dispose();
        this.border.geometry.dispose();
        this.border.material.dispose();
    }
}

// Point system class
class PointSystem {
    constructor(scene, camera, player = null) {
        this.scene = scene;
        this.camera = camera;
        this.player = player; // Store player reference for defeat animation
        this.scene.userData.camera = camera; // For health bar billboard effect

        // Game state
        this.playerHealth = 100;
        this.enemyHealth = 100;
        this.gameOver = false;
        this.winner = null;
        this.onEnemyDefeated = null;

        // Spell energy system (scalable)
        // Energy is measured in discrete units but stored as float for regen.
        // Default: 3 max units, 1 unit per cast, slow regen.
        this.spellMaxEnergy = 3;
        this.spellEnergy = this.spellMaxEnergy; // start full
        this.spellCostPerCast = 1; // consume 1/3 per cast
        this.spellRegenPerSecond = 0.2; // units per second (fills 3 units in ~15s)
        this._lastUpdateTimeMs = performance.now();

        // Health bars
        this.playerHealthBar = null;
        this.enemyHealthBar = null;

        // UI elements (only game over overlay retained)
        this.uiContainer = null;
        this.scoreElement = null;
        this.healthElement = null;
        this.gameOverElement = null;
        // Spell bar UI elements
        this.spellBarContainer = null;
        this.spellBarFrame = null;
        this.spellBarFill = null;
        this.spellBarIcon = null;
        this._spellFrameBaseBorder = null;
        this._spellFrameBaseShadow = null;
        this._spellWarningTimeout = null;

        this.createUI();
    }

    createUI() {
        // Game over display (only HUD we keep; initially hidden)
        this.gameOverElement = document.createElement('div');
        this.gameOverElement.style.position = 'fixed';
        this.gameOverElement.style.top = '50%';
        this.gameOverElement.style.left = '50%';
        this.gameOverElement.style.transform = 'translate(-50%, -50%)';
        this.gameOverElement.style.fontSize = '48px';
        this.gameOverElement.style.fontWeight = 'bold';
        this.gameOverElement.style.textAlign = 'center';
        this.gameOverElement.style.textShadow = '4px 4px 8px rgba(0,0,0,0.8)';
        this.gameOverElement.style.display = 'none';
        this.gameOverElement.style.zIndex = '10001';
        this.gameOverElement.style.pointerEvents = 'none';

        document.body.appendChild(this.gameOverElement);

        // Spell bar container (fixed bottom-left)
        try {
            this.spellBarContainer = document.createElement('div');
            this.spellBarContainer.style.position = 'fixed';
            this.spellBarContainer.style.right = '60px';
            this.spellBarContainer.style.bottom = '200px';
            this.spellBarContainer.style.width = '140px';
            this.spellBarContainer.style.height = '64px';
            this.spellBarContainer.style.transform = 'scale(1.5)';
            this.spellBarContainer.style.transformOrigin = 'right bottom';
            this.spellBarContainer.style.zIndex = '1000';
            this.spellBarContainer.style.pointerEvents = 'none';
            this.spellBarContainer.style.display = 'none'; // Hidden by default until scene is ready

            // Frame: translucent rounded rectangle with subtle border
            this.spellBarFrame = document.createElement('div');
            this.spellBarFrame.style.position = 'absolute';
            this.spellBarFrame.style.inset = '0';
            this.spellBarFrame.style.borderRadius = '14px';
            this.spellBarFrame.style.background = 'rgba(20,20,25,0.25)';
            this.spellBarFrame.style.backdropFilter = 'blur(2px)';
            this.spellBarFrame.style.border = '2px solid rgba(255,255,255,0.35)';
            this.spellBarFrame.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35) inset, 0 2px 8px rgba(0,0,0,0.25)';
            this._spellFrameBaseBorder = this.spellBarFrame.style.border;
            this._spellFrameBaseShadow = this.spellBarFrame.style.boxShadow;

            // Liquid fill: clipped inside with rounded corners
            this.spellBarFill = document.createElement('div');
            this.spellBarFill.style.position = 'absolute';
            this.spellBarFill.style.left = '8px';
            this.spellBarFill.style.bottom = '8px';
            this.spellBarFill.style.height = '48px';
            this.spellBarFill.style.width = '124px';
            this.spellBarFill.style.borderRadius = '12px';
            this.spellBarFill.style.overflow = 'hidden';
            // Use a blue gradient to look like liquid; inner bar uses width to represent energy
            const inner = document.createElement('div');
            inner.style.position = 'absolute';
            inner.style.left = '0';
            inner.style.top = '0';
            inner.style.bottom = '0';
            inner.style.width = '100%';
            inner.style.background = 'linear-gradient(180deg, rgba(120,190,255,0.95) 0%, rgba(40,120,255,0.95) 70%, rgba(10,80,220,0.95) 100%)';
            inner.style.boxShadow = 'inset 0 6px 10px rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.35)';
            inner.style.transition = 'transform 200ms ease-out';
            inner.style.transformOrigin = 'left center';
            inner.dataset.role = 'spell-inner-fill';
            this.spellBarFill.appendChild(inner);

            // Icon PNG overlay (centered). Replace src with your asset as needed.
            this.spellBarIcon = document.createElement('img');
            this.spellBarIcon.alt = 'Spell';
            this.spellBarIcon.src = '/storm.png'; // place a png at /public/spell.png or adjust path
            this.spellBarIcon.style.position = 'absolute';
            // Fill the available rounded frame area while preserving aspect ratio
            this.spellBarIcon.style.width = '100%';
            this.spellBarIcon.style.height = '100%';
            this.spellBarIcon.style.padding = '10px';
            this.spellBarIcon.style.boxSizing = 'border-box';
            this.spellBarIcon.style.objectFit = 'contain';
            this.spellBarIcon.style.left = '50%';
            this.spellBarIcon.style.top = '50%';
            this.spellBarIcon.style.transform = 'translate(-50%, -50%)';
            // this.spellBarIcon.style.opacity = '0.95';
            this.spellBarIcon.style.pointerEvents = 'none';

            this.spellBarContainer.appendChild(this.spellBarFrame);
            this.spellBarContainer.appendChild(this.spellBarFill);
            this.spellBarContainer.appendChild(this.spellBarIcon);
            document.body.appendChild(this.spellBarContainer);

            // Initial fill
            this.updateSpellBarUI();
        } catch (_) { /* non-DOM env */ }
    }

    flashSpellBarWarning(duration = 450) {
        if (!this.spellBarFrame) return;
        if (this._spellWarningTimeout) {
            clearTimeout(this._spellWarningTimeout);
        }
        this.spellBarFrame.style.border = '2px solid rgba(255,80,80,0.95)';
        this.spellBarFrame.style.boxShadow = '0 0 16px rgba(255,60,60,0.85), 0 0 8px rgba(255,20,20,0.75)';
        this._spellWarningTimeout = setTimeout(() => {
            this.spellBarFrame.style.border = this._spellFrameBaseBorder || '2px solid rgba(255,255,255,0.35)';
            this.spellBarFrame.style.boxShadow = this._spellFrameBaseShadow || '0 4px 12px rgba(0,0,0,0.35) inset, 0 2px 8px rgba(0,0,0,0.25)';
            this._spellWarningTimeout = null;
        }, duration);
    }

    createPlayerHealthBar(player) {
        if (this.playerHealthBar) {
            this.playerHealthBar.dispose();
        }

        this.playerHealthBar = new HealthBar(this.scene, player, {
            maxHealth: 100,
            width: 0.5,
            height: 0.02,
            offset: new THREE.Vector3(0, 1, 0)
        });
    }

    createEnemyHealthBar(enemy) {
        if (this.enemyHealthBar) {
            this.enemyHealthBar.dispose();
        }

        this.enemyHealthBar = new HealthBar(this.scene, enemy, {
            maxHealth: 100,
            width: 0.7,
            height: 0.05,
            offset: new THREE.Vector3(0, 1.5, 0)
        });
    }

    update() {
        // Regen spell energy over time (continues even after game over/victory)
        const nowMs = performance.now();
        const dt = Math.max(0, (nowMs - this._lastUpdateTimeMs) * 0.001);
        this._lastUpdateTimeMs = nowMs;
        // Always regenerate spell energy (removed gameOver check)
        if (this.spellEnergy < this.spellMaxEnergy) {
            const before = this.spellEnergy;
            this.spellEnergy = Math.min(this.spellMaxEnergy, this.spellEnergy + this.spellRegenPerSecond * dt);
            if ((this.spellEnergy | 0) !== (before | 0) || Math.abs(this.spellEnergy - before) > 0.01) {
                this.updateSpellBarUI();
            }
        }

        // Update health bar positions and animations
        if (this.playerHealthBar) {
            this.playerHealthBar.updatePosition();
            this.playerHealthBar.updateHealth(dt);
        }
        if (this.enemyHealthBar) {
            this.enemyHealthBar.updatePosition();
            this.enemyHealthBar.updateHealth(dt);
        }
    }

    damagePlayer(damage) {
        if (this.gameOver) return;

        this.playerHealth = Math.max(0, this.playerHealth - damage);
        if (this.playerHealthBar) {
            this.playerHealthBar.setHealth(this.playerHealth);
        }

        console.log(`Player took ${damage} damage. Health: ${this.playerHealth}`);

        if (this.playerHealth <= 0) {
            // Trigger defeat animation before ending the game
            if (this.player && typeof this.player.playDefeatAnimation === 'function') {
                try {
                    this.player.playDefeatAnimation();
                } catch (error) {
                    console.warn('Failed to play defeat animation:', error);
                }
            }

            // Trigger external callback for scene-level handling (e.g., death screen, respawn)
            if (this.onPlayerDefeated) {
                this.onPlayerDefeated();
            }

            this.endGame('enemy');
        }
    }

    damageEnemy(damage) {
        if (this.gameOver) return;

        this.enemyHealth = Math.max(0, this.enemyHealth - damage);
        if (this.enemyHealthBar) {
            this.enemyHealthBar.setHealth(this.enemyHealth);
        }

        console.log(`Enemy took ${damage} damage. Health: ${this.enemyHealth}`);

        if (this.enemyHealth <= 0) {
            try {
                if (typeof this.onEnemyDefeated === 'function') {
                    this.onEnemyDefeated();
                }
            } catch (_) { }
            this.endGame('player');
        }
    }

    healPlayer(amount) {
        // Allow healing even after game over (victory state)
        // Only block healing if player is actually dead
        if (this.playerHealth <= 0 && this.winner === 'enemy') return;

        this.playerHealth = Math.min(100, this.playerHealth + amount);
        if (this.playerHealthBar) {
            this.playerHealthBar.setHealth(this.playerHealth);
            // Force immediate visual update
            this.playerHealthBar.updateHealth();
        }

        console.log(`Player healed by ${amount}. Health: ${this.playerHealth}`);
    }

    healEnemy(amount) {
        if (this.gameOver) return;

        this.enemyHealth = Math.min(100, this.enemyHealth + amount);
        if (this.enemyHealthBar) {
            this.enemyHealthBar.setHealth(this.enemyHealth);
        }

        console.log(`Enemy healed by ${amount}. Health: ${this.enemyHealth}`);
    }

    endGame(winner) {
        if (this.gameOver) return;

        this.gameOver = true;
        this.winner = winner;

        // Show game over screen
        this.gameOverElement.style.display = 'block';

        if (winner === 'player') {
            this.gameOverElement.textContent = 'VICTORY!';
            this.gameOverElement.style.color = '#00ff00';
            console.log('Player defeated the enemy!');
        } else {
            console.log('Enemy defeated the player!');
        }

        // Auto-hide the message after 3 seconds
        setTimeout(() => {
            if (this.gameOverElement) {
                this.gameOverElement.style.display = 'none';
            }
        }, 3000);
    }

    reset() {
        this.playerHealth = 100;
        this.enemyHealth = 100;
        this.gameOver = false;
        this.winner = null;
        // Restore spell energy
        this.spellEnergy = this.spellMaxEnergy;
        this.updateSpellBarUI();

        if (this.playerHealthBar) {
            this.playerHealthBar.setHealth(this.playerHealth);
        }
        if (this.enemyHealthBar) {
            this.enemyHealthBar.setHealth(this.enemyHealth);
        }

        // Reset player defeat state and re-enable controls
        if (this.player && typeof this.player.resetDefeatState === 'function') {
            try {
                this.player.resetDefeatState();
            } catch (error) {
                console.warn('Failed to reset player defeat state:', error);
            }
        }

        this.gameOverElement.style.display = 'none';
    }

    dispose() {
        if (this.playerHealthBar) {
            this.playerHealthBar.dispose();
        }
        if (this.enemyHealthBar) {
            this.enemyHealthBar.dispose();
        }
        if (this.gameOverElement && this.gameOverElement.parentNode) {
            this.gameOverElement.parentNode.removeChild(this.gameOverElement);
        }
        if (this.spellBarContainer && this.spellBarContainer.parentNode) {
            this.spellBarContainer.parentNode.removeChild(this.spellBarContainer);
        }
        if (this._spellWarningTimeout) {
            clearTimeout(this._spellWarningTimeout);
            this._spellWarningTimeout = null;
        }
    }

    setOnEnemyDefeated(callback) {
        this.onEnemyDefeated = callback;
    }

    setOnPlayerDefeated(callback) {
        this.onPlayerDefeated = callback;
    }

    setPlayer(player) {
        this.player = player;
    }

    // ===== Spell energy API =====
    getSpellEnergy() {
        return this.spellEnergy;
    }
    getSpellEnergyPercentage() {
        return this.spellEnergy / this.spellMaxEnergy;
    }
    canCastSpell(cost = this.spellCostPerCast) {
        return this.spellEnergy >= cost - 1e-6;
    }
    consumeSpellEnergy(cost = this.spellCostPerCast) {
        if (!this.canCastSpell(cost)) return false;
        this.spellEnergy = Math.max(0, this.spellEnergy - cost);
        this.updateSpellBarUI();
        return true;
    }
    updateSpellBarUI() {
        if (!this.spellBarFill) return;
        const inner = this.spellBarFill.querySelector('[data-role="spell-inner-fill"]');
        if (!inner) return;
        const pct = Math.max(0, Math.min(1, this.getSpellEnergyPercentage()));
        inner.style.transform = `scaleX(${pct})`;
        // Subtle color shift when low
        if (pct < 0.34) {
            inner.style.filter = 'saturate(1.1) hue-rotate(-10deg)';
        } else if (pct < 0.67) {
            inner.style.filter = 'saturate(1.0)';
        } else {
            inner.style.filter = 'saturate(1.2)';
        }
        // Dim icon when empty
        if (this.spellBarIcon) {
            this.spellBarIcon.style.opacity = pct > 0 ? '0.95' : '0.35';
        }
    }

    // ===== Spell bar visibility control =====
    setSpellBarVisible(visible) {
        if (this.spellBarContainer) {
            this.spellBarContainer.style.display = visible ? 'block' : 'none';
        }
    }

    getSpellBarVisible() {
        if (!this.spellBarContainer) return false;
        return this.spellBarContainer.style.display !== 'none';
    }
}

// Export function to create point system
export function createPointSystem(scene, camera, player = null) {
    return new PointSystem(scene, camera, player);
}

// Export HealthBar class for external use
export { HealthBar };
