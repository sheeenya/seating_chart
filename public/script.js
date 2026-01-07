const API_LAYOUT_URL = '/api/layout';
const API_OCCUPANCY_URL = '/api/occupancy';
const API_OCCUPANCY_LEAVE_URL = '/api/occupancy/leave';
const API_OCCUPANCY_CLEAR_ALL_URL = '/api/occupancy/clear-all';

const POLL_INTERVAL = 3000; // 3 seconds

// DOM Elements
const seatGrid = document.getElementById('seat-grid');
const mapWrapper = document.getElementById('map-wrapper');
const layoutContainer = document.getElementById('layout-container');
const modalOverlay = document.getElementById('modal-overlay');
const closeModalBtn = document.getElementById('close-modal');
const userNameInput = document.getElementById('user-name-input');
const confirmSeatBtn = document.getElementById('confirm-seat-btn');
const leaveSeatBtn = document.getElementById('leave-seat-btn');
const selectedSeatIdInput = document.getElementById('selected-seat-id');
const modalTitle = document.getElementById('modal-title');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const resetZoomBtn = document.getElementById('reset-zoom');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

const toggleEditModeBtn = document.getElementById('toggle-edit-mode');
const saveLayoutBtn = document.getElementById('save-layout-btn');
const editControls = document.getElementById('edit-controls');
const rotateSeatBtn = document.getElementById('rotate-seat-btn');
const deleteSeatBtn = document.getElementById('delete-seat-btn');
const seatPrefixInput = document.getElementById('seat-prefix-input');
const seatNumberInput = document.getElementById('seat-number-input');
const resetSeatsBtn = document.getElementById('reset-seats-btn');

// Admin password modal elements
const adminPasswordOverlay = document.getElementById('admin-password-overlay');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminPasswordError = document.getElementById('admin-password-error');
const closeAdminModalBtn = document.getElementById('close-admin-modal');
const cancelAdminBtn = document.getElementById('cancel-admin-btn');
const confirmAdminBtn = document.getElementById('confirm-admin-btn');

// Tool buttons will be created dynamically or use existing elements

// State
let layoutData = { seats: [] };
let occupancyData = {}; // { seatId: { name, timestamp } }
let scale = 1.0;
let pannedX = 0;
let pannedY = 0;
let isDraggingMap = false;
let mapStartX = 0;
let mapStartY = 0;

// Edit Mode State
let isEditMode = false;
let editTool = 'select'; // 'select' | 'create'
let isDraggingSeat = false;
let draggedSeatIds = [];
let selectedSeatIds = new Set(); // Multi-select support
let dragOffset = { x: 0, y: 0, initialPositions: {} };

// Selection Box State
let isSelecting = false;
let selectionStart = { x: 0, y: 0 };
let selectionBoxEl = null;
let isDragOperation = false; // To distinguish click from drag

// Continuous Creation State
let lastCreatedSeat = null;

// Pan with middle mouse button or wheel drag
let isPanningWithWheel = false;
let panStartX = 0;
let panStartY = 0;

// View rotation state
let viewRotation = 0; // 0, 90, 180, 270 degrees

// Seat moving state (for normal mode)
let isMovingSeat = false;
let movingFromSeatId = null;
let movingPersonName = null;

// Copy/Paste State
let copiedSeats = [];
let pasteOffset = { x: 20, y: 20 }; // Offset for pasted seats

// Normal mode seat moving
let isDraggingOccupiedSeat = false;
let draggedOccupantInfo = null;
let dragStartSeatId = null;

// Initialize
function init() {
    initTheme();
    loadAllData();
    setInterval(() => {
        if (!isEditMode) fetchOccupancy();
    }, POLL_INTERVAL);

    setupZoomPan();
    setupEditMode();
    setupAdminMode();
    setupThemeToggle();
    // setupDebugControls(); // Disabled for production

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    confirmSeatBtn.addEventListener('click', handleSeatSubmit);
    leaveSeatBtn.addEventListener('click', handleLeaveSeat);

    userNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSeatSubmit();
    });
    
    // Wait for background image to load, then fit to view
    const layoutImage = document.getElementById('layout-image');
    if (layoutImage) {
        if (layoutImage.complete) {
            // Image already loaded
            setTimeout(() => fitToView(), 100);
        } else {
            // Wait for image to load
            layoutImage.addEventListener('load', () => {
                setTimeout(() => fitToView(), 100);
            });
            layoutImage.addEventListener('error', () => {
                // Image failed to load, fit to seats or default
                setTimeout(() => fitToView(), 100);
            });
        }
    } else {
        // No image element, fit to seats or default
        setTimeout(() => fitToView(), 100);
    }
}

function setupDebugControls() {
    // Debug controls disabled for production
    return;
    
    // Add debug panel
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 9999;
        display: none;
    `;
    
    debugPanel.innerHTML = `
        <div>Debug Controls</div>
        <div>Scale: <span id="debug-scale">${scale.toFixed(2)}</span></div>
        <div>Pan X: <span id="debug-pan-x">${pannedX.toFixed(1)}</span></div>
        <div>Pan Y: <span id="debug-pan-y">${pannedY.toFixed(1)}</span></div>
        <div>
            <button onclick="adjustPan(-10, 0)">←</button>
            <button onclick="adjustPan(10, 0)">→</button>
            <button onclick="adjustPan(0, -10)">↑</button>
            <button onclick="adjustPan(0, 10)">↓</button>
        </div>
        <div>
            <button onclick="adjustScale(0.1)">Zoom+</button>
            <button onclick="adjustScale(-0.1)">Zoom-</button>
        </div>
        <div>
            <button onclick="logCurrentTransform()">Log Transform</button>
        </div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Toggle debug panel with 'D' key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            if (e.target.tagName !== 'INPUT') {
                debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
            }
        }
    });
}

// Global functions for debug controls
window.adjustPan = function(deltaX, deltaY) {
    pannedX += deltaX;
    pannedY += deltaY;
    updateTransform();
    updateDebugDisplay();
};

window.adjustScale = function(delta) {
    scale = Math.max(0.1, Math.min(5, scale + delta));
    updateTransform();
    updateDebugDisplay();
};

window.logCurrentTransform = function() {
    console.log(`Current transform: scale=${scale.toFixed(2)}, pan=(${pannedX.toFixed(1)}, ${pannedY.toFixed(1)})`);
    console.log(`Transform string: translate(-50%, -50%) translate(${pannedX}px, ${pannedY}px) scale(${scale})`);
};

