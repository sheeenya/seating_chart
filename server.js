const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 8520;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data Files
// Use process.cwd() instead of __dirname to work with packaged exe
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
const LAYOUT_FILE = path.join(DATA_DIR, 'layout.json');
const OCCUPANCY_FILE = path.join(DATA_DIR, 'occupancy.json');

// Helper to load/save JSON
function loadJSON(file, defaultVal) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error(`Error loading ${file}:`, e);
    }
    return defaultVal;
}

function saveJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error saving ${file}:`, e);
    }
}

// --- Data Models ---
// Layout: { seats: [ { id, x, y, width, height, label... } ] }
let layoutData = loadJSON(LAYOUT_FILE, { seats: [] });

// Occupancy: { [seatId]: { name, timestamp } }
let occupancyData = loadJSON(OCCUPANCY_FILE, {});


// --- API Routes ---

// 1. Get Layout (Includes seat definitions)
app.get('/api/layout', (req, res) => {
    res.json(layoutData);
});

// 2. Update Layout (Admin: Save seats)
app.post('/api/layout', (req, res) => {
    const { seats } = req.body;
    if (!Array.isArray(seats)) {
        return res.status(400).json({ error: 'Invalid format' });
    }

    // Update layout data
    layoutData.seats = seats;
    saveJSON(LAYOUT_FILE, layoutData);

    res.json({ success: true, count: seats.length });
});

// 3. Get Occupancy
app.get('/api/occupancy', (req, res) => {
    res.json(occupancyData);
});

// 4. Update Occupancy (Sit down)
app.post('/api/occupancy', (req, res) => {
    const { seatId, name } = req.body;

    if (!seatId || !name) {
        return res.status(400).json({ error: 'seatId and name required' });
    }

    occupancyData[seatId] = {
        name: name,
        timestamp: new Date().toISOString()
    };
    saveJSON(OCCUPANCY_FILE, occupancyData);

    res.json({ success: true });
});

// 5. Clear Occupancy (Leave)
app.post('/api/occupancy/leave', (req, res) => {
    const { seatId } = req.body;

    if (occupancyData[seatId]) {
        delete occupancyData[seatId];
        saveJSON(OCCUPANCY_FILE, occupancyData);
    }

    res.json({ success: true });
});

// 6. Clear All Occupancy (Reset all)
app.post('/api/occupancy/clear-all', (req, res) => {
    occupancyData = {};
    saveJSON(OCCUPANCY_FILE, occupancyData);

    res.json({ success: true, message: 'All occupancy data cleared' });
});

// --- Scheduled Tasks ---

// 毎日朝4時に座席情報をリセット
cron.schedule('0 4 * * *', () => {
    console.log('Daily reset: Clearing all occupancy data at 4:00 AM');
    occupancyData = {};
    saveJSON(OCCUPANCY_FILE, occupancyData);
    console.log('All occupancy data has been cleared');
}, {
    timezone: "Asia/Tokyo"
});

// Legacy/Compatibility endpoints (optional, but keeping for safety if frontend expects them partially)
// NOTE: We will update frontend to use new endpoints.

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Daily occupancy reset scheduled for 4:00 AM JST');
});
