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
const ROADMAP_FILE = path.join(DATA_DIR, 'roadmap.json');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');

// Ensure roadmap file exists
if (!fs.existsSync(ROADMAP_FILE)) {
    saveJSON(ROADMAP_FILE, { items: [] });
} 
if (!fs.existsSync(FEEDBACK_FILE)) {
    saveJSON(FEEDBACK_FILE, { items: [] });
}

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

// Data Models
let layoutData = loadJSON(LAYOUT_FILE, { seats: [] });
let layoutVersion = fs.existsSync(LAYOUT_FILE) ? fs.statSync(LAYOUT_FILE).mtimeMs : Date.now();

let occupancyData = loadJSON(OCCUPANCY_FILE, {});
let occupancyVersion = fs.existsSync(OCCUPANCY_FILE) ? fs.statSync(OCCUPANCY_FILE).mtimeMs : Date.now();


// --- API Routes ---

// 1. Get Layout (Includes seat definitions)
app.get('/api/layout', (req, res) => {
    res.json({ data: layoutData, version: layoutVersion });
});

// 2. Update Layout (Admin: Save seats)
app.post('/api/layout', (req, res) => {
    const { seats } = req.body;
    if (!Array.isArray(seats)) {
        return res.status(400).json({ error: 'Invalid format' });
    }

    // Update layout data
    layoutData.seats = seats;
    layoutVersion = Date.now();
    saveJSON(LAYOUT_FILE, layoutData);

    res.json({ success: true, count: seats.length, version: layoutVersion });
});

// 3. Get Occupancy
app.get('/api/occupancy', (req, res) => {
    res.json({ data: occupancyData, version: occupancyVersion });
});

// 4. Update Occupancy (Sit down)
app.post('/api/occupancy', (req, res) => {
    const { seatId, name, colorIndex } = req.body;

    if (!seatId || !name) {
        return res.status(400).json({ error: 'seatId and name required' });
    }

    occupancyData[seatId] = {
        name: name,
        colorIndex: colorIndex !== undefined ? colorIndex : 0,
        timestamp: new Date().toISOString()
    };
    occupancyVersion = Date.now();
    saveJSON(OCCUPANCY_FILE, occupancyData);

    res.json({ success: true, version: occupancyVersion });
});

// 5. Clear Occupancy (Leave)
app.post('/api/occupancy/leave', (req, res) => {
    const { seatId } = req.body;

    if (occupancyData[seatId]) {
        delete occupancyData[seatId];
        occupancyVersion = Date.now();
        saveJSON(OCCUPANCY_FILE, occupancyData);
    }

    res.json({ success: true, version: occupancyVersion });
});

// 6. Clear All Occupancy (Reset all)
app.post('/api/occupancy/clear-all', (req, res) => {
    occupancyData = {};
    occupancyVersion = Date.now();
    saveJSON(OCCUPANCY_FILE, occupancyData);

    res.json({ success: true, message: 'All occupancy data cleared', version: occupancyVersion });
});

// --- Roadmap Endpoints ---
// Get roadmap (lazy loaded)
app.get('/api/roadmap', (req, res) => {
    const roadmap = loadJSON(ROADMAP_FILE, { items: [] });
    res.json({ data: roadmap, version: fs.existsSync(ROADMAP_FILE) ? fs.statSync(ROADMAP_FILE).mtimeMs : Date.now() });
});

// Update roadmap (admin) - expects { roadmap: { items: [...] } }
app.post('/api/roadmap', (req, res) => {
    const { roadmap } = req.body;
    if (!roadmap || !Array.isArray(roadmap.items)) {
        return res.status(400).json({ error: 'Invalid roadmap format' });
    }
    saveJSON(ROADMAP_FILE, roadmap);
    res.json({ success: true, version: fs.statSync(ROADMAP_FILE).mtimeMs });
});

// --- Feedback Endpoints ---
function loadFeedback() {
    return loadJSON(FEEDBACK_FILE, { items: [] });
}

function saveFeedback(data) {
    saveJSON(FEEDBACK_FILE, data);
    return fs.statSync(FEEDBACK_FILE).mtimeMs;
}

function createFeedbackId() {
    return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

app.get('/api/feedback', (req, res) => {
    const feedback = loadFeedback();
    res.json({ data: feedback, version: fs.existsSync(FEEDBACK_FILE) ? fs.statSync(FEEDBACK_FILE).mtimeMs : Date.now() });
});

app.post('/api/feedback', (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid feedback text' });
    }
    const feedback = loadFeedback();
    const item = {
        id: createFeedbackId(),
        text: text.trim(),
        score: 0,
        adminComment: '',
        createdAt: new Date().toISOString()
    };
    if (!item.text) {
        return res.status(400).json({ error: 'Empty feedback text' });
    }
    feedback.items.unshift(item);
    const version = saveFeedback(feedback);
    res.json({ success: true, item, version });
});

app.post('/api/feedback/vote', (req, res) => {
    const { id, delta } = req.body;
    if (!id || ![-2, -1, 1, 2].includes(delta)) {
        return res.status(400).json({ error: 'Invalid vote payload' });
    }
    const feedback = loadFeedback();
    const idx = feedback.items.findIndex((item) => item.id === id);
    if (idx === -1) {
        return res.status(404).json({ error: 'Feedback not found' });
    }
    feedback.items[idx].score = (feedback.items[idx].score || 0) + delta;
    if (feedback.items[idx].score <= -5) {
        feedback.items.splice(idx, 1);
    }
    const version = saveFeedback(feedback);
    res.json({ success: true, version });
});

app.post('/api/feedback/admin-comment', (req, res) => {
    const { id, comment } = req.body;
    if (!id || typeof comment !== 'string') {
        return res.status(400).json({ error: 'Invalid comment payload' });
    }
    const feedback = loadFeedback();
    const item = feedback.items.find((row) => row.id === id);
    if (!item) {
        return res.status(404).json({ error: 'Feedback not found' });
    }
    item.adminComment = comment.trim();
    const version = saveFeedback(feedback);
    res.json({ success: true, version });
});

app.delete('/api/feedback/:id', (req, res) => {
    const { id } = req.params;
    const feedback = loadFeedback();
    const nextItems = feedback.items.filter((item) => item.id !== id);
    if (nextItems.length === feedback.items.length) {
        return res.status(404).json({ error: 'Feedback not found' });
    }
    feedback.items = nextItems;
    const version = saveFeedback(feedback);
    res.json({ success: true, version });
});

// --- Scheduled Tasks ---

// 毎日朝4時に座席情報をリセット
cron.schedule('0 4 * * *', () => {
    console.log('Daily reset: Clearing all occupancy data at 4:00 AM');
    occupancyData = {};
    occupancyVersion = Date.now();
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