function updateDebugDisplay() {
    const scaleEl = document.getElementById('debug-scale');
    const panXEl = document.getElementById('debug-pan-x');
    const panYEl = document.getElementById('debug-pan-y');
    
    if (scaleEl) scaleEl.textContent = scale.toFixed(2);
    if (panXEl) panXEl.textContent = pannedX.toFixed(1);
    if (panYEl) panYEl.textContent = pannedY.toFixed(1);
}

async function loadAllData() {
    await Promise.all([fetchLayout(), fetchOccupancy()]);
}

// ---------------------------------------------------------
// Admin Mode (Hidden Edit Button)
// ---------------------------------------------------------
let adminModeEnabled = false;
const ADMIN_PASSWORD = '6901';

function setupAdminMode() {
    // Ctrl+Shift+E でパスワード入力モーダルを表示
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            if (adminModeEnabled) {
                // 既に有効な場合は無効化
                disableAdminMode();
            } else {
                // パスワード入力モーダルを表示
                openAdminPasswordModal();
            }
        }
    });

    // パスワード入力モーダルのイベント
    closeAdminModalBtn.addEventListener('click', closeAdminPasswordModal);
    cancelAdminBtn.addEventListener('click', closeAdminPasswordModal);
    adminPasswordOverlay.addEventListener('click', (e) => {
        if (e.target === adminPasswordOverlay) closeAdminPasswordModal();
    });

    confirmAdminBtn.addEventListener('click', checkAdminPassword);
    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAdminPassword();
    });
}

function openAdminPasswordModal() {
    adminPasswordInput.value = '';
    adminPasswordError.style.display = 'none';
    adminPasswordOverlay.classList.remove('hidden');
    adminPasswordInput.focus();
}

function closeAdminPasswordModal() {
    adminPasswordOverlay.classList.add('hidden');
    adminPasswordInput.value = '';
    adminPasswordError.style.display = 'none';
}

function checkAdminPassword() {
    const password = adminPasswordInput.value.trim();
    
    if (password === ADMIN_PASSWORD) {
        adminModeEnabled = true;
        toggleEditModeBtn.style.display = 'inline-block';
        updateToolbarVisibility();
        closeAdminPasswordModal();
    } else {
        adminPasswordError.style.display = 'block';
        adminPasswordInput.value = '';
        adminPasswordInput.focus();
    }
}

function updateToolbarVisibility() {
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        // 編集ボタンが表示されている時（管理者モード）または編集モードの時だけツールバーを表示
        const editBtnVisible = toggleEditModeBtn.style.display !== 'none';
        if (isEditMode || editBtnVisible) {
            toolbar.style.display = 'flex';
        } else {
            toolbar.style.display = 'none';
        }
    }
}

function disableAdminMode() {
    adminModeEnabled = false;
    toggleEditModeBtn.style.display = 'none';
    updateToolbarVisibility();
    
    // 編集モードが有効な場合は終了
    if (isEditMode) {
        isEditMode = false;
        document.body.classList.remove('edit-mode');
        toggleEditModeBtn.textContent = 'レイアウト編集';
        toggleEditModeBtn.classList.remove('active');
        saveLayoutBtn.classList.add('hidden');
        editControls.classList.add('hidden');
        deselectAllSeats();
    }
}

// ---------------------------------------------------------
// Edit Mode Logic
// ---------------------------------------------------------
function setupEditMode() {
    toggleEditModeBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        document.body.classList.toggle('edit-mode', isEditMode);

        if (isEditMode) {
            toggleEditModeBtn.textContent = '編集終了';
            toggleEditModeBtn.classList.add('active');
            saveLayoutBtn.classList.remove('hidden');
            editControls.classList.remove('hidden');
            setEditTool('create'); // Start with create tool
        } else {
            toggleEditModeBtn.textContent = 'レイアウト編集';
            toggleEditModeBtn.classList.remove('active');
            saveLayoutBtn.classList.add('hidden');
            editControls.classList.add('hidden');
            deselectAllSeats();
        }
    });

    saveLayoutBtn.addEventListener('click', saveLayout);

    // Rotate/Delete
    rotateSeatBtn.addEventListener('click', rotateSelectedSeats);
    deleteSeatBtn.addEventListener('click', deleteSelectedSeats);
    resetSeatsBtn.addEventListener('click', () => {
        if (confirm('全ての座席を削除しますか？この操作は取り消せません。')) {
            layoutData.seats = [];
            deselectAllSeats();
            
            // Clear all occupancy data as well
            occupancyData = {};
            
            renderSeats();
            
            // Also clear occupancy data on server
            clearAllOccupancyData();
        }
    });

    // Inputs
    seatPrefixInput.addEventListener('change', autoUpdateNextNumber);
    seatNumberInput.addEventListener('change', () => {
        // If single selection, update it
        if (selectedSeatIds.size === 1) {
            updateSelectedSeatId([...selectedSeatIds][0]);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (!isEditMode) return;
        if (e.target.tagName === 'INPUT') return;

        if (e.key === 'r' || e.key === 'R') rotateSelectedSeats();
        if (e.key === 'Delete' || e.key === 'Backspace') deleteSelectedSeats();
        if (e.key === 'Escape') deselectAllSeats();
        
        // Copy/Paste shortcuts
        if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            copySelectedSeats();
        }
        if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            pasteSeats();
        }
    });

    // Layout Container Events
    layoutContainer.addEventListener('mousedown', handleLayoutMouseDown);
    layoutContainer.addEventListener('click', handleLayoutClick);
}

function handleLayoutMouseDown(e) {
    if (!isEditMode) return;
    if (e.target.closest('.seat')) return; // Handled by seat

    // Left click for selection box
    if (e.button === 0) {
        startSelectionBox(e);
    }
}

function handleLayoutClick(e) {
    if (!isEditMode) return;
    if (e.target.closest('.seat')) return;

    // Create seat on click if not dragging
    if (!isDragOperation && !isSelecting) {
        const rect = layoutContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        createSeatAt(x, y);
    }
}

function setEditTool(tool) {
    editTool = tool;
    // Update cursor
    if (isEditMode) {
        layoutContainer.style.cursor = tool === 'create' ? 'crosshair' : 'default';
    }
}

