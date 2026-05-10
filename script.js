// Mobile Menu Toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        // Basic toggle logic - can be expanded with CSS classes
        alert('Mobile menu clicked! In a production app, this would slide out the navigation.');
    });
}

// Load Dynamic Menu
async function loadMenu() {
    const res = await fetch('/api/menu');
    const items = await res.json();
    
    const gridContainer = document.querySelector('.menu-grid');
    const listContainer = document.querySelector('.menu-list-container');
    
    if (gridContainer && items.length > 0) {
        // Homepage view: Limit to 4 items
        const displayItems = items.slice(0, 4);
        gridContainer.innerHTML = displayItems.map(item => `
            <div class="menu-item" data-category="${item.category}">
                ${item.is_special ? '<div style="background: var(--primary-color); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.7rem; width: fit-content; margin: 0 auto 10px;">SPECIAL OF THE DAY</div>' : ''}
                <img src="${item.image_url || 'https://via.placeholder.com/300'}" alt="${item.name}">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <span class="price">$${parseFloat(item.price).toFixed(2)}</span>
            </div>
        `).join('');
    }

    if (listContainer && items.length > 0) {
        // Full menu page: List form
        listContainer.innerHTML = items.map(item => `
            <div class="menu-list-item" data-category="${item.category}">
                <div class="menu-list-header">
                    <h3>${item.name} ${item.is_special ? '<span style="font-size: 0.8rem; color: var(--primary-color);">★</span>' : ''}</h3>
                    <span class="price">$${parseFloat(item.price).toFixed(2)}</span>
                </div>
                <p>${item.description}</p>
                <small style="color: #888; text-transform: capitalize;">${item.category}</small>
            </div>
        `).join('');
    }
}

window.addEventListener('DOMContentLoaded', loadMenu);

// Menu Filtering Logic
const filterBtns = document.querySelectorAll('.filter-btn');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active button state
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        const menuItems = document.querySelectorAll('.menu-item, .menu-list-item');

        menuItems.forEach(item => {
            const category = item.getAttribute('data-category');
            if (filter === 'all' || category === filter) {
                item.classList.remove('hide');
            } else {
                item.classList.add('hide');
            }
        });
    });
});

// Form Submission Handling
const contactForm = document.querySelector('.contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your message! We will get back to you shortly.');
        contactForm.reset();
    });
}

// Chatbot Logic with Groq API
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChat = document.getElementById('closeChat');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const chatBody = document.getElementById('chatBody');
const chatSuggestions = document.getElementById('chatSuggestions');
const chatCallout = document.getElementById('chatCallout');

let chatHistory = [];

if (chatToggleBtn && chatWindow) {
    chatToggleBtn.addEventListener('click', () => {
        chatWindow.style.display = chatWindow.style.display === 'flex' ? 'none' : 'flex';
        if (chatCallout) chatCallout.style.display = 'none';
    });
}

if (closeChat) closeChat.addEventListener('click', () => chatWindow.style.display = 'none');

const addMessage = (text, sender) => {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', `${sender}-message`);
    msgDiv.textContent = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msgDiv;
};

const getAIResponse = async (history) => {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messages: history
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        return "I'm having a little trouble connecting. Please try again or call us directly!";
    }
};

const handleUserMessage = async (text) => {
    if (!text) return;
    
    addMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });
    chatInput.value = '';
    
    const loadingMsg = addMessage("One moment, please...", 'bot');
    const response = await getAIResponse(chatHistory);
    
    loadingMsg.textContent = response;
    chatHistory.push({ role: 'assistant', content: response });
    
    chatBody.scrollTop = chatBody.scrollHeight;
};

if (sendChat) {
    sendChat.addEventListener('click', () => {
        handleUserMessage(chatInput.value.trim());
    });
}

if (chatSuggestions) {
    chatSuggestions.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion-btn')) {
        handleUserMessage(e.target.textContent);
    }
    });
}

if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat.click(); });
