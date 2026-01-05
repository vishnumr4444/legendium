/**
 * Scene 1 reward / knowledge UI overlay.
 *
 * This module renders full-screen DOM overlays used when the player collects:
 * - **Life tokens** (small reward card)
 * - **Spell orbs** (small reward card)
 * - **Educational treasures** (a "knowledge card" with image + description)
 *
 * Design goals:
 * - The UI is **non-interactive** (`pointer-events: none`) so it never blocks gameplay input.
 * - Only **one** overlay is visible at a time; subsequent calls replace the previous UI cleanly.
 * - Auto-dismiss behavior is handled by an internal timeout and defensive cleanup.
 *
 * Public API:
 * - `createCollectedUI()` returns helpers like `showTreasure()`, `showBreadboard()`, etc.
 */

export function createCollectedUI() {
    let container = null;
    let isShowing = false;
    let hideTimeout = null;
    let currentUI = null;

    /**
     * Builds and appends the "reward card" overlay to `document.body`.
     *
     * The returned object contains references to key DOM nodes so `show()` can
     * set content and animate them.
     *
     * @returns {{container:HTMLDivElement,backdrop:HTMLDivElement,card:HTMLDivElement,title:HTMLDivElement,iconContainer:HTMLDivElement,itemImage:HTMLImageElement,description:HTMLDivElement,rewardAmount:HTMLDivElement,sparklesContainer:HTMLDivElement}}
     */
    function createUIElements() {
        // Main container
        container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.display = 'none';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.paddingLeft = '15vw';
        container.style.zIndex = '10000';
        container.style.pointerEvents = 'none';

        // Backdrop with fade effect
        const backdrop = document.createElement('div');
        backdrop.className = 'reward-backdrop';
        backdrop.style.position = 'absolute';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.background = 'radial-gradient(circle, rgba(255,215,0,0.15) 0%, rgba(0,0,0,0.5) 100%)';
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.4s ease-out';

        // Reward card
        const card = document.createElement('div');
        card.className = 'reward-card';
        card.style.position = 'relative';
        card.style.background = 'linear-gradient(145deg, rgba(40,40,50,0.95) 0%, rgba(20,20,30,0.98) 100%)';
        card.style.borderRadius = '24px';
        card.style.padding = '50px 60px';
        card.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)';
        card.style.border = '2px solid rgba(255,215,0,0.4)';
        card.style.backdropFilter = 'blur(10px)';
        card.style.transform = 'scale(0.5) translateY(50px)';
        card.style.opacity = '0';
        card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        card.style.maxWidth = '500px';
        card.style.textAlign = 'center';

        // Glow effect behind card
        const glow = document.createElement('div');
        glow.style.position = 'absolute';
        glow.style.top = '50%';
        glow.style.left = '50%';
        glow.style.transform = 'translate(-50%, -50%)';
        glow.style.width = '120%';
        glow.style.height = '120%';
        glow.style.background = 'radial-gradient(circle, rgba(255,215,0,0.2) 0%, transparent 70%)';
        glow.style.borderRadius = '50%';
        glow.style.filter = 'blur(30px)';
        glow.style.animation = 'pulse 2s ease-in-out infinite';
        glow.style.zIndex = '-1';

        // Sparkle particles container
        const sparklesContainer = document.createElement('div');
        sparklesContainer.className = 'sparkles-container';
        sparklesContainer.style.position = 'absolute';
        sparklesContainer.style.top = '0';
        sparklesContainer.style.left = '0';
        sparklesContainer.style.width = '100%';
        sparklesContainer.style.height = '100%';
        sparklesContainer.style.pointerEvents = 'none';
        sparklesContainer.style.overflow = 'hidden';

        // Title
        const title = document.createElement('div');
        title.className = 'reward-title';
        title.style.fontSize = '42px';
        title.style.fontWeight = 'bold';
        title.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%)';
        title.style.webkitBackgroundClip = 'text';
        title.style.backgroundClip = 'text';
        title.style.webkitTextFillColor = 'transparent';
        title.style.textShadow = '0 0 30px rgba(255,215,0,0.5)';
        title.style.marginBottom = '20px';
        title.style.letterSpacing = '2px';
        title.style.animation = 'shimmer 2s ease-in-out infinite';

        // Icon/Image container
        const iconContainer = document.createElement('div');
        iconContainer.className = 'reward-icon';
        iconContainer.style.fontSize = '100px';
        iconContainer.style.margin = '30px 0';
        iconContainer.style.filter = 'drop-shadow(0 0 20px rgba(255,215,0,0.8))';
        iconContainer.style.animation = 'bounce 0.8s ease-in-out infinite';
        iconContainer.style.display = 'flex';
        iconContainer.style.justifyContent = 'center';
        iconContainer.style.alignItems = 'center';

        // Image element for educational items
        const itemImage = document.createElement('img');
        itemImage.className = 'reward-image';
        itemImage.style.display = 'none';
        itemImage.style.maxWidth = '200px';
        itemImage.style.maxHeight = '200px';
        itemImage.style.borderRadius = '12px';
        itemImage.style.boxShadow = '0 0 30px rgba(255,215,0,0.6)';
        itemImage.style.border = '3px solid rgba(255,215,0,0.5)';
        iconContainer.appendChild(itemImage);

        // Description
        const description = document.createElement('div');
        description.className = 'reward-description';
        description.style.fontSize = '20px';
        description.style.color = 'rgba(255,255,255,0.9)';
        description.style.marginTop = '20px';
        description.style.lineHeight = '1.6';
        description.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';

        // Reward amount
        const rewardAmount = document.createElement('div');
        rewardAmount.className = 'reward-amount';
        rewardAmount.style.fontSize = '32px';
        rewardAmount.style.fontWeight = 'bold';
        rewardAmount.style.color = '#00ff88';
        rewardAmount.style.marginTop = '25px';
        rewardAmount.style.textShadow = '0 0 20px rgba(0,255,136,0.6), 0 2px 4px rgba(0,0,0,0.5)';
        rewardAmount.style.animation = 'glow 1.5s ease-in-out infinite';

        // Assemble the card
        card.appendChild(glow);
        card.appendChild(title);
        card.appendChild(iconContainer);
        card.appendChild(description);
        card.appendChild(rewardAmount);

        // Assemble container
        container.appendChild(backdrop);
        container.appendChild(sparklesContainer);
        container.appendChild(card);

        // Add CSS animations
        addAnimationStyles();

        document.body.appendChild(container);

        return { container, backdrop, card, title, iconContainer, itemImage, description, rewardAmount, sparklesContainer };
    }

    /**
     * Injects CSS keyframes required by the reward UI.
     *
     * This is guarded by a static `id` to avoid duplicate `<style>` tags when
     * the UI is shown multiple times.
     */
    function addAnimationStyles() {
        if (document.getElementById('reward-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'reward-ui-styles';
        style.textContent = `
            @keyframes shimmer {
                0%, 100% { filter: brightness(1) hue-rotate(0deg); }
                50% { filter: brightness(1.3) hue-rotate(10deg); }
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-15px) scale(1.05); }
            }
            
            @keyframes glow {
                0%, 100% { text-shadow: 0 0 20px rgba(0,255,136,0.6), 0 2px 4px rgba(0,0,0,0.5); }
                50% { text-shadow: 0 0 30px rgba(0,255,136,0.9), 0 0 40px rgba(0,255,136,0.5), 0 2px 4px rgba(0,0,0,0.5); }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.1); }
            }
            
            @keyframes sparkle {
                0% { opacity: 0; transform: translateY(0) scale(0); }
                50% { opacity: 1; transform: translateY(-100px) scale(1); }
                100% { opacity: 0; transform: translateY(-200px) scale(0); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Adds small looping sparkle particles to the overlay for visual polish.
     *
     * @param {HTMLElement} container - DOM element that will host sparkle elements.
     */
    function createSparkles(container) {
        // Create 20 sparkle particles
        for (let i = 0; i < 20; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.position = 'absolute';
            sparkle.style.left = `${Math.random() * 100}%`;
            sparkle.style.top = `${50 + Math.random() * 50}%`;
            sparkle.style.width = '4px';
            sparkle.style.height = '4px';
            sparkle.style.background = `hsl(${45 + Math.random() * 30}, 100%, 70%)`;
            sparkle.style.borderRadius = '50%';
            sparkle.style.boxShadow = '0 0 6px 2px rgba(255,215,0,0.8)';
            sparkle.style.animation = `sparkle ${1 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s infinite`;
            sparkle.style.pointerEvents = 'none';
            container.appendChild(sparkle);
        }
    }

    /**
     * Displays the small "reward card" overlay.
     *
     * This is used for generic treasure cards and quick pickups.
     * If another overlay is already visible, it is immediately removed so the
     * new one can be shown without stacking.
     *
     * @param {Object} [options]
     * @param {string} [options.title]
     * @param {string} [options.icon] - Emoji icon (ignored if `image` is provided).
     * @param {string|null} [options.image] - Optional image URL/path to display instead of emoji.
     * @param {string} [options.description]
     * @param {string} [options.reward]
     * @param {number} [options.duration] - Auto-hide delay in ms.
     */
    function show(options = {}) {
        // If already showing, immediately clear and show new one
        if (isShowing) {
            // Cancel any pending hide
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            // Immediately remove old UI
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
            container = null;
            currentUI = null;
            isShowing = false;
        }

        isShowing = true;

        const {
            title = '🏆 TREASURE FOUND! 🏆',
            icon = '💎',
            image = null,
            description = 'You discovered a rare treasure!',
            reward = '+30 HP',
            duration = 3000
        } = options;

        const ui = createUIElements();
        currentUI = ui;

        // Set content
        ui.title.textContent = title;

        // Handle icon vs image
        if (image) {
            // Hide emoji icon, show image
            ui.iconContainer.style.fontSize = '0';
            ui.itemImage.src = image;
            ui.itemImage.style.display = 'block';
        } else {
            // Show emoji icon, hide image
            ui.iconContainer.style.fontSize = '100px';
            ui.iconContainer.textContent = icon;
            ui.itemImage.style.display = 'none';
        }

        ui.description.textContent = description;
        ui.rewardAmount.textContent = reward;

        // Create sparkles
        createSparkles(ui.sparklesContainer);

        // Show with animation
        ui.container.style.display = 'flex';

        // Trigger animations
        requestAnimationFrame(() => {
            ui.backdrop.style.opacity = '1';
            ui.card.style.transform = 'scale(1) translateY(0)';
            ui.card.style.opacity = '1';
        });

        // Play sound effect (if available)
        try {
            const audio = new Audio('/treasure-sound.mp3'); // Optional: add sound file
            audio.volume = 0.3;
            audio.play().catch(() => { }); // Ignore if sound not available
        } catch (_) { }

        // Auto-hide after duration
        hideTimeout = setTimeout(() => {
            hide();
        }, duration);
    }

    /**
     * Hides whichever overlay is currently shown (reward or knowledge card).
     *
     * The DOM is removed after the exit animation so we don't leak nodes.
     */
    function hide() {
        if (!container || !isShowing) return;

        // Clear timeout if exists
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        // Handle both reward UI and knowledge card UI
        const backdrop = container.querySelector('.reward-backdrop') ||
            (currentUI && currentUI.knowledgeBackdrop);
        const card = container.querySelector('.reward-card') ||
            (currentUI && currentUI.knowledgeCard);

        if (backdrop) backdrop.style.opacity = '0';
        if (card) {
            // Different animation for knowledge card vs reward card
            if (currentUI && currentUI.knowledgeCard) {
                card.style.transform = 'scale(0.85) translateY(30px)';
            } else {
                card.style.transform = 'scale(0.8) translateY(-30px)';
            }
            card.style.opacity = '0';
        }

        setTimeout(() => {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
            container = null;
            currentUI = null;
            isShowing = false;
        }, 600);
    }

    /**
     * Convenience preset for the life-token pickup.
     */
    function showLifeToken() {
        show({
            title: '💛 Life Token',
            icon: '✨',
            description: 'Health restored!',
            reward: '+10 HP',
            duration: 2000
        });
    }

    /**
     * Convenience preset for the spell-orb pickup.
     */
    function showSpellOrb() {
        show({
            title: '💙 Spell Orb',
            icon: '🔮',
            description: 'Magical energy restored!',
            reward: '+1 Spell Energy',
            duration: 2000
        });
    }

    /**
     * Builds and appends the "knowledge card" overlay.
     *
     * The knowledge card is a larger, more detailed panel used for educational
     * treasure items; it includes:
     * - Heading/title
     * - Large image area
     * - Longer description text
     *
     * @returns {{knowledgeContainer:HTMLDivElement,knowledgeBackdrop:HTMLDivElement,knowledgeCard:HTMLDivElement,itemHeading:HTMLDivElement,itemImage:HTMLImageElement,descriptionText:HTMLDivElement}}
     */
    function createKnowledgeCardUI() {
        // Main container
        const knowledgeContainer = document.createElement('div');
        knowledgeContainer.style.position = 'fixed';
        knowledgeContainer.style.top = '0';
        knowledgeContainer.style.left = '0';
        knowledgeContainer.style.width = '100vw';
        knowledgeContainer.style.height = '100vh';
        knowledgeContainer.style.display = 'none';
        knowledgeContainer.style.justifyContent = 'center';
        knowledgeContainer.style.alignItems = 'center';
        knowledgeContainer.style.paddingLeft = '15vw';
        knowledgeContainer.style.zIndex = '10000';
        knowledgeContainer.style.pointerEvents = 'none';

        // Backdrop
        const knowledgeBackdrop = document.createElement('div');
        knowledgeBackdrop.style.position = 'absolute';
        knowledgeBackdrop.style.top = '0';
        knowledgeBackdrop.style.left = '0';
        knowledgeBackdrop.style.width = '100%';
        knowledgeBackdrop.style.height = '100%';
        knowledgeBackdrop.style.background = 'radial-gradient(circle, rgba(100,150,255,0.2) 0%, rgba(0,0,0,0.6) 100%)';
        knowledgeBackdrop.style.opacity = '0';
        knowledgeBackdrop.style.transition = 'opacity 0.5s ease-out';

        // Knowledge Card
        const knowledgeCard = document.createElement('div');
        knowledgeCard.className = 'knowledge-card';
        knowledgeCard.style.position = 'relative';
        knowledgeCard.style.background = 'linear-gradient(145deg, rgba(30,35,50,0.98) 0%, rgba(15,20,35,0.98) 100%)';
        knowledgeCard.style.borderRadius = '28px';
        knowledgeCard.style.padding = '0';
        knowledgeCard.style.boxShadow = '0 25px 80px rgba(0,0,0,0.7), 0 0 50px rgba(100,150,255,0.4), inset 0 1px 0 rgba(255,255,255,0.1)';
        knowledgeCard.style.border = '2px solid rgba(100,150,255,0.5)';
        knowledgeCard.style.backdropFilter = 'blur(15px)';
        knowledgeCard.style.transform = 'scale(0.6) translateY(80px)';
        knowledgeCard.style.opacity = '0';
        knowledgeCard.style.transition = 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        knowledgeCard.style.maxWidth = '480px';
        knowledgeCard.style.width = '90%';
        knowledgeCard.style.overflow = 'hidden';

        // Animated border glow
        const borderGlow = document.createElement('div');
        borderGlow.style.position = 'absolute';
        borderGlow.style.top = '-2px';
        borderGlow.style.left = '-2px';
        borderGlow.style.right = '-2px';
        borderGlow.style.bottom = '-2px';
        borderGlow.style.background = 'linear-gradient(45deg, rgba(100,150,255,0.8), rgba(150,200,255,0.8), rgba(100,150,255,0.8))';
        borderGlow.style.borderRadius = '28px';
        borderGlow.style.zIndex = '-1';
        borderGlow.style.animation = 'borderGlow 3s linear infinite';
        borderGlow.style.filter = 'blur(8px)';

        // Header section with gradient
        const headerSection = document.createElement('div');
        headerSection.style.background = 'linear-gradient(135deg, rgba(100,150,255,0.3) 0%, rgba(150,200,255,0.2) 100%)';
        headerSection.style.padding = '30px 35px 25px';
        headerSection.style.borderBottom = '1px solid rgba(100,150,255,0.3)';
        headerSection.style.position = 'relative';

        // Badge icon
        const badgeIcon = document.createElement('div');
        badgeIcon.style.position = 'absolute';
        badgeIcon.style.top = '20px';
        badgeIcon.style.right = '25px';
        badgeIcon.style.fontSize = '32px';
        badgeIcon.style.opacity = '0.6';
        badgeIcon.textContent = '🎓';

        // Title
        const knowledgeTitle = document.createElement('div');
        knowledgeTitle.className = 'knowledge-title';
        knowledgeTitle.style.fontSize = '14px';
        knowledgeTitle.style.fontWeight = '600';
        knowledgeTitle.style.color = 'rgba(150,200,255,0.9)';
        knowledgeTitle.style.textTransform = 'uppercase';
        knowledgeTitle.style.letterSpacing = '3px';
        knowledgeTitle.style.marginBottom = '8px';
        knowledgeTitle.textContent = 'Knowledge Unlocked';

        // Item Heading
        const itemHeading = document.createElement('div');
        itemHeading.className = 'item-heading';
        itemHeading.style.fontSize = '36px';
        itemHeading.style.fontWeight = 'bold';
        itemHeading.style.background = 'linear-gradient(135deg, #ffffff 0%, #a8d0ff 100%)';
        itemHeading.style.webkitBackgroundClip = 'text';
        itemHeading.style.backgroundClip = 'text';
        itemHeading.style.webkitTextFillColor = 'transparent';
        itemHeading.style.textShadow = '0 0 30px rgba(150,200,255,0.3)';
        itemHeading.style.lineHeight = '1.2';

        headerSection.appendChild(badgeIcon);
        headerSection.appendChild(knowledgeTitle);
        headerSection.appendChild(itemHeading);

        // Image container
        const imageContainer = document.createElement('div');
        imageContainer.className = 'knowledge-image-container';
        imageContainer.style.position = 'relative';
        imageContainer.style.padding = '35px';
        imageContainer.style.background = 'linear-gradient(180deg, rgba(20,25,40,0.5) 0%, rgba(15,20,35,0.3) 100%)';
        imageContainer.style.display = 'flex';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.alignItems = 'center';

        // Image wrapper with glow
        const imageWrapper = document.createElement('div');
        imageWrapper.style.position = 'relative';
        imageWrapper.style.display = 'flex';
        imageWrapper.style.justifyContent = 'center';
        imageWrapper.style.alignItems = 'center';

        // Item Image
        const itemImage = document.createElement('img');
        itemImage.className = 'knowledge-item-image';
        itemImage.style.maxWidth = '280px';
        itemImage.style.maxHeight = '280px';
        itemImage.style.width = 'auto';
        itemImage.style.height = 'auto';
        itemImage.style.borderRadius = '16px';
        itemImage.style.boxShadow = '0 15px 50px rgba(0,0,0,0.5), 0 0 40px rgba(100,150,255,0.4)';
        itemImage.style.border = '3px solid rgba(100,150,255,0.6)';
        itemImage.style.background = 'rgba(20,25,40,0.8)';
        itemImage.style.padding = '15px';
        itemImage.style.objectFit = 'contain';
        itemImage.style.animation = 'imageFloat 3s ease-in-out infinite';

        // Image glow effect
        const imageGlow = document.createElement('div');
        imageGlow.style.position = 'absolute';
        imageGlow.style.top = '50%';
        imageGlow.style.left = '50%';
        imageGlow.style.transform = 'translate(-50%, -50%)';
        imageGlow.style.width = '120%';
        imageGlow.style.height = '120%';
        imageGlow.style.background = 'radial-gradient(circle, rgba(100,150,255,0.3) 0%, transparent 70%)';
        imageGlow.style.borderRadius = '50%';
        imageGlow.style.filter = 'blur(25px)';
        imageGlow.style.animation = 'pulse 2.5s ease-in-out infinite';
        imageGlow.style.zIndex = '-1';

        imageWrapper.appendChild(imageGlow);
        imageWrapper.appendChild(itemImage);
        imageContainer.appendChild(imageWrapper);

        // Description section
        const descriptionSection = document.createElement('div');
        descriptionSection.className = 'knowledge-description-section';
        descriptionSection.style.padding = '30px 35px 35px';
        descriptionSection.style.background = 'rgba(15,20,35,0.5)';

        // Description text
        const descriptionText = document.createElement('div');
        descriptionText.className = 'knowledge-description';
        descriptionText.style.fontSize = '17px';
        descriptionText.style.color = 'rgba(220,230,255,0.85)';
        descriptionText.style.lineHeight = '1.7';
        descriptionText.style.textAlign = 'left';
        descriptionText.style.textShadow = '0 2px 8px rgba(0,0,0,0.4)';

        descriptionSection.appendChild(descriptionText);

        // Assemble card
        knowledgeCard.appendChild(borderGlow);
        knowledgeCard.appendChild(headerSection);
        knowledgeCard.appendChild(imageContainer);
        knowledgeCard.appendChild(descriptionSection);

        // Assemble container
        knowledgeContainer.appendChild(knowledgeBackdrop);
        knowledgeContainer.appendChild(knowledgeCard);

        // Add knowledge-specific animations
        addKnowledgeAnimationStyles();

        document.body.appendChild(knowledgeContainer);

        return { knowledgeContainer, knowledgeBackdrop, knowledgeCard, itemHeading, itemImage, descriptionText };
    }

    /**
     * Injects CSS keyframes required by the knowledge card.
     *
     * Guarded by a static `id` to avoid duplicate `<style>` tags.
     */
    function addKnowledgeAnimationStyles() {
        if (document.getElementById('knowledge-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'knowledge-ui-styles';
        style.textContent = `
            @keyframes borderGlow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            @keyframes imageFloat {
                0%, 100% { transform: translateY(0px) scale(1); }
                50% { transform: translateY(-8px) scale(1.02); }
            }
            
            @keyframes knowledgeFadeIn {
                0% { opacity: 0; transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Displays the educational knowledge card overlay.
     *
     * @param {Object} [options]
     * @param {string} [options.heading] - Item name shown prominently.
     * @param {string} [options.image] - Image path/URL for the item.
     * @param {string} [options.description] - Educational description text.
     * @param {number} [options.duration] - Auto-hide delay in ms.
     */
    function showKnowledgeCard(options = {}) {
        const {
            heading = 'LED',
            image = '/led.png',
            description = 'A Light-Emitting Diode (LED) is a semiconductor device that emits light when an electric current passes through it. LEDs are energy-efficient, long-lasting, and come in various colors.',
            duration = 5000
        } = options;

        // If already showing, clear it first
        if (isShowing && container) {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
            container = null;
            currentUI = null;
            isShowing = false;
        }

        isShowing = true;

        const ui = createKnowledgeCardUI();
        currentUI = ui;
        container = ui.knowledgeContainer;

        // Set content
        ui.itemHeading.textContent = heading;
        ui.itemImage.src = image;
        ui.descriptionText.textContent = description;

        // Show with animation
        ui.knowledgeContainer.style.display = 'flex';

        // Trigger animations
        requestAnimationFrame(() => {
            ui.knowledgeBackdrop.style.opacity = '1';
            ui.knowledgeCard.style.transform = 'scale(1) translateY(0)';
            ui.knowledgeCard.style.opacity = '1';
        });

        // Auto-hide after duration
        hideTimeout = setTimeout(() => {
            hide();
        }, duration);
    }

    /**
     * Default educational treasure: LED.
     */
    function showTreasure() {
        showKnowledgeCard({
            heading: 'LED',
            image: '/led.png',
            description: 'A Light-Emitting Diode (LED) is a semiconductor device that emits light when an electric current passes through it. LEDs are energy-efficient, long-lasting, and come in various colors. They are widely used in displays, indicators, and lighting applications.',
            duration: 5000
        });
    }

    // Add new functions for breadboard and jumper wire treasures
    /**
     * Educational treasure: Breadboard.
     */
    function showBreadboard() {
        showKnowledgeCard({
            heading: 'Breadboard',
            image: '/breadboard.png',
            description: 'A breadboard is a reusable platform for prototyping electronic circuits without soldering. It features interconnected holes that allow components to be easily inserted and connected. Breadboards enable rapid experimentation and circuit testing during development.',
            duration: 5000
        });
    }

    /**
     * Educational treasure: Jumper Wire.
     */
    function showJumperWire() {
        showKnowledgeCard({
            heading: 'Jumper Wire',
            image: '/jumperWire.png',
            description: 'Jumper wires are flexible electrical connectors used to link components on a breadboard or circuit board. They come in various lengths and colors for easy identification. These wires enable quick and temporary connections in prototyping and testing circuits.',
            duration: 5000
        });
    }

    // Add new function for switch treasure
    /**
     * Educational treasure: Switch module.
     */
    function showSwitch() {
        showKnowledgeCard({
            heading: 'Switch',
            image: '/switch.png',
            description: 'An electrical switch is a device that controls the flow of current in a circuit by opening or closing the connection. Switches can be mechanical or electronic, and they are fundamental components for controlling power, signals, and device operation in electronic systems.',
            duration: 5000
        });
    }

    // Add new function for multimeter treasure
    /**
     * Educational treasure: Multimeter.
     */
    function showMultimeter() {
        showKnowledgeCard({
            heading: 'Multimeter',
            image: '/multimeter.png',
            description: 'A multimeter is an essential electronic measuring instrument that combines multiple measurement functions in one unit. It can measure voltage (AC/DC), current (AC/DC), resistance, and continuity. Multimeters are indispensable tools for troubleshooting and testing electrical circuits.',
            duration: 5000
        });
    }

    // Add new function for resistor treasure
    /**
     * Educational treasure: Resistor.
     */
    function showResistor() {
        showKnowledgeCard({
            heading: 'Resistor',
            image: '/resistor.png',
            description: 'A resistor is a passive electrical component that limits or regulates the flow of electric current in a circuit. Resistors are characterized by their resistance value measured in ohms (Ω). They are used to control voltage levels, limit current, and divide voltages in electronic circuits.',
            duration: 5000
        });
    }

    // Add new function for power regulator treasure
    /**
     * Educational treasure: Power regulator.
     */
    function showPowerRegulator() {
        showKnowledgeCard({
            heading: 'Power Regulator',
            image: '/powerRegulator.png',
            description: 'A power regulator ensures a stable voltage supply to electronic circuits, protecting components from voltage fluctuations. It is crucial for the reliable operation of sensitive electronic devices.',
            duration: 5000
        });
    }

    // Add new function for battery and connector treasure
    /**
     * Educational treasure: Battery and connector.
     */
    function showBatteryAndConnector() {
        showKnowledgeCard({
            heading: 'Battery & Connector',
            image: '/batteryAndConnector.png',
            description: 'Batteries provide the electrical energy source for portable circuits, while connectors allow for secure and reliable electrical connections between different components and power sources.',
            duration: 5000
        });
    }

    return {
        show,
        showLifeToken,
        showSpellOrb,
        showTreasure,
        showBreadboard,  // Add new function to the return object
        showJumperWire,  // Add new function to the return object
        showSwitch,      // Add new function to the return object
        showMultimeter,  // Add new function to the return object
        showResistor,    // Add new function to the return object
        showPowerRegulator, // Add new function to the return object
        showBatteryAndConnector, // Add new function to the return object
        hide
    };
}