function createSeatAt(x, y) {
    let rotation = 0;

    // Inherit rotation
    if (lastCreatedSeat) {
        rotation = lastCreatedSeat.rotation || 0;
    } else if (selectedSeatIds.size > 0) {
        // Try to inherit from a selected seat if no last created
        const lastId = [...selectedSeatIds][selectedSeatIds.size - 1];
        const s = layoutData.seats.find(i => i.id === lastId);
        if (s) rotation = s.rotation;
    }

    const prefix = seatPrefixInput.value.trim() || 'A';
    const num = getNextAvailableNumber(prefix);
    const newId = `${prefix}-${num}`;

    if (layoutData.seats.some(s => s.id === newId)) {
        alert(`ID ${newId} already exists. Please check numbering.`);
        return;
    }

    const width = 94;  // 72 * 1.3 ≈ 94
    const height = 62; // 48 * 1.3 ≈ 62

    const newSeat = {
        id: newId,
        label: getSeatDisplayLabel(newId), // Use display label
        x: x - width / 2, // Center on click
        y: y - height / 2,
        width,
        height,
        rotation
    };

    layoutData.seats.push(newSeat);
    lastCreatedSeat = newSeat;

    // Select the new seat (only)
    deselectAllSeats();
    selectSeat(newId);

    renderSeats();

    // Increment number for all seat types
    const currentNum = parseInt(seatNumberInput.value) || 1;
    seatNumberInput.value = currentNum + 1;
}

// ---------------------------------------------------------
// Selection & Drag & Snap
// ---------------------------------------------------------

function selectSeat(id, addToSelection = false) {
    if (!addToSelection) {
        selectedSeatIds.clear();
    }
    selectedSeatIds.add(id);
    updateSelectionUI();
}

function toggleSeatSelection(id) {
    if (selectedSeatIds.has(id)) {
        selectedSeatIds.delete(id);
    } else {
        selectedSeatIds.add(id);
    }
    updateSelectionUI();
}

function deselectAllSeats() {
    selectedSeatIds.clear();
    updateSelectionUI();
}

function updateSelectionUI() {
    renderSeats();

    const count = selectedSeatIds.size;
    rotateSeatBtn.disabled = count === 0;
    deleteSeatBtn.disabled = count === 0;

    // Update inputs if single select
    if (count === 1) {
        const id = [...selectedSeatIds][0];
        const parts = id.split('-');
        if (parts.length === 2 && !isNaN(parts[1])) {
            seatPrefixInput.value = parts[0];
            seatNumberInput.value = parts[1];
        } else {
            seatPrefixInput.value = id;
        }
    }
}

function startSelectionBox(e) {
    if (e.button !== 0) return; // Only left click
    
    isSelecting = true;
    isDragOperation = false;

    const rect = layoutContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    selectionStart = { x, y };

    // Create UI element
    if (selectionBoxEl) selectionBoxEl.remove();
    selectionBoxEl = document.createElement('div');
    selectionBoxEl.className = 'selection-box';
    layoutContainer.appendChild(selectionBoxEl);

    // Prevent default to avoid text selection
    e.preventDefault();

    // Listeners
    window.addEventListener('mousemove', handleSelectionBoxMove);
    window.addEventListener('mouseup', handleSelectionBoxEnd);
}

function handleSelectionBoxMove(e) {
    if (!isSelecting) return;
    e.preventDefault();
    isDragOperation = true;

    const rect = layoutContainer.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const left = Math.min(selectionStart.x, x);
    const top = Math.min(selectionStart.y, y);
    const width = Math.abs(x - selectionStart.x);
    const height = Math.abs(y - selectionStart.y);

    selectionBoxEl.style.left = left + 'px';
    selectionBoxEl.style.top = top + 'px';
    selectionBoxEl.style.width = width + 'px';
    selectionBoxEl.style.height = height + 'px';
}

function handleSelectionBoxEnd(e) {
    if (!isSelecting) return;
    
    isSelecting = false;
    window.removeEventListener('mousemove', handleSelectionBoxMove);
    window.removeEventListener('mouseup', handleSelectionBoxEnd);

    if (!selectionBoxEl) return;

    const boxRect = {
        left: parseFloat(selectionBoxEl.style.left) || 0,
        top: parseFloat(selectionBoxEl.style.top) || 0,
        width: parseFloat(selectionBoxEl.style.width) || 0,
        height: parseFloat(selectionBoxEl.style.height) || 0
    };

    selectionBoxEl.remove();
    selectionBoxEl = null;

    // If small movement, treat as click to deselect
    if (boxRect.width < 5 && boxRect.height < 5) {
        if (!e.shiftKey) deselectAllSeats();
        setTimeout(() => { isDragOperation = false; }, 0);
        return;
    }

    const right = boxRect.left + boxRect.width;
    const bottom = boxRect.top + boxRect.height;

    if (!e.shiftKey) selectedSeatIds.clear();

    layoutData.seats.forEach(seat => {
        const seatRight = seat.x + seat.width;
        const seatBottom = seat.y + seat.height;
        // Check intersection
        if (seat.x < right && seatRight > boxRect.left &&
            seat.y < bottom && seatBottom > boxRect.top) {
            selectedSeatIds.add(seat.id);
        }
    });

    updateSelectionUI();
    setTimeout(() => { isDragOperation = false; }, 0);
}

function setupSeatEvents(seatEl) {
    seatEl.addEventListener('mousedown', (e) => {
        if (!isEditMode) return;
        e.stopPropagation();

        const id = seatEl.dataset.id;

        // Handle Select/Drag
        // If Shift is held, toggle. If not, select (if not already).
        if (e.shiftKey) {
            toggleSeatSelection(id);
        } else {
            if (!selectedSeatIds.has(id)) {
                selectSeat(id);
            }
        }

        // Initiate Drag
        draggedSeatIds = Array.from(selectedSeatIds);
        dragOffset.x = e.clientX;
        dragOffset.y = e.clientY;
        dragOffset.initialPositions = {};
        draggedSeatIds.forEach(did => {
            const s = layoutData.seats.find(x => x.id === did);
            dragOffset.initialPositions[did] = { x: s.x, y: s.y };
        });

        isDraggingSeat = true;
        document.body.style.cursor = 'move';
        window.addEventListener('mousemove', handleSeatDrag);
        window.addEventListener('mouseup', handleSeatDragEnd);
    });

    seatEl.addEventListener('click', (e) => {
        if (!isEditMode) {
            e.stopPropagation();
            const id = seatEl.dataset.id;
            const occupant = occupancyData[id];
            openModal({ id, name: occupant ? occupant.name : null });
        }
    });

    // Add drag functionality for occupied seats in normal mode
    if (!isEditMode) {
        seatEl.addEventListener('mousedown', (e) => {
            const occupant = occupancyData[seatEl.dataset.id];
            if (occupant && occupant.name) {
                // Start dragging occupied seat
                startSeatMove(e, seatEl.dataset.id, occupant.name);
            }
        });
    }
}

