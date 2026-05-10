const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error("CRITICAL: Supabase environment variables are missing!");
}

const supabase = createClient(
    process.env.SUPABASE_URL || '', 
    process.env.SUPABASE_KEY || ''
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const authMiddleware = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    if (password === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        const { data: menuItems } = await supabase
            .from('menu_items')
            .select('name, price, category, description, is_special') || [];

        const specials = menuItems?.filter(i => i.is_special) || [];
        const regular = menuItems?.filter(i => !i.is_special) || [];

        const menuDescription = menuItems && menuItems.length > 0 
            ? `SPECIALS: ${specials.map(i => i.name + ' ($' + i.price + ')').join(', ') || 'None'}. REGULAR: ${regular.map(i => i.name + ' ($' + i.price + ')').join(', ') || 'None'}.`
            : "Salad ($18), Soup ($14), Salmon ($32), Ribeye ($45)";

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: `You are the professional digital waiter at 'The Gilded Fork'. 
                    For RESERVATIONS: Collect Name, Date, Guests (number), Time (5PM-11PM), and Contact. Ask ONE BY ONE. 
                    For ORDERS: Collect Name, Contact, Address, and Items. Ask ONE BY ONE. 
                    
                    MENU: ${menuDescription}.
                    
                    CRITICAL RULES:
                    1. Only output a data tag ([RESERVATION:...] or [ORDER:...]) AFTER you have collected ALL information. You MUST include a polite confirmation message to the guest in the same response.
                    2. Do NOT use placeholders like "..." or "not provided" in tags.
                    3. Keep dialogue brief (1-2 sentences).
                    
                    Tag Formats:
                    [RESERVATION: {"customer_name": "Name", "reservation_date": "Date", "guest_count": 4, "reservation_time": "7PM", "contact_number": "555-0123"}]
                    [ORDER: {"customer_name": "Name", "contact_number": "555-0123", "delivery_address": "Address", "items": "Salmon, Salad", "total_amount": 50.00}]` },
                    ...messages
                ],
                temperature: 0.5
            })
        });

        let data = await response.json();
        if (!data.choices || !data.choices[0]) throw new Error("Invalid response from AI API");

        let content = data.choices[0].message.content;
        const reservationMatch = content.match(/\[RESERVATION: ([\s\S]*?)\]/);
        const orderMatch = content.match(/\[ORDER: ([\s\S]*?)\]/);
        
        if (reservationMatch) {
            let cleanContent = content.replace(/\[RESERVATION: [\s\S]*?\]/, '').trim();
            if (!cleanContent) cleanContent = "Excellent! I have successfully booked your table. We look forward to seeing you!";
            data.choices[0].message.content = cleanContent;
            try {
                const reservationData = JSON.parse(reservationMatch[1]);
                reservationData.guest_count = parseInt(reservationData.guest_count);
                if (!isNaN(reservationData.guest_count)) {
                    await supabase.from('reservations').insert([reservationData]);
                }
            } catch (e) { console.error('Reservation Error:', e); }
        }

        if (orderMatch) {
            let cleanContent = content.replace(/\[ORDER: [\s\S]*?\]/, '').trim();
            if (!cleanContent) cleanContent = "Thank you! Your order has been placed successfully.";
            data.choices[0].message.content = cleanContent;
            try {
                const orderData = JSON.parse(orderMatch[1]);
                orderData.total_amount = parseFloat(orderData.total_amount);
                if (!isNaN(orderData.total_amount)) {
                    await supabase.from('orders').insert([orderData]);
                }
            } catch (e) { console.error('Order Error:', e); }
        }

        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch response from AI' });
    }
});

app.get('/api/menu', async (req, res) => {
    const { data, error } = await supabase.from('menu_items').select('*').order('category', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/menu', authMiddleware, async (req, res) => {
    const { error } = await supabase.from('menu_items').insert([req.body]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Item added successfully' });
});

app.put('/api/menu/:id', authMiddleware, async (req, res) => {
    const { error } = await supabase.from('menu_items').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Item updated successfully' });
});

app.delete('/api/menu/:id', authMiddleware, async (req, res) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Item deleted successfully' });
});

app.get('/api/reservations', authMiddleware, async (req, res) => {
    const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/reservations/:id', authMiddleware, async (req, res) => {
    const { error } = await supabase.from('reservations').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Reservation deleted successfully' });
});

app.get('/api/orders', authMiddleware, async (req, res) => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
    const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Order deleted successfully' });
});

module.exports = app;