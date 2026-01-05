
import { togglePlayerControls, setMovementEnabled, stopCurrentAnimation, stopPlayerSounds } from "../playerController.js";

let inventoryContainer = null;
let inventoryButton = null;
let currentSelectedSlot = null;
let playerRef = null; // Reference to the player controller

let inventoryData = {
  items: [],
  capacity: { max: 250 },
  health: 3 // 3 hearts
}

// Function to create innovative circuit-board inspired slot with SVG
function createCircuitSlot(item, index) {
  const slot = document.createElement('div');
  slot.className = 'inventory-slot';
  slot.dataset.index = index;
  slot.addEventListener('click', (e) => selectSlot(e, slot));

  // SVG for circuit board style slot - Defs moved to shared container
  const svg = document.createElement('div');
  svg.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="57" height="57" rx="10" ry="10"
        fill="url(#slotGrad)" stroke="rgba(0,255,255,0.25)" stroke-width="1.2" filter="url(#slotGlow)" />
      <rect x="5" y="5" width="50" height="50" rx="8" ry="8" fill="rgba(0,0,0,0.25)" />
      <foreignObject x="8" y="8" width="44" height="44">
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
          <img src="/${item.icon}" style="width:80%;height:80%;object-fit:contain;filter:drop-shadow(0 0 4px rgba(0,255,255,0.5));" alt="" />
        </div>
      </foreignObject>
      <path d="M5 30 L55 30" stroke="rgba(0,255,255,0.1)" stroke-width="0.6"/>
      <circle cx="10" cy="10" r="1.8" fill="rgba(0,255,255,0.4)"/>
      <circle cx="50" cy="50" r="1.8" fill="rgba(0,255,128,0.4)"/>
    </svg>
`;

  slot.appendChild(svg.firstElementChild);

  const count = document.createElement('div');
  count.className = 'item-count';
  count.textContent = `x${item.count}`;
  slot.appendChild(count);

  return slot;
}

// Function to create the inventory button
export function createInventoryButton(player) {
  // Store player reference for pointer lock management
  if (player) {
    playerRef = player;
  }
  if (inventoryButton) return;

  inventoryButton = document.createElement('div');
  inventoryButton.style.position = 'fixed';
  inventoryButton.style.top = '20px';
  inventoryButton.style.right = '20px';
  inventoryButton.style.width = '60px';
  inventoryButton.style.height = '60px';
  inventoryButton.style.background = 'rgba(0, 255, 65, 0.06)';
  inventoryButton.style.backdropFilter = 'blur(30px)';
  inventoryButton.style.border = '1px solid rgba(0, 255, 65, 0.2)';
  inventoryButton.style.borderRadius = '50%';
  inventoryButton.style.display = 'flex';
  inventoryButton.style.alignItems = 'center';
  inventoryButton.style.justifyContent = 'center';
  inventoryButton.style.fontSize = '24px';
  inventoryButton.style.cursor = 'pointer';
  inventoryButton.style.zIndex = '1000';
  inventoryButton.style.boxShadow = '0 0 30px rgba(0, 255, 65, 0.1)';
  inventoryButton.title = 'Inventory';
  inventoryButton.addEventListener('click', () => {
    showInventory();
  });

  // Add backpack emoji
  inventoryButton.innerHTML = '🎒';

  // Add item counter badge
  const countBadge = document.createElement('div');
  countBadge.className = 'inventory-count-badge';
  countBadge.textContent = '0';
  countBadge.style.position = 'absolute';
  countBadge.style.top = '-8px';
  countBadge.style.right = '-8px';
  countBadge.style.width = '26px';
  countBadge.style.height = '26px';
  countBadge.style.background = 'linear-gradient(135deg, rgba(255, 0, 200, 0.9), rgba(255, 0, 100, 0.8))';
  countBadge.style.border = '2px solid rgba(255, 255, 255, 0.4)';
  countBadge.style.borderRadius = '50%';
  countBadge.style.display = 'flex';
  countBadge.style.alignItems = 'center';
  countBadge.style.justifyContent = 'center';
  countBadge.style.fontSize = '13px';
  countBadge.style.fontWeight = 'bold';
  countBadge.style.color = '#fff';
  countBadge.style.boxShadow = '0 0 15px rgba(255, 0, 200, 0.6)';
  countBadge.style.pointerEvents = 'none';
  inventoryButton.appendChild(countBadge);

  document.body.appendChild(inventoryButton);
}

// Function to create the inventory UI
function createInventoryUI() {
  if (inventoryContainer) return;

  // Innovative sci-fi glassmorphism CSS with modern high-end feel
  const styleTag = document.createElement('style');
  styleTag.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800&display=swap');
  #inventory-container {
    font-family: 'Orbitron', sans-serif;
    transition: opacity 0.3s ease;
  }

.inventory-main {
  /* Keep your existing layout properties */
  position: relative;
  display: grid;
  grid-template-columns: 140px 1fr 320px;
  grid-template-rows: 60px auto 50px;
  gap: 12px;
  padding: 20px 25px;
  box-sizing: border-box;
  width: 1000px;
  height: 650px;
  margin: 0 auto;

 
  background: url("data:image/svg+xml,%3Csvg width='1000' height='650' viewBox='0 0 1000 650' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CradialGradient id='paint0_radial_3159_6' cx='0' cy='0' r='1' gradientUnits='userSpaceOnUse' gradientTransform='translate(300 30) scale(800 520)'%3E%3Cstop stop-color='%2300FFFF' stop-opacity='0.1'/%3E%3Cstop offset='1' stop-color='%23000A14' stop-opacity='0.95'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpath d='M20 0.5H980C990.77 0.5 999.5 9.23045 999.5 20V223.146C999.5 229.747 996.161 235.899 990.627 239.496L968.828 253.666C963.01 257.448 959.5 263.915 959.5 270.854V329.567C959.5 335.094 961.731 340.387 965.688 344.245L993.613 371.471C997.377 375.141 999.5 380.175 999.5 385.433V552C999.5 562.77 990.77 571.5 980 571.5H806.371C802.123 571.5 797.979 572.82 794.514 575.277L694.908 645.907C691.612 648.245 687.67 649.5 683.629 649.5H20C9.23045 649.5 0.5 640.77 0.5 630V399.52L0.507812 398.97C0.667371 393.302 3.28823 387.972 7.70312 384.385L32.9268 363.891C37.7178 359.998 40.5 354.154 40.5 347.98V281.433C40.4999 275.906 38.2686 270.613 34.3115 266.755L6.38672 239.529C2.62259 235.859 0.500091 230.825 0.5 225.567V20C0.5 9.23045 9.23045 0.5 20 0.5Z' fill='url(%23paint0_radial_3159_6)' stroke='%234ECDC4' stroke-width='1.5'/%3E%3C/svg%3E");
  background-size: 100% 100%;
}

  .inventory-main.show {
    transform: scale(1) rotate(0);
    opacity: 1;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .inventory-main.hide {
    transform: scale(0.95) rotate(-2deg);
    opacity: 0;
    transition: all 0.25s cubic-bezier(0.6, -0.28, 0.735, 0.045);
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 14px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid rgba(255,0,80,0.25);
    background: radial-gradient(circle, rgba(255,0,80,0.1), rgba(0,0,0,0.5));
    color: #ff3366;
    font-size: 22px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 0 15px rgba(255,0,80,0.2);
  }

  .close-btn:hover {
    background: rgba(255,0,80,0.2);
    box-shadow: 0 0 30px rgba(255,0,80,0.3);
    transform: scale(1.1) rotate(90deg);
  }

  .grid-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    padding: 26px;
  }

  .inventory-slot {
    position: relative;
    aspect-ratio: 0.75;
    border-radius: 8px 8px 4px 4px;
    border: 1px solid rgba(0,255,255,0.1);
    background: linear-gradient(135deg, rgba(0,255,255,0.04), rgba(0,255,128,0.02));
    box-shadow: inset 0 0 15px rgba(0,255,255,0.05);
    overflow: hidden;
   
    transition: all 0.25s ease;
  }

  .inventory-slot:hover {
    border-color: rgba(0,255,255,0.4);
    box-shadow: 0 0 18px rgba(0,255,255,0.25);
    transform: translateY(-3px);
  }

  .inventory-slot.selected {
    border-color: rgba(0,255,180,0.7);
    box-shadow: 0 0 25px rgba(0,255,180,0.4);
    background: linear-gradient(135deg, rgba(0,255,180,0.08), rgba(0,255,255,0.05));
  }

  .item-count {
    position: absolute;
    bottom: 6px;
    right: 6px;
    font-size: 12px;
    color: #00ffff;
    background: rgba(0, 10, 10, 0.7);
    border: 1px solid rgba(0,255,255,0.3);
    border-radius: 4px;
    padding: 2px 5px;
  }

  .item-large {
    border-radius: 12px;
    border: 1px solid rgba(0,255,255,0.15);
    background: radial-gradient(circle at 30% 30%, rgba(0,255,255,0.1), rgba(0,0,0,0.3));
    box-shadow: inset 0 0 25px rgba(0,255,255,0.08);
  }

  .neon-sign {
    font-size: 18px;
    font-weight: 800;
    color: #ff00cc;
    text-align: center;
    letter-spacing: 2px;
    text-shadow:
      0 0 10px rgba(255,0,200,0.7),
      0 0 30px rgba(255,0,200,0.4);
    padding: 10px;
  }
    .item-title {
  font-size: 20px;
  color: #00ffff;
  text-align: center;
  margin-top: 15px;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(0,255,255,0.6);
}

.item-desc {
  font-size: 14px;
  color: rgba(200,255,255,0.9);
  padding: 10px;
  text-align: center;
  line-height: 1.4;
}

.stats-bar {
  position: relative;
  width: 90%;
  height: 10px;
  margin: 12px auto;
  background: rgba(0,255,255,0.1);
  border: 1px solid rgba(0,255,255,0.2);
  border-radius: 5px;
  overflow: hidden;
}
.stats-fill {
  height: 100%;
  width: 50%;
  background: linear-gradient(90deg, #00ffff, #00ff9d);
  box-shadow: 0 0 10px #00ffff;
  transition: width 0.3s ease;
}
.stats-text {
  text-align: center;
  font-size: 13px;
  color: #00ffff;
  margin-top: 4px;
}

.bottom-buttons {
  display: flex;
  justify-content: space-around;
  align-items: center;
  margin-top: 25px;
}

.cyber-btn {
  padding: 5px 10px;
  border: 1px solid rgba(0,255,255,0.4);
  color: #00ffff;
  background: rgba(0,255,255,0.08);
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Orbitron', sans-serif;
  text-transform: uppercase;
  transition: all 0.25s ease;
  box-shadow: 0 0 15px rgba(0,255,255,0.2);
}
.cyber-btn:hover {
  background: rgba(0,255,255,0.2);
  box-shadow: 0 0 25px rgba(0,255,255,0.4);
}

.cancel-btn {
  border-color: rgba(255,0,80,0.5);
  color: #ff3366;
}
.cancel-btn:hover {
  background: rgba(255,0,80,0.15);
  box-shadow: 0 0 25px rgba(255,0,80,0.5);
}
  .sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 10px;
}

.category-btn {
  width: 60px;
  height: 60px;
  border: 1px solid rgba(0,255,255,0.25);
  border-radius: 10px;
  background: rgba(0,255,255,0.05);
  color: #00ffff;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
}
.category-btn:hover {
  background: rgba(0,255,255,0.2);
  box-shadow: 0 0 15px rgba(0,255,255,0.3);
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  align-content: start;
  overflow-y: auto;
  padding: 10px;
  height: 100%;
  box-sizing: border-box;
}
.right-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 10px;
  box-sizing: border-box;
  overflow: hidden;
}

.item-large {
  width: 200px;
  height: 200px;
  margin: 10px auto;
  border-radius: 12px;
  border: 1px solid rgba(0,255,255,0.25);
  background: radial-gradient(circle at 50% 50%, rgba(0,255,255,0.08), rgba(0,0,0,0.3));
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-large img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 15px rgba(0,255,255,0.5));
}
@media (max-width: 1200px) {
  .inventory-main {
    transform: scale(0.85);
    transform-origin: center;
  }
}

@media (max-width: 900px) {
  .inventory-main {
    transform: scale(0.75);
  }
}
.top-bar {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: rgba(0,255,255,0.05);
  border-bottom: 1px solid rgba(0,255,255,0.15);
  color: #00ffff;
  font-size: 14px;
}

.bottom-bar {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: rgba(0,20,10,0.15);
  border-top: 1px solid rgba(0,255,65,0.1);
  color: #00ff9d;
  font-weight: 600;
  font-size: 16px;
}
.tabs {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
}

.tab-btn {
  padding: 8px 18px;
  border: 1px solid rgba(0, 255, 255, 0.25);
  background: rgba(0, 255, 255, 0.05);
  color: #00ffff;
  font-size: 14px;
  font-family: 'Orbitron', sans-serif;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 0 10px rgba(0, 255, 255, 0.1);
}

.tab-btn:hover {
  background: rgba(0, 255, 255, 0.15);
  border-color: rgba(0, 255, 255, 0.4);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
}

.tab-btn.active {
  background: linear-gradient(135deg, rgba(0,255,180,0.25), rgba(0,255,255,0.15));
  border-color: rgba(0,255,180,0.6);
  color: #00ffcc;
  box-shadow: 0 0 25px rgba(0,255,180,0.4);
}


`;


  document.head.appendChild(styleTag);

  inventoryContainer = document.createElement('div');
  inventoryContainer.id = 'inventory-container';
  inventoryContainer.style.position = 'fixed';
  inventoryContainer.style.top = '0';
  inventoryContainer.style.left = '0';
  inventoryContainer.style.width = '100%';
  inventoryContainer.style.height = '100%';
  inventoryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  inventoryContainer.style.display = 'none';
  inventoryContainer.style.zIndex = '1500';
  inventoryContainer.style.backdropFilter = 'blur(6px)';
  inventoryContainer.style.transition = 'opacity 0.3s ease';

  // Add shared SVG defs for slots to avoid duplicate IDs
  const sharedDefs = document.createElement('div');
  sharedDefs.innerHTML = `
    <svg width="0" height="0" style="position:absolute; visibility:hidden;">
      <defs>
        <linearGradient id="slotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00fff6" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#00ff9d" stop-opacity="0.1"/>
        </linearGradient>
        <filter id="slotGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#00fff6" flood-opacity="0.5"/>
        </filter>
      </defs>
    </svg>
  `;
  inventoryContainer.appendChild(sharedDefs);

  // Main panel
  const mainPanel = document.createElement('div');
  mainPanel.className = 'inventory-main';
  mainPanel.style.position = 'absolute';
  mainPanel.style.top = '50%';
  mainPanel.style.left = '50%';
  mainPanel.style.transform = 'translate(-50%, -50%)';
  mainPanel.style.width = '1000px';
  mainPanel.style.height = '650px';
  mainPanel.style.display = 'grid';
  mainPanel.style.gridTemplateColumns = '120px 1fr 280px';
  mainPanel.style.gridTemplateRows = '50px auto 30px 50px';
  mainPanel.style.gap = '0';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hideInventory);
  mainPanel.appendChild(closeBtn);

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'top-bar';
  topBar.style.gridColumn = '1 / -1';
  topBar.innerHTML = '<span>L1</span>';

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const mapTab = document.createElement('button');
  mapTab.className = 'tab-btn';
  mapTab.textContent = 'Map';
  const invTab = document.createElement('button');
  invTab.className = 'tab-btn active';
  invTab.textContent = 'Inventory';
  const dbTab = document.createElement('button');
  dbTab.className = 'tab-btn';
  dbTab.textContent = 'Database';
  tabs.appendChild(mapTab);
  tabs.appendChild(invTab);
  tabs.appendChild(dbTab);
  topBar.appendChild(tabs);

  const capacitySpan = document.createElement('span');
  capacitySpan.className = 'capacity-display';
  capacitySpan.textContent = `Capacity ${inventoryData.items.length}/${inventoryData.capacity.max}`;
  topBar.appendChild(capacitySpan);

  topBar.innerHTML += '<span>R1</span>';
  mainPanel.appendChild(topBar);

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  sidebar.style.gridRow = '2';
  sidebar.style.gridColumn = '1';

  const categories = [
    { icon: '🔫' },
    { icon: '📦' },
    { icon: '💊' },
    { icon: '💣' },
    { icon: '🔪' },
    { icon: '🔑' }
  ];

  categories.forEach(cat => {
    const catBtn = document.createElement('button');
    catBtn.className = 'category-btn';
    catBtn.innerHTML = cat.icon;
    catBtn.addEventListener('click', () => {
      // Filter logic
    });
    sidebar.appendChild(catBtn);
  });

  mainPanel.appendChild(sidebar);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'grid-container';
  grid.style.gridRow = '2';
  grid.style.gridColumn = '2';

  inventoryData.items.slice(0, 12).forEach((item, index) => {
    const slot = createCircuitSlot(item, index);
    grid.appendChild(slot);
  });

  mainPanel.appendChild(grid);

  // Neon sign
  const neonSign = document.createElement('div');
  neonSign.className = 'neon-sign';
  neonSign.style.gridColumn = '1 / -1';
  neonSign.style.gridRow = '3';
  neonSign.textContent = 'Legendium';
  mainPanel.appendChild(neonSign);

  // Right panel
  const rightPanel = document.createElement('div');
  rightPanel.className = 'right-panel';
  rightPanel.style.gridRow = '2 / 4';
  rightPanel.style.gridColumn = '3';

  const itemLarge = document.createElement('div');
  itemLarge.className = 'item-large';
  const largeImg = document.createElement('img');
  largeImg.alt = 'Item Preview';
  itemLarge.appendChild(largeImg);

  // Initially hide the image box content but maintain space
  if (inventoryData.items.length === 0) {
    itemLarge.style.visibility = 'hidden';
    itemLarge.style.opacity = '0';
  }

  rightPanel.appendChild(itemLarge);

  const itemTitle = document.createElement('div');
  itemTitle.className = 'item-title';
  rightPanel.appendChild(itemTitle);

  const itemDesc = document.createElement('div');
  itemDesc.className = 'item-desc';
  rightPanel.appendChild(itemDesc);

  const statsBar = document.createElement('div');
  statsBar.className = 'stats-bar';
  const statsFill = document.createElement('div');
  statsFill.className = 'stats-fill';
  const statsText = document.createElement('div');
  statsText.className = 'stats-text';
  statsText.textContent = '70/140 BR';
  statsBar.appendChild(statsFill);
  statsBar.appendChild(statsText);
  rightPanel.appendChild(statsBar);

  const bottomButtons = document.createElement('div');
  bottomButtons.className = 'bottom-buttons';
  const selectBtn = document.createElement('button');
  selectBtn.className = 'cyber-btn';
  selectBtn.textContent = 'Select';
  selectBtn.addEventListener('click', () => useItem(currentSelectedSlot));
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'cyber-btn cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => dropItem(currentSelectedSlot));
  const closeBtn2 = document.createElement('button');
  closeBtn2.className = 'cyber-btn cancel-btn';
  closeBtn2.textContent = 'Close';
  closeBtn2.addEventListener('click', hideInventory);
  bottomButtons.appendChild(selectBtn);
  bottomButtons.appendChild(cancelBtn);
  bottomButtons.appendChild(closeBtn2);
  rightPanel.appendChild(bottomButtons);

  mainPanel.appendChild(rightPanel);

  // Bottom bar
  const bottomBar = document.createElement('div');
  bottomBar.style.gridColumn = '1 / -1';
  bottomBar.style.gridRow = '4';
  bottomBar.style.display = 'flex';
  bottomBar.style.alignItems = 'center';
  bottomBar.style.padding = '12px 24px';
  bottomBar.style.background = 'rgba(0, 20, 10, 0.15)';
  bottomBar.style.borderTop = '1px solid rgba(0, 255, 65, 0.1)';

  const healthBar = document.createElement('div');
  healthBar.className = 'health-bar';
  const healthFill = document.createElement('div');
  healthFill.className = 'health-fill';
  healthBar.appendChild(healthFill);
  bottomBar.appendChild(healthBar);





  inventoryContainer.appendChild(mainPanel);
  document.body.appendChild(inventoryContainer);

  // Default select first item only if there are items
  setTimeout(() => {
    if (inventoryData.items.length > 0) {
      const firstSlot = document.querySelector('.inventory-slot[data-index="0"]');
      if (firstSlot) selectSlot({}, firstSlot);
    } else {
      // Hide only the image box content but maintain space, keep text elements in position
      const itemLarge = document.querySelector('.item-large');
      if (itemLarge) {
        // Hide the content but maintain the space
        itemLarge.style.visibility = 'hidden';
        itemLarge.style.opacity = '0';
      }

      // Keep text elements but make them faded
      const itemTitle = document.querySelector('.item-title');
      const itemDesc = document.querySelector('.item-desc');

      if (itemTitle) {
        itemTitle.textContent = 'No Items';
        itemTitle.style.opacity = '0.5';
      }
      if (itemDesc) {
        itemDesc.textContent = 'Your inventory is empty. Collect items to see them here.';
        itemDesc.style.opacity = '0.5';
      }

      // Clear stats
      const statsText = document.querySelector('.stats-text');
      if (statsText) statsText.textContent = '';
    }
  }, 50);
}