function handleSeatDrag(e) {
    if (!isDraggingSeat) return;
    e.preventDefault();

    const deltaX = (e.clientX - dragOffset.x) / scale;
    const deltaY = (e.clientY - dragOffset.y) / scale;

    // Move seats to temporary position
    draggedSeatIds.forEach(id => {
        const s = layoutData.seats.find(x => x.id === id);
        const init = dragOffset.initialPositions[id];
        s.x = init.x + deltaX;
        s.y = init.y + deltaY;
    });

    // Simplified but correct snap logic for rotated seats
    const stationary = layoutData.seats.filter(s => !selectedSeatIds.has(s.id));
    const dragging = layoutData.seats.filter(s => selectedSeatIds.has(s.id));

    const SNAP_THRESH = 15;
    let bestSnapX = null;
    let bestSnapY = null;
    let minDistX = SNAP_THRESH + 1;
    let minDistY = SNAP_THRESH + 1;

    // Helper function to get correct rotated corners
    function getSeatCorners(seat) {
        const cx = seat.x + seat.width / 2;
        const cy = seat.y + seat.height / 2;
        const rotation = (seat.rotation || 0) * Math.PI / 180;
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = seat.width / 2;
        const hh = seat.height / 2;
        
        // Local coordinates of corners (before rotation)
        const localCorners = [
            { x: -hw, y: -hh }, // top-left
            { x: hw, y: -hh },  // top-right
            { x: hw, y: hh },   // bottom-right
            { x: -hw, y: hh }   // bottom-left
        ];
        
        // Apply rotation and translation
        return localCorners.map(corner => ({
            x: cx + corner.x * cos - corner.y * sin,
            y: cy + corner.x * sin + corner.y * cos
        }));
    }

    // Helper function to get edge midpoints and directions
    function getSeatEdges(seat) {
        const corners = getSeatCorners(seat);
        
        return [
            { // top edge (0->1)
                start: corners[0], 
                end: corners[1],
                mid: { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 },
                name: 'top'
            },
            { // right edge (1->2)
                start: corners[1], 
                end: corners[2],
                mid: { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 },
                name: 'right'
            },
            { // bottom edge (2->3)
                start: corners[2], 
                end: corners[3],
                mid: { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 },
                name: 'bottom'
            },
            { // left edge (3->0)
                start: corners[3], 
                end: corners[0],
                mid: { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 },
                name: 'left'
            }
        ];
    }

    // Helper function to check if two edges are parallel and calculate snap
    function calculateEdgeSnap(edge1, edge2) {
        // Calculate edge direction vectors
        const dir1 = {
            x: edge1.end.x - edge1.start.x,
            y: edge1.end.y - edge1.start.y
        };
        const dir2 = {
            x: edge2.end.x - edge2.start.x,
            y: edge2.end.y - edge2.start.y
        };
        
        // Normalize direction vectors
        const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
        const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
        
        if (len1 === 0 || len2 === 0) return null;
        
        dir1.x /= len1;
        dir1.y /= len1;
        dir2.x /= len2;
        dir2.y /= len2;
        
        // Check if edges are parallel (dot product close to ±1)
        const dotProduct = dir1.x * dir2.x + dir1.y * dir2.y;
        if (Math.abs(Math.abs(dotProduct) - 1) > 0.1) return null; // Not parallel enough
        
        // Calculate perpendicular vector to edge1
        const perp = { x: -dir1.y, y: dir1.x };
        
        // Vector from edge1 midpoint to edge2 midpoint
        const midDiff = {
            x: edge2.mid.x - edge1.mid.x,
            y: edge2.mid.y - edge1.mid.y
        };
        
        // Distance is projection onto perpendicular
        const distance = midDiff.x * perp.x + midDiff.y * perp.y;
        
        return {
            distance: Math.abs(distance),
            offsetX: perp.x * distance,
            offsetY: perp.y * distance,
            parallel: true
        };
    }

    // Check each dragging seat against each stationary seat
    for (const d of dragging) {
        const dEdges = getSeatEdges(d);
        
        for (const s of stationary) {
            const sEdges = getSeatEdges(s);
            
            // Check all edge combinations
            for (const dEdge of dEdges) {
                for (const sEdge of sEdges) {
                    const snapResult = calculateEdgeSnap(dEdge, sEdge);
                    
                    if (snapResult && snapResult.distance <= SNAP_THRESH) {
                        // Determine which axis this snap affects more
                        const absOffsetX = Math.abs(snapResult.offsetX);
                        const absOffsetY = Math.abs(snapResult.offsetY);
                        
                        if (absOffsetX > absOffsetY) {
                            // X-axis dominant
                            if (snapResult.distance < minDistX) {
                                minDistX = snapResult.distance;
                                bestSnapX = snapResult.offsetX;
                            }
                        } else {
                            // Y-axis dominant  
                            if (snapResult.distance < minDistY) {
                                minDistY = snapResult.distance;
                                bestSnapY = snapResult.offsetY;
                            }
                        }
                    }
                }
            }
        }
    }

    // Apply snap adjustments
    if (bestSnapX !== null) {
        dragging.forEach(s => s.x += bestSnapX);
    }
    if (bestSnapY !== null) {
        dragging.forEach(s => s.y += bestSnapY);
    }

    renderSeats();
}

function handleSeatDragEnd() {
    isDraggingSeat = false;
    draggedSeatIds = [];
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleSeatDrag);
    window.removeEventListener('mouseup', handleSeatDragEnd);
}


// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function clientToLayout(clientX, clientY) {
    const rect = layoutContainer.getBoundingClientRect();
    return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale
    };
}

function rotateSelectedSeats() {
    if (selectedSeatIds.size === 0) return;

    selectedSeatIds.forEach(id => {
        const seat = layoutData.seats.find(s => s.id === id);
        if (seat) {
            seat.rotation = ((seat.rotation || 0) + 45) % 360;
        }
    });
    renderSeats();
}

function deleteSelectedSeats() {
    if (selectedSeatIds.size === 0) return;
    if (!confirm(`${selectedSeatIds.size} 件の座席を削除しますか？`)) return;

    layoutData.seats = layoutData.seats.filter(s => !selectedSeatIds.has(s.id));
    deselectAllSeats();
    renderSeats();
}

