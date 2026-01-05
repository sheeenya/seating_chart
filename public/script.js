const API_URL = '/api/seats';
const POLL_INTERVAL = 3000; // 3 seconds

// DOM Elements
const seatGrid = document.getElementById('seat-grid');
const mapWrapper = document.getElementById('map-wrapper');
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

// State
let seatsData = [];
let scale = 0.8; // Changed initial scale to see more
let textScale = 1; // 1 to start
let pannedX = 0;
let pannedY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

// Initialize
function init() {
    fetchSeats();
    setInterval(fetchSeats, POLL_INTERVAL);

    // Zoom/Pan Events
    setupZoomPan();

    // Event Listeners
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    confirmSeatBtn.addEventListener('click', handleSeatSubmit);
    leaveSeatBtn.addEventListener('click', handleLeaveSeat);

    // Enter key support for modal
    userNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSeatSubmit();
    });

    // Search
    // searchInput.addEventListener('input', handleSearch);
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const seats = document.querySelectorAll('.seat');

    // Clear highlights
    seats.forEach(s => s.classList.remove('highlight'));

    if (!query) return; /* Do nothing if empty */

    // Find matching seat
    const targetSeat = seatsData.find(s =>
        s.name && s.name.toLowerCase().includes(query)
    );

    if (targetSeat) {
        const seatEl = seats[targetSeat.id - 1]; // ID is 1-based, index 0-based
        if (seatEl) {
            seatEl.classList.add('highlight');
            panToSeat(targetSeat.id);
        }
    }
}

function panToSeat(seatId) {
    // Find the seat element in the DOM
    // Since seat order matches rendering order, we can index or search
    // But data vs DOM index might differ if sorted? No, 1-to-1.
    // However, seat-grid contains only seats.
    const seatEl = seatGrid.children[seatId - 1];

    if (!seatEl) return;

    // Calculate precise center of the seat relative to the grid
    const seatRect = {
        left: seatEl.offsetLeft,
        top: seatEl.offsetTop,
        width: seatEl.offsetWidth,
        height: seatEl.offsetHeight
    };

    const seatCenterX = seatRect.left + seatRect.width / 2;
    const seatCenterY = seatRect.top + seatRect.height / 2;

    // Map Wrapper Dimensions (Fixed width 1600, height depends on content)
    // padding is included in offset? offsetLeft is relative to offsetParent (room-layout).
    // room-layout is inside map-wrapper.
    // So coordinates are local to map-wrapper (layout has padding but wrapper wraps it?)
    // wrapper > layout > seat

    // layout has padding 40px.
    // seat.offsetLeft includes this padding if layout is relatively positioned? 
    // Grid (layout) is block. Wrapper is absolute.
    // Let's assume offsetLeft is correct relative to the Wrapper's top-left corner 
    // (since wrapper contains layout directly and layout doesn't have position:relative distinct from wrapper context usually, or if it does, it sums up).
    // Actually seat-grid is the offsetParent if it has transform or position/relative.
    // style.css: .room-layout doesn't have position set? 
    // .map-wrapper is absolute.
    // So offsetParent of seat is likely .map-wrapper (closest positioned ancestor).

    // Wrapper Center
    const wrapperWidth = mapWrapper.offsetWidth || 1600;
    const wrapperHeight = mapWrapper.offsetHeight || 1000;

    const wrapperCenterX = wrapperWidth / 2;
    const wrapperCenterY = wrapperHeight / 2;

    // Target Zoom Level
    const targetScale = 2.0; // Zoom in more to see clearly
    scale = targetScale;

    // Calculate translation needed to bring SeatCenter to ScreenCenter
    // Formula: panned = (WrapperCenter - SeatCenter) * scale
    // Because translate is applied *before* or *after*?
    // transform string: translate(-50%, -50%) translate(px, py) scale(s)
    // 1. Center of wrapper is at screen center.
    // 2. We shift by (px, py).
    // 3. We scale.
    // If we want SeatCenter (Sx, Sy) to be at ScreenCenter.
    // Distance from WrapperCenter (Wx, Wy) is (Sx-Wx, Sy-Wy).
    // We need to shift opposite to that distance.
    // And since we scale *after* the shift? No, we observed scale affects translation visual.
    // Wait, if I write `translate(10px) scale(2)`, visual shift is 20px?
    // Test: <div style="transform: translate(100px, 0) scale(2)">
    // Matrix: [2 0 100, 0 2 0] -> x' = 2x + 100.
    // Origin x=0 goes to 100.
    // If I swap: `scale(2) translate(100px, 0)` -> x' = 2(x + 100) = 2x + 200.
    // My code: `translate(${pannedX}px, ${pannedY}px) scale(${scale})`
    // This is `Translate * Scale`. Matrix mul order (right to left applied to vec): Scale first, then Translate?
    // CSS syntax `A B` means apply A( B ( v ) ).
    // So `Translate ( Scale ( v ) )`.
    // x' = x*s + tx.
    // So TX is in SCREEN PIXELS, NOT affected by scale.
    // Let's correct my previous assumption.
    // If `x' = x*s + tx`.
    // We want `x'` (final screen pos relative to center) to be 0 for the Seat.
    // Seat local pos relative to Wrapper Center is `(Sx - Wx)`.
    // So `(Sx - Wx) * s + tx = 0`.
    // `tx = - (Sx - Wx) * s`.

    // Yes! My previous derivation `tx = -100 * s` was correct based on this model.
    // So I DO need to multiply by scale.

    pannedX = (wrapperCenterX - seatCenterX) * scale;
    pannedY = (wrapperCenterY - seatCenterY) * scale;

    // Apply Animation
    mapWrapper.classList.add('smooth-transition');
    updateTransform();

    // Remove class after animation finishes (1.5s) so dragging remains snappy
    setTimeout(() => {
        mapWrapper.classList.remove('smooth-transition');
    }, 1500);
}