// Function to select slot
function selectSlot(event, slot) {
  document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('selected'));
  slot.classList.add('selected');
  currentSelectedSlot = slot;
  const index = parseInt(slot.dataset.index);
  const item = inventoryData.items[index];
  if (item) {
    document.querySelector('.item-large img').src = `/${item.icon}`;
    document.querySelector('.item-title').textContent = item.name;
    document.querySelector('.item-desc').textContent = item.description;
    document.querySelector('.stats-text').textContent = item.stats;
    const fill = document.querySelector('.stats-fill');
    fill.style.width = '50%';

    // Ensure the image box content is visible
    const itemLarge = document.querySelector('.item-large');
    if (itemLarge) {
      itemLarge.style.visibility = 'visible';
      itemLarge.style.opacity = '1';
    }

    // Make text elements fully visible
    const itemTitle = document.querySelector('.item-title');
    const itemDesc = document.querySelector('.item-desc');

    if (itemTitle) {
      itemTitle.style.opacity = '1';
    }
    if (itemDesc) {
      itemDesc.style.opacity = '1';
    }
  }
}

// Other functions
function useItem(slot) {
  if (!slot) return;
  const index = parseInt(slot.dataset.index);
  const item = inventoryData.items[index];
  if (item) console.log('Use item:', item.name);
  hideInventory();
}