function copySelectedSeats() {
    if (selectedSeatIds.size === 0) return;
    
    copiedSeats = layoutData.seats
        .filter(s => selectedSeatIds.has(s.id))
        .map(seat => ({ ...seat })); // Deep copy
    
    console.log(`${copiedSeats.length} 席をコピーしました`);
}

function pasteSeats() {
    if (copiedSeats.length === 0) return;
    
    const newSeats = [];
    
    copiedSeats.forEach(copiedSeat => {
        // Extract prefix from original ID (including special seats like 外出, 在宅)
        const match = copiedSeat.id.match(/^(.+)-\d+$/);
        let prefix = 'A';
        
        if (match) {
            prefix = match[1]; // This will be "外出", "在宅", "A", "B", etc.
        }
        
        // Find next available number for this prefix
        const nextNumber = getNextAvailableNumber(prefix);
        const newId = `${prefix}-${nextNumber}`;
        
        // Create new seat with offset position
        const newSeat = {
            ...copiedSeat,
            id: newId,
            label: getSeatDisplayLabel(newId), // Use display label
            x: copiedSeat.x + pasteOffset.x,
            y: copiedSeat.y + pasteOffset.y
        };
        
        layoutData.seats.push(newSeat);
        newSeats.push(newSeat);
    });
    
    // Select the newly pasted seats
    deselectAllSeats();
    newSeats.forEach(seat => selectedSeatIds.add(seat.id));
    updateSelectionUI();
    
    // Increment paste offset for next paste
    pasteOffset.x += 20;
    pasteOffset.y += 20;
    
    // Reset offset if it gets too large
    if (pasteOffset.x > 100) {
        pasteOffset.x = 20;
        pasteOffset.y = 20;
    }
    
    console.log(`${newSeats.length} 席をペーストしました`);
}

function getNextAvailableNumber(prefix) {
    // All seats get numbers internally, including "外出" and "在宅"
    const existingNumbers = layoutData.seats
        .map(s => s.id)
        .filter(id => id.startsWith(prefix + '-'))
        .map(id => {
            const match = id.match(/^.+-(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        })
        .filter(num => !isNaN(num));
    
    if (existingNumbers.length === 0) return 1;
    
    // Find the first gap in the sequence, or return max + 1
    existingNumbers.sort((a, b) => a - b);
    
    for (let i = 1; i <= existingNumbers[existingNumbers.length - 1] + 1; i++) {
        if (!existingNumbers.includes(i)) {
            return i;
        }
    }
    
    return existingNumbers[existingNumbers.length - 1] + 1;
}

// Helper function to get display label (hide numbers for special seats)
function getSeatDisplayLabel(seatId) {
    if (seatId.includes('外出-') || seatId.includes('在宅-')) {
        // Remove the number part for display
        return seatId.replace(/-\d+$/, '');
    }
    return seatId;
}

function startSeatMove(e, fromSeatId, personName) {
    if (isEditMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    isMovingSeat = true;
    movingFromSeatId = fromSeatId;
    movingPersonName = personName;
    
    document.body.style.cursor = 'move';
    
    // Add visual feedback
    const movingEl = document.querySelector(`.seat[data-id="${fromSeatId}"]`);
    if (movingEl) {
        movingEl.style.opacity = '0.7';
        movingEl.style.border = '2px dashed #f59e0b';
    }
    
    // Add event listeners for drop
    document.addEventListener('mouseup', handleSeatMoveEnd);
    
    console.log(`Started moving ${personName} from seat ${fromSeatId}`);
}

function handleSeatMoveEnd(e) {
    if (!isMovingSeat) return;
    
    // Find the seat element under the mouse
    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    const targetSeatEl = elementUnderMouse?.closest('.seat');
    
    if (targetSeatEl) {
        const toSeatId = targetSeatEl.dataset.id;
        const targetOccupant = occupancyData[toSeatId];
        
        // Check if target seat is empty
        if (!targetOccupant && toSeatId !== movingFromSeatId) {
            // Show confirmation dialog
            const confirmed = confirm(`${movingPersonName}さんを座席${movingFromSeatId}から座席${toSeatId}に移動しますか？`);
            
            if (confirmed) {
                movePerson(movingFromSeatId, toSeatId, movingPersonName);
            }
        }
    }
    
    // Clean up
    cleanupSeatMove();
}

async function movePerson(fromSeatId, toSeatId, personName) {
    try {
        // Remove from old seat
        await fetch(API_OCCUPANCY_LEAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seatId: fromSeatId })
        });
        
        // Add to new seat
        await fetch(API_OCCUPANCY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seatId: toSeatId, name: personName })
        });
        
        // Update local data
        delete occupancyData[fromSeatId];
        occupancyData[toSeatId] = {
            name: personName,
            timestamp: new Date().toISOString()
        };
        
        // Re-render seats
        renderSeats();
        
        console.log(`Moved ${personName} from ${fromSeatId} to ${toSeatId}`);
        
    } catch (error) {
        console.error('Error moving person:', error);
        alert('座席移動に失敗しました');
    }
}

function cleanupSeatMove() {
    isMovingSeat = false;
    document.body.style.cursor = '';
    
    // Remove visual feedback
    if (movingFromSeatId) {
        const movingEl = document.querySelector(`.seat[data-id="${movingFromSeatId}"]`);
        if (movingEl) {
            movingEl.style.opacity = '';
            movingEl.style.border = '';
        }
    }
    
    movingFromSeatId = null;
    movingPersonName = null;
    
    document.removeEventListener('mouseup', handleSeatMoveEnd);
}

function autoUpdateNextNumber() {
    const prefix = seatPrefixInput.value.trim();
    let max = 0;
    layoutData.seats.forEach(s => {
        if (s.id.startsWith(prefix + '-')) {
            const n = parseInt(s.id.split('-')[1]);
            if (!isNaN(n) && n > max) max = n;
        }
    });
    seatNumberInput.value = max + 1;
}

function updateSelectedSeatId(id) {
    const prefix = seatPrefixInput.value.trim();
    const num = parseInt(seatNumberInput.value);
    const newId = `${prefix}-${num}`;

    if (newId === id) return;

    if (layoutData.seats.some(s => s.id === newId && s.id !== id)) {
        alert(`ID ${newId} already taken.`);
        return;
    }

    const seat = layoutData.seats.find(s => s.id === id);
    if (seat) {
        seat.id = newId;
        seat.label = newId;

        // Update selection set
        selectedSeatIds.delete(id);
        selectedSeatIds.add(newId);

        renderSeats();
    }
}

// ---------------------------------------------------------
// Render & Zoom (Basic)
// ---------------------------------------------------------

