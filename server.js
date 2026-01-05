const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory data store for seats
// Initialize 200 seats
let seats = Array.from({ length: 200 }, (_, i) => ({
    id: i + 1,
    name: null,
    timestamp: null
}));

// API Routes
app.get('/api/seats', (req, res) => {
    res.json(seats);
});

app.post('/api/seats/occupy', (req, res) => {
    const { id, name } = req.body;

    if (!id || !name) {
        return res.status(400).json({ error: 'ID and Name are required' });
    }

    const seatIndex = seats.findIndex(s => s.id === parseInt(id));
    if (seatIndex === -1) {
        return res.status(404).json({ error: 'Seat not found' });
    }

    // Update seat
    seats[seatIndex].name = name;
    seats[seatIndex].timestamp = new Date();

    // Clear previous seat if user moved? 
    // For simplicity, we just overwrite the new seat. 
    // In a real app we might check if user is already sitting elsewhere.

    // Check if this user is already sitting somewhere else and remove them
    // seats.forEach(s => {
    //     if (s.id !== parseInt(id) && s.name === name) {
    //         s.name = null;
    //         s.timestamp = null;
    //     }
    // });

    res.json({ success: true, seat: seats[seatIndex] });
});

app.post('/api/seats/leave', (req, res) => {
    const { id } = req.body;
    const seatIndex = seats.findIndex(s => s.id === parseInt(id));

    if (seatIndex !== -1) {
        seats[seatIndex].name = null;
        seats[seatIndex].timestamp = null;
    }

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