function dropItem(slot) {
  if (!slot) return;
  const index = parseInt(slot.dataset.index);
  const item = inventoryData.items[index];
  if (item) console.log('Drop item:', item.name);
  hideInventory();
}


// In inventory.js

export function showInventory() {
  // Release pointer lock to show mouse cursor when inventory opens
  if (playerRef && typeof playerRef.isPlayerCameraActive === 'function' && playerRef.isPlayerCameraActive()) {
    if (typeof playerRef.disablePlayerCamera === 'function') {
      playerRef.disablePlayerCamera();
    }
  }

  // Disable player controls (movement and spell cast)
  togglePlayerControls(false);
  setMovementEnabled(false);
  
  // Stop current animation and switch to idle
  stopCurrentAnimation();
  
  // Stop player sounds
  stopPlayerSounds();

  if (!inventoryContainer) createInventoryUI();
  inventoryContainer.style.display = 'block';
  inventoryContainer.style.opacity = '0';

  // Trigger reflow
  void inventoryContainer.offsetWidth;

  inventoryContainer.style.opacity = '1';


  const panel = document.querySelector('.inventory-main');
  if (panel) {
    panel.classList.remove('hide');
    panel.classList.add('show');
  }

  // Only disable clicks on the canvas
  const canvas = document.querySelector('canvas');
  if (canvas) canvas.style.pointerEvents = 'none';
}