function renderSeats() {
    const currentIds = new Set(layoutData.seats.map(s => s.id));
    Array.from(seatGrid.children).forEach(el => {
        if (!currentIds.has(el.dataset.id)) el.remove();
    });

    layoutData.seats.forEach(seat => {
        let seatEl = seatGrid.querySelector(`.seat[data-id="${seat.id}"]`);
        if (!seatEl) {
            seatEl = document.createElement('div');
            seatEl.className = 'seat';
            seatEl.dataset.id = seat.id;
            seatEl.innerHTML = `
                <div class="seat-occupant"></div>
                <div class="seat-number-overlay">${getSeatDisplayLabel(seat.id)}</div>
            `;
            // 外出・在宅の場合はラベルを非表示
            if (seat.id.includes('外出-') || seat.id.includes('在宅-')) {
                const numberEl = seatEl.querySelector('.seat-number-overlay');
                if (numberEl) numberEl.style.display = 'none';
            }
            setupSeatEvents(seatEl);
            seatGrid.appendChild(seatEl);
        }

        seatEl.style.left = `${seat.x}px`;
        seatEl.style.top = `${seat.y}px`;
        seatEl.style.width = `${seat.width}px`;
        seatEl.style.height = `${seat.height}px`;
        seatEl.style.transform = `rotate(${seat.rotation || 0}deg)`;

        if (isEditMode && selectedSeatIds.has(seat.id)) {
            seatEl.classList.add('selected');
        } else {
            seatEl.classList.remove('selected');
        }

        const occupant = occupancyData[seat.id];
        if (occupant && occupant.name) {
            seatEl.classList.add('occupied');
            seatEl.querySelector('.seat-occupant').textContent = occupant.name;
        } else {
            seatEl.classList.remove('occupied');
            seatEl.querySelector('.seat-occupant').textContent = '';
        }

        // Calculate text rotation based on seat rotation
        const seatRotation = seat.rotation || 0;
        let textRotation = 0;
        
        // Normalize rotation to 0-360 range
        const normalizedRotation = ((seatRotation % 360) + 360) % 360;
        
        // Map seat rotation to text rotation for readability
        if (normalizedRotation >= 0 && normalizedRotation < 45) {
            textRotation = 0;
        } else if (normalizedRotation >= 45 && normalizedRotation < 90) {
            textRotation = 45;
        } else if (normalizedRotation >= 90 && normalizedRotation < 135) {
            textRotation = 90;
        } else if (normalizedRotation >= 135 && normalizedRotation < 180) {
            textRotation = -45; // -45度で読みやすく
        } else if (normalizedRotation >= 180 && normalizedRotation < 225) {
            textRotation = 0; // 0度で読みやすく
        } else if (normalizedRotation >= 225 && normalizedRotation < 270) {
            textRotation = 45; // 45度で読みやすく
        } else if (normalizedRotation >= 270 && normalizedRotation < 315) {
            textRotation = 270;
        } else { // 315-360
            textRotation = 315;
        }

        const occupantEl = seatEl.querySelector('.seat-occupant');
        const numberEl = seatEl.querySelector('.seat-number-overlay');
        
        // Apply the calculated text rotation (independent of seat rotation)
        occupantEl.style.transform = `rotate(${-seatRotation + textRotation}deg)`;
        // ラベルは右下に固定（回転なし）
        numberEl.style.transform = 'none';
        
        // 外出・在宅の場合はラベルを非表示
        if (seat.id.includes('外出-') || seat.id.includes('在宅-')) {
            numberEl.style.display = 'none';
        } else {
            numberEl.style.display = 'block';
            numberEl.textContent = getSeatDisplayLabel(seat.id);
        }
    });
}

function setupZoomPan() {
    updateTransform();
    const container = document.querySelector('.map-container-outer');

    // Wheel zoom and pan
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // If holding Ctrl key, zoom instead of pan
        if (e.ctrlKey) {
            const zoomStep = 0.15;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;

            const localX = (mouseX - pannedX) / scale;
            const localY = (mouseY - pannedY) / scale;

            let newScale = e.deltaY < 0 ? scale * (1 + zoomStep) : scale / (1 + zoomStep);
            newScale = Math.min(Math.max(0.2, newScale), 5);

            pannedX = mouseX - (localX * newScale);
            pannedY = mouseY - (localY * newScale);

            scale = newScale;
            updateTransform();
            return;
        }
        
        // If holding middle button, pan
        if (e.buttons === 4) {
            pannedX -= e.deltaX;
            pannedY -= e.deltaY;
            updateTransform();
            return;
        }

        // Default: zoom
        const zoomStep = 0.15;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const localX = (mouseX - pannedX) / scale;
        const localY = (mouseY - pannedY) / scale;

        let newScale = e.deltaY < 0 ? scale * (1 + zoomStep) : scale / (1 + zoomStep);
        newScale = Math.min(Math.max(0.2, newScale), 5);

        pannedX = mouseX - (localX * newScale);
        pannedY = mouseY - (localY * newScale);

        scale = newScale;
        updateTransform();
    }, { passive: false });

    // Middle mouse button pan
    container.addEventListener('mousedown', (e) => {
        // Middle mouse button or wheel click for panning
        if (e.button === 1) {
            e.preventDefault();
            isPanningWithWheel = true;
            panStartX = e.clientX - pannedX;
            panStartY = e.clientY - pannedY;
            container.style.cursor = 'grabbing';
            return;
        }

        // Regular pan only in non-edit mode
        if (!isEditMode && e.button === 0) {
            if (e.target.closest('.seat') || e.target.closest('.toolbar')) return;
            
            isDraggingMap = true;
            mapStartX = e.clientX - pannedX;
            mapStartY = e.clientY - pannedY;
            container.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanningWithWheel) {
            e.preventDefault();
            pannedX = e.clientX - panStartX;
            pannedY = e.clientY - panStartY;
            updateTransform();
            return;
        }

        if (isDraggingMap) {
            e.preventDefault();
            pannedX = e.clientX - mapStartX;
            pannedY = e.clientY - mapStartY;
            updateTransform();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isPanningWithWheel) {
            isPanningWithWheel = false;
            container.style.cursor = isEditMode ? 'crosshair' : 'grab';
        }
        
        if (isDraggingMap) {
            isDraggingMap = false;
            container.style.cursor = isEditMode ? 'crosshair' : 'grab';
        }
    });

    // Zoom controls
    zoomInBtn.addEventListener('click', () => { 
        const newScale = Math.min(scale * 1.3, 5);
        animateToTransform(newScale, pannedX, pannedY);
    });
    zoomOutBtn.addEventListener('click', () => { 
        const newScale = Math.max(scale / 1.3, 0.2);
        animateToTransform(newScale, pannedX, pannedY);
    });
    resetZoomBtn.addEventListener('click', () => {
        fitToView();
    });
    
    // Rotate view button
    const rotateViewBtn = document.getElementById('rotate-view');
    rotateViewBtn.addEventListener('click', () => {
        rotateView();
    });

    // Search events
    searchBtn.addEventListener('click', () => handleSearch());
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    searchInput.addEventListener('input', handleSearchInput);

function rotateView() {
    viewRotation = (viewRotation + 90) % 360;
    
    // Animate the rotation
    const startRotation = viewRotation - 90;
    const targetRotation = viewRotation;
    const duration = 400; // 400ms animation
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out cubic function for smooth rotation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate rotation
        const currentRotation = startRotation + (targetRotation - startRotation) * easeOutCubic;
        
        // Apply rotation
        mapWrapper.style.transform = `translate(-50%, -50%) translate(${pannedX}px, ${pannedY}px) scale(${scale}) rotate(${currentRotation}deg)`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Ensure final state is set
            updateTransform();
        }
    }
    
    requestAnimationFrame(animate);
}

// Search Logic (Compact)
function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if (!query) { searchResults.classList.add('hidden'); return; }
    const matches = Object.entries(occupancyData).filter(([_, d]) => d?.name?.toLowerCase().includes(query));
    if (matches.length) {
        matches.forEach(([id, d]) => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = `${d.name} (${getSeatDisplayLabel(id)})`;
            div.onclick = () => { panToSeat(id); highlightSeat(id); searchResults.classList.add('hidden'); };
            searchResults.appendChild(div);
        });
        searchResults.classList.remove('hidden');
    } else { searchResults.classList.add('hidden'); }
}

function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    const match = Object.entries(occupancyData).find(([_, d]) => d?.name?.toLowerCase().includes(query));
    if (match) { panToSeat(match[0]); highlightSeat(match[0]); }
}
}

function updateTransform() {
    // Apply view rotation and then the usual transform
    mapWrapper.style.transform = `translate(-50%, -50%) translate(${pannedX}px, ${pannedY}px) scale(${scale}) rotate(${viewRotation}deg)`;
    
    // Update cursor based on mode
    const container = document.querySelector('.map-container-outer');
    if (isEditMode) {
        container.style.cursor = 'crosshair';
    } else {
        container.style.cursor = isDraggingMap || isPanningWithWheel ? 'grabbing' : 'grab';
    }
}

function fitToView() {
    // Always fit to the background image (layout.svg) instead of seats
    const layoutImage = document.getElementById('layout-image');
    
    if (layoutImage && layoutImage.offsetWidth > 0 && layoutImage.offsetHeight > 0) {
        // Fit to background image
        const imageWidth = layoutImage.offsetWidth;
        const imageHeight = layoutImage.offsetHeight;
        
        // Get container dimensions
        const container = document.querySelector('.map-container-outer');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Add some padding
        const padding = 50;
        
        // Calculate scale to fit image with padding
        const scaleX = (containerWidth - padding * 2) / imageWidth;
        const scaleY = (containerHeight - padding * 2) / imageHeight;
        scale = Math.min(scaleX, scaleY, 2.0); // Max scale of 2.0
        
        // Center the image
        const targetPannedX = 0;
        const targetPannedY = 0;
        
        animateToTransform(scale, targetPannedX, targetPannedY);
    } else if (layoutData.seats.length > 0) {
        // Fallback: fit to seats if no background image
        fitToSeats();
    } else {
        // No image and no seats, reset to default view
        animateToTransform(0.8, 0, 0);
    }
}

function fitToSeats() {
    // Calculate bounding box of all seats
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    layoutData.seats.forEach(seat => {
        // For rotated seats, we need to calculate the actual bounding box
        const cx = seat.x + seat.width / 2;
        const cy = seat.y + seat.height / 2;
        const rotation = (seat.rotation || 0) * Math.PI / 180;
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = seat.width / 2;
        const hh = seat.height / 2;
        
        // Calculate rotated corners
        const corners = [
            { x: cx + (-hw * cos - (-hh) * sin), y: cy + (-hw * sin + (-hh) * cos) },
            { x: cx + (hw * cos - (-hh) * sin), y: cy + (hw * sin + (-hh) * cos) },
            { x: cx + (hw * cos - hh * sin), y: cy + (hw * sin + hh * cos) },
            { x: cx + (-hw * cos - hh * sin), y: cy + (-hw * sin + hh * cos) }
        ];
        
        corners.forEach(corner => {
            minX = Math.min(minX, corner.x);
            minY = Math.min(minY, corner.y);
            maxX = Math.max(maxX, corner.x);
            maxY = Math.max(maxY, corner.y);
        });
    });
    
    // Add some padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    // Get container dimensions
    const container = document.querySelector('.map-container-outer');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Calculate scale to fit content
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    scale = Math.min(scaleX, scaleY, 2.0); // Max scale of 2.0
    
    // Calculate pan to center content
    const targetPannedX = -contentCenterX * scale + containerWidth / 2;
    const targetPannedY = -contentCenterY * scale + containerHeight / 2;
    
    animateToTransform(scale, targetPannedX, targetPannedY);
}

// Search Logic (Compact)
function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if (!query) { searchResults.classList.add('hidden'); return; }
    const matches = Object.entries(occupancyData).filter(([_, d]) => d?.name?.toLowerCase().includes(query));
    if (matches.length) {
        matches.forEach(([id, d]) => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = `${d.name} (${id})`;
            div.onclick = () => { 
                panToSeat(id); 
                setTimeout(() => highlightSeat(id), 100); // Slight delay to ensure pan starts first
                searchResults.classList.add('hidden'); 
            };
            searchResults.appendChild(div);
        });
        searchResults.classList.remove('hidden');
    } else { searchResults.classList.add('hidden'); }
}

function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    const match = Object.entries(occupancyData).find(([_, d]) => d?.name?.toLowerCase().includes(query));
    if (match) { panToSeat(match[0]); highlightSeat(match[0]); }
}

function panToSeat(id) {
    const seat = layoutData.seats.find(s => s.id == id);
    if (!seat) return;

    // Don't reset view rotation - keep the current rotation
    // viewRotation = 0; // Removed to prevent flicker

    // Calculate seat center
    const seatCenterX = seat.x + seat.width / 2;
    const seatCenterY = seat.y + seat.height / 2;

    // Get container dimensions
    const container = document.querySelector('.map-container-outer');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Set a fixed zoom level for search results
    const targetScale = 1.5;
    
    // Use the original working approach (no rotation compensation needed)
    const scaledSeatCenterX = seatCenterX * targetScale;
    const scaledSeatCenterY = seatCenterY * targetScale;
    
    const basePanX = -scaledSeatCenterX;
    const basePanY = -scaledSeatCenterY;
    
    // Manual adjustment offsets (your measured values that worked)
    const adjustmentX = 2370;  // Your measured value that worked
    const adjustmentY = 2650;  // Your measured value that worked
    
    const targetPannedX = basePanX + adjustmentX;
    const targetPannedY = basePanY + adjustmentY;

    // Debug logging (disabled for production)
    /*
    console.log(`=== SEARCH WITH ROTATION RESET: Seat ${id} ===`);
    console.log(`View rotation reset to: ${viewRotation}°`);
    console.log(`Seat center: (${seatCenterX.toFixed(1)}, ${seatCenterY.toFixed(1)})`);
    console.log(`Final pan: (${targetPannedX.toFixed(1)}, ${targetPannedY.toFixed(1)})`);
    */
    
    // Add debug overlay to show target center (disabled for production)
    // addDebugOverlay(seatCenterX, seatCenterY, containerWidth, containerHeight);
    
    // Animate to target position and scale
    animateToTransform(targetScale, targetPannedX, targetPannedY);
}

function addDebugOverlay(seatX, seatY, containerWidth, containerHeight) {
    // Remove existing debug overlay
    const existingOverlay = document.getElementById('debug-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Create debug overlay
    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10000;
    `;
    
    // Add screen center crosshair
    const centerCross = document.createElement('div');
    centerCross.style.cssText = `
        position: absolute;
        left: ${containerWidth/2 - 10}px;
        top: ${containerHeight/2 - 10}px;
        width: 20px;
        height: 20px;
        border: 2px solid red;
        background: rgba(255,0,0,0.3);
    `;
    overlay.appendChild(centerCross);
    
    // Add screen center label
    const centerLabel = document.createElement('div');
    centerLabel.textContent = 'Screen Center';
    centerLabel.style.cssText = `
        position: absolute;
        left: ${containerWidth/2 + 15}px;
        top: ${containerHeight/2 - 10}px;
        color: red;
        font-weight: bold;
        background: white;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 12px;
    `;
    overlay.appendChild(centerLabel);
    
    document.body.appendChild(overlay);
    
    // Remove overlay after 5 seconds
    setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
    }, 5000);
}

function animateToTransform(targetScale, targetPannedX, targetPannedY) {
    const startScale = scale;
    const startPannedX = pannedX;
    const startPannedY = pannedY;
    
    const duration = 800; // 800ms animation
    const startTime = performance.now();
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-in-out cubic function for smooth acceleration/deceleration
        const easeInOutCubic = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Interpolate values
        scale = startScale + (targetScale - startScale) * easeInOutCubic;
        pannedX = startPannedX + (targetPannedX - startPannedX) * easeInOutCubic;
        pannedY = startPannedY + (targetPannedY - startPannedY) * easeInOutCubic;
        
        updateTransform();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

function highlightSeat(id) {
    document.querySelectorAll('.seat.highlight').forEach(s => s.classList.remove('highlight'));
    const s = document.querySelector(`.seat[data-id="${id}"]`);
    if (s) {
        s.classList.add('highlight');
        // Force re-render to ensure transform is preserved
        s.offsetHeight;
    }
}

// Server Interaction
async function clearAllOccupancyData() {
    try {
        const response = await fetch(API_OCCUPANCY_CLEAR_ALL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            // Clear local data
            occupancyData = {};
            console.log('全ての着席データをクリアしました');
        } else {
            console.error('Failed to clear occupancy data on server');
        }
    } catch (error) {
        console.error('Error clearing occupancy data:', error);
    }
}

async function saveLayout() {
    try {
        await fetch(API_LAYOUT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seats: layoutData.seats })
        });
        alert('Saved.');
        isEditMode = false;
        document.body.classList.remove('edit-mode');
        setupEditMode(); // Refresh UI state
    } catch (e) { console.error(e); alert('Error'); }
}

async function fetchLayout() {
    try {
        const response = await fetch(API_LAYOUT_URL);
        const data = await response.json();
        layoutData = data;
        renderSeats();
        
        // Auto-fit view to show all seats
        fitToView();
    } catch (error) {
        console.error('Error fetching layout:', error);
    }
}

async function fetchOccupancy() {
    try {
        const response = await fetch(API_OCCUPANCY_URL);
        occupancyData = await response.json();
        renderSeats();
    } catch (error) {
        console.error('Error fetching occupancy:', error);
    }
}

async function handleSeatSubmit() {
    const name = userNameInput.value.trim();
    const id = selectedSeatIdInput.value;

    if (!name) return;

    try {
        const response = await fetch(API_OCCUPANCY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seatId: id, name })
        });

        if (response.ok) {
            closeModal();
            fetchOccupancy();
        } else {
            alert('Failed to update seat');
        }
    } catch (error) {
        console.error('Error updating seat:', error);
    }
}

async function handleLeaveSeat() {
    const id = selectedSeatIdInput.value;
    try {
        const response = await fetch(API_OCCUPANCY_LEAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seatId: id })
        });
        if (response.ok) {
            closeModal();
            fetchOccupancy();
        }
    } catch (error) {
        console.error('Error leaving seat:', error);
    }
}

function openModal(seat) {
    selectedSeatIdInput.value = seat.id;
    modalTitle.textContent = `席番号: ${seat.id}`;

    if (seat.name) {
        userNameInput.value = seat.name;
        confirmSeatBtn.textContent = '更新する';
        leaveSeatBtn.classList.remove('hidden');
    } else {
        userNameInput.value = '';
        confirmSeatBtn.textContent = '着席する';
        leaveSeatBtn.classList.add('hidden');
    }

    modalOverlay.classList.remove('hidden');
    userNameInput.focus();
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    userNameInput.value = '';
}

// Theme Management
let currentTheme = localStorage.getItem('theme') || 'dark';

function initTheme() {
    document.body.className = currentTheme + '-theme';
    updateThemeIcon();
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.className = currentTheme + '-theme';
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
        if (currentTheme === 'dark') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }
}

function setupThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
}


init();