function setupZoomPan() {
    // Initial Transform
    updateTransform();

    // Search
    // Manual Search Trigger
    function performSearch() {
        const query = searchInput.value.toLowerCase().trim();
        const seats = document.querySelectorAll('.seat');

        // Clear highlights and results
        seats.forEach(s => s.classList.remove('highlight'));
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');

        if (!query) return;

        // Find matching seats
        const matchedSeats = seatsData.filter(s =>
            s.name && s.name.toLowerCase().includes(query)
        );

        if (matchedSeats.length === 0) {
            // No results
            return;
        }

        if (matchedSeats.length === 1) {
            // Single result - Auto go
            highlightAndPan(matchedSeats[0].id);
        } else {
            // Multiple results - Show list
            searchResults.classList.remove('hidden');
            matchedSeats.forEach(seat => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <span class="name">${seat.name}</span>
                    <span class="seat-id">Seat ${seat.id}</span>
                `;
                item.onclick = () => {
                    highlightAndPan(seat.id);
                    searchResults.classList.add('hidden');
                };
                searchResults.appendChild(item);
            });
        }
    }

    function highlightAndPan(seatId) {
        const seats = document.querySelectorAll('.seat');
        const seatEl = seats[seatId - 1];
        if (seatEl) {
            seatEl.classList.add('highlight');
            panToSeat(seatId);
        }
    }

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Hide results on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.add('hidden');
        }
    });

    // Wheel Zoom
    const wrapper = document.querySelector('main');

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();

        // Smoother zoom: Tuned sensitivity
        // Previous was 0.05, too slow? User said "increase sensitivity from previous low".
        // Let's try 0.1 (10% per tick)
        const zoomStep = 0.1;

        let newScale;
        if (e.deltaY < 0) {
            newScale = scale * (1 + zoomStep);
        } else {
            newScale = scale / (1 + zoomStep);
        }

        // Clamp
        newScale = Math.min(Math.max(0.2, newScale), 5); // Allow deeper zoom

        // Calculate Mouse Position relative to Wrapper Center
        // Screen/Client coordinates of mouse
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // Wrapper Center ( Screen center because of absolute positioning )
        const wrapperRect = wrapper.getBoundingClientRect();
        const wrapperCenterX = wrapperRect.left + wrapperRect.width / 2;
        const wrapperCenterY = wrapperRect.top + wrapperRect.height / 2;

        // Mouse relative to Center (in screen pixels)
        const mouseRelX = mouseX - wrapperCenterX;
        const mouseRelY = mouseY - wrapperCenterY;

        // The logic for zooming towards point P:
        // Value at P should remain stationary in Screen space.
        // ScreenP = Center + Translation + LocalP * Scale
        // We want ScreenP_old == ScreenP_new
        // (Center + T_old + LP*S_old) == (Center + T_new + LP*S_new)
        // T_new = T_old + LP * (S_old - S_new)

        // We need LocalP (LP).
        // ScreenP_old = Center + T_old + LP * S_old
        // LP = (ScreenP_old - Center - T_old) / S_old
        // LP = (mouseRelX - pannedX) / scale

        // So:
        // pannedX_new = pannedX + (mouseRelX - pannedX)/scale * (scale - newScale)
        //             = pannedX + (mouseRelX - pannedX) * (1 - newScale/scale)

        const scaleRatio = newScale / scale;

        // Update panning to compensate zoom
        // pannedX and pannedY are the current translation values.
        // mouseRelX/Y are the vector from center to mouse.

        // Formula:
        // newTranslation = mousePosition - (mousePosition - oldTranslation) * (newScale / oldScale)
        // Wait, different ref frame.

        // Using the LP logic derived above:
        // T_new = T_old + LP * (S_old - S_new)
        // LP = (MouseRel - T_old) / S_old.

        const localX = (mouseRelX - pannedX) / scale;
        const localY = (mouseRelY - pannedY) / scale;

        pannedX = pannedX + localX * (scale - newScale);
        pannedY = pannedY + localY * (scale - newScale);

        scale = newScale;
        updateTransform();
    }, { passive: false });

    // Drag Pan
    const mainArea = document.querySelector('main');

    mainArea.addEventListener('mousedown', (e) => {
        if (e.target.closest('.seat')) return; // Don't drag if clicking a seat
        isDragging = true;
        startX = e.clientX - pannedX;
        startY = e.clientY - pannedY;
        mainArea.style.cursor = 'grabbing';

        // Disable smooth transition during drag
        mapWrapper.classList.remove('smooth-transition');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        pannedX = e.clientX - startX;
        pannedY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        mainArea.style.cursor = 'grab';
    });

    // Buttons (Keep center zoom for buttons)
    zoomInBtn.addEventListener('click', () => {
        scale = Math.min(scale * 1.2, 5);
        updateTransform();
    });

    zoomOutBtn.addEventListener('click', () => {
        scale = Math.max(scale / 1.2, 0.2);
        updateTransform();
    });

    resetZoomBtn.addEventListener('click', () => {
        mapWrapper.classList.add('smooth-transition');
        scale = 0.8;
        pannedX = 0;
        pannedY = 0;
        updateTransform();
        setTimeout(() => mapWrapper.classList.remove('smooth-transition'), 1500);
    });
}

function updateTransform() {
    // Keep seat text readable when zoomed out significantly?
    // Using standard transform for now.
    mapWrapper.style.transform = `translate(-50%, -50%) translate(${pannedX}px, ${pannedY}px) scale(${scale})`;
}


async function fetchSeats() {
    try {
        const response = await fetch(API_URL);
        seatsData = await response.json();
        renderSeats();
    } catch (error) {
        console.error('Error fetching seats:', error);
    }
}

function renderSeats() {
    // Check if grid needs initialization (first run)
    if (seatGrid.children.length !== seatsData.length) {
        seatGrid.innerHTML = '';
        seatsData.forEach(seat => {
            const seatEl = document.createElement('div');
            // Initial class setup
            seatEl.className = 'seat';
            seatEl.dataset.id = seat.id;

            // Structure
            seatEl.innerHTML = `
                <div class="seat-occupant"></div>
                <div class="seat-info-bottom">
                    <span class="seat-number">Num ${seat.id}</span>
                </div>
            `;

            // Event
            seatEl.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent drag start setup
                // We need to find latest data for this ID
                const latestSeat = seatsData.find(s => s.id === seat.id);
                openModal(latestSeat || seat);
            });

            seatGrid.appendChild(seatEl);
        });
    }

    // Update existing elements
    // This preserves '.highlight' class added by search
    const seatElements = Array.from(seatGrid.children);

    seatsData.forEach((seat, index) => {
        const seatEl = seatElements[index];
        if (!seatEl) return;

        // Update Occupied Status
        if (seat.name) {
            seatEl.classList.add('occupied');
        } else {
            seatEl.classList.remove('occupied');
        }

        // Update Name Text
        const nameEl = seatEl.querySelector('.seat-occupant');
        if (nameEl.textContent !== (seat.name || '空席')) {
            nameEl.textContent = seat.name || '空席';
        }
    });
}

function openModal(seat) {
    selectedSeatIdInput.value = seat.id;
    modalTitle.textContent = `Seat ${seat.id}`;

    if (seat.name) {
        // Seat is occupied
        userNameInput.value = seat.name;
        confirmSeatBtn.textContent = '更新する';
        leaveSeatBtn.classList.remove('hidden');
    } else {
        // Seat is empty
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

async function handleSeatSubmit() {
    const name = userNameInput.value.trim();
    const id = selectedSeatIdInput.value;

    if (!name) return;

    try {
        const response = await fetch(`${API_URL}/occupy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, name })
        });

        if (response.ok) {
            closeModal();
            fetchSeats(); // Immediate refresh
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
        const response = await fetch(`${API_URL}/leave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id })
        });

        if (response.ok) {
            closeModal();
            fetchSeats(); // Immediate refresh
        }
    } catch (error) {
        console.error('Error leaving seat:', error);
    }
}

// Start
init();