export function hideInventory() {
  // Restore pointer lock when inventory closes
  if (playerRef && typeof playerRef.enablePlayerCamera === 'function') {
    playerRef.enablePlayerCamera();
    // Also directly request pointer lock for immediate restoration
    // Use a small delay to ensure UI changes are processed first
    setTimeout(() => {
      if (typeof playerRef.requestPointerLock === 'function') {
        playerRef.requestPointerLock();
      }
    }, 50);
  }

  // Re-enable player controls (movement and spell cast) ONLY if not defeated
  if (playerRef && typeof playerRef.isDefeated === 'function' && playerRef.isDefeated()) {
    // Player is defeated, do NOT re-enable controls
    console.log('Player is defeated, keeping controls disabled after closing inventory');
  } else {
    togglePlayerControls(true);
    setMovementEnabled(true);
  }

  const panel = document.querySelector('.inventory-main');
  if (panel) {
    panel.classList.remove('show');
    panel.classList.add('hide');
  }

  // Start fade out
  if (inventoryContainer) {
    inventoryContainer.style.opacity = '0';
  }

  setTimeout(() => {
    if (inventoryContainer) inventoryContainer.style.display = 'none';
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.pointerEvents = 'auto';
  }, 300);
}

export function addItem(item) {
  // Check if item already exists in inventory
  const existingItemIndex = inventoryData.items.findIndex(i => i.name === item.name);

  if (existingItemIndex !== -1) {
    // Item exists, increment count
    inventoryData.items[existingItemIndex].count += item.count;
  } else {
    // New item, add to inventory
    inventoryData.items.push(item);
  }

  const grid = document.querySelector('.grid-container');
  if (grid) {
    grid.innerHTML = '';
    inventoryData.items.slice(0, 12).forEach((itm, idx) => {
      const newSlot = createCircuitSlot(itm, idx);
      grid.appendChild(newSlot);
    });

    // If this is the first item added, select it and show the image box content
    if (inventoryData.items.length === 1) {
      setTimeout(() => {
        const firstSlot = document.querySelector('.inventory-slot[data-index="0"]');
        if (firstSlot) {
          selectSlot({}, firstSlot);

          // Show the image box content
          const itemLarge = document.querySelector('.item-large');
          if (itemLarge) {
            itemLarge.style.visibility = 'visible';
            itemLarge.style.opacity = '1';
          }

          // Make text elements fully visible
          const itemTitle = document.querySelector('.item-title');
          const itemDesc = document.querySelector('.item-desc');

          if (itemTitle) {
            itemTitle.style.opacity = '1';
          }
          if (itemDesc) {
            itemDesc.style.opacity = '1';
          }
        }
      }, 10);
    }
  }
  updateCapacityDisplay();
  updateInventoryBadge();
}

function updateInventoryBadge() {
  const badge = document.querySelector('.inventory-count-badge');
  if (badge) {
    badge.textContent = inventoryData.items.length;
  }
}

function updateCapacityDisplay() {
  const cap = document.querySelector('.capacity-display');
  if (cap) cap.textContent = `Capacity ${inventoryData.items.length}/${inventoryData.capacity.max}`;
}

export function isInventoryVisible() {
  return inventoryContainer && inventoryContainer.style.display === 'block';
}

export function setPlayerReference(player) {
  if (player) {
    playerRef = player;
  }
}

export function cleanupInventory() {
  if (inventoryButton && inventoryButton.parentNode) {
    inventoryButton.parentNode.removeChild(inventoryButton);
  }
  if (inventoryContainer && inventoryContainer.parentNode) {
    inventoryContainer.parentNode.removeChild(inventoryContainer);
  }
  currentSelectedSlot = null;
  const style = document.querySelector('style');
  if (style && style.textContent.includes('#inventory-container')) {
    style.parentNode.removeChild(style);
  }
}