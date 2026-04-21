let currentTicketId = null;
let messageCheckInterval = null;
let currentReplyTicketId = null;
let tickets = [];

function showMessagePopup(message, type = 'info') {
    const oldPopup = document.querySelector('.message-popup');
    if (oldPopup) oldPopup.remove();
    const popup = document.createElement('div');
    popup.className = `message-popup ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => {
            if (popup.parentNode) popup.remove();
        }, 300);
    }, 3000);
}

function toggleChat() {
    const chat = document.getElementById('chatWindow');
    if (chat.style.display === 'none') {
        chat.style.display = 'flex';
        loadChatHistory();
        if (messageCheckInterval) clearInterval(messageCheckInterval);
        messageCheckInterval = setInterval(checkNewMessages, 5000);
    } else {
        closeChat();
    }
}

function closeChat() {
    document.getElementById('chatWindow').style.display = 'none';
    if (messageCheckInterval) {
        clearInterval(messageCheckInterval);
        messageCheckInterval = null;
    }
}

async function getOrCreateTicket() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabaseClient.from('support_tickets').select('id').eq('user_id', user.id).eq('status', 'open').order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    if (data && data.length > 0) return data[0].id;
    const { data: newTicket, error: createError } = await supabaseClient.from('support_tickets').insert([{ user_id: user.id, user_email: user.email, status: 'open' }]).select().single();
    if (createError) throw createError;
    return newTicket.id;
}

async function loadChatHistory() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        const ticketId = await getOrCreateTicket();
        currentTicketId = ticketId;
        if (!ticketId) return;
        const { data, error } = await supabaseClient.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
        if (error) throw error;
        displayMessages(data || []);
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

function displayMessages(messages) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) return;
    
    if (!messages || messages.length === 0) {
        messagesDiv.innerHTML = `<div class="message system">Здравствуйте! Чем мы можем вам помочь?<div class="message-time">${new Date().toLocaleTimeString()}</div></div>`;
        return;
    }
    
    let html = '';
    messages.forEach(msg => {
        // Проверяем, что message существует
        const messageText = msg.message || 'Сообщение отсутствует';
        
        if (msg.sender_role === 'user') {
            html += `<div class="message user">${escapeHtml(messageText)}<div class="message-time">${new Date(msg.created_at).toLocaleString()}</div></div>`;
        } else {
            html += `<div class="message admin">${escapeHtml(messageText)}<div class="message-time">${new Date(msg.created_at).toLocaleString()}</div></div>`;
        }
    });
    
    messagesDiv.innerHTML = html;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) {
        showMessagePopup('Введите сообщение', 'error');
        return;
    }
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showMessagePopup('Необходимо авторизоваться', 'error');
            return;
        }
        
        const ticketId = await getOrCreateTicket();
        if (!ticketId) throw new Error('Не удалось создать тикет');
        
        // Проверяем, что message передаётся правильно
        console.log('Отправка сообщения:', message);
        
        const { error } = await supabaseClient
            .from('support_messages')
            .insert([{
                ticket_id: ticketId,
                sender_role: 'user',
                message: message  // Убедись, что поле называется message
            }]);
            
        if (error) throw error;
        
        input.value = '';
        await loadChatHistory();
        showMessagePopup('Сообщение отправлено', 'success');
        
    } catch (error) {
        console.error('Error sending message:', error);
        showMessagePopup('Ошибка при отправке: ' + error.message, 'error');
    }
}

async function checkNewMessages() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;
        const ticketId = await getOrCreateTicket();
        if (!ticketId) return;
        const { data, error } = await supabaseClient.from('support_messages').select('*').eq('ticket_id', ticketId).eq('sender_role', 'admin').order('created_at', { ascending: false }).limit(1);
        if (error) throw error;
        if (data && data.length > 0) {
            const lastMessageTime = localStorage.getItem('lastMessageTime');
            const msgTime = new Date(data[0].created_at).getTime();
            if (!lastMessageTime || msgTime > parseInt(lastMessageTime)) {
                showMessagePopup('Новый ответ от поддержки!', 'info');
                if (document.getElementById('chatWindow').style.display !== 'none') {
                    await loadChatHistory();
                } else {
                    document.getElementById('supportBtn').classList.add('has-response');
                }
                localStorage.setItem('lastMessageTime', msgTime.toString());
            }
        }
    } catch (error) {
        console.error('Error checking messages:', error);
    }
}

function toggleAdminChat() {
    let chat = document.getElementById('adminChatWindow');
    if (!chat) {
        createAdminChatWindow();
    } else {
        chat.remove();
        if (currentReplyTicketId) closeReplyWindow();
    }
}

function closeAdminChat() {
    const chat = document.getElementById('adminChatWindow');
    if (chat) chat.remove();
    if (window.ticketsInterval) clearInterval(window.ticketsInterval);
    if (currentReplyTicketId) closeReplyWindow();
}

function createAdminChatWindow() {
    const existing = document.getElementById('adminChatWindow');
    if (existing) existing.remove();
    const chat = document.createElement('div');
    chat.className = 'admin-chat-window';
    chat.id = 'adminChatWindow';
    chat.innerHTML = `<div class="admin-chat-header"><span>Обращения пользователей</span><button onclick="closeAdminChat()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button></div><div class="tickets-list" id="ticketsList"><div style="text-align: center; padding: 20px;">Загрузка...</div></div>`;
    document.body.appendChild(chat);
    loadAllTickets();
    if (window.ticketsInterval) clearInterval(window.ticketsInterval);
    window.ticketsInterval = setInterval(loadAllTickets, 5000);
}

async function loadAllTickets() {
    const list = document.getElementById('ticketsList');
    if (!list) return;
    list.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка...</div>';
    try {
        const { data, error } = await supabaseClient.from('support_tickets').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        tickets = data || [];
        displayTicketsList();
    } catch (error) {
        console.error('Error loading tickets:', error);
        list.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">Ошибка загрузки</div>';
    }
}

function displayTicketsList() {
    const list = document.getElementById('ticketsList');
    if (!list) return;
    if (tickets.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 20px;">Нет обращений</div>';
        return;
    }
    list.innerHTML = tickets.map(ticket => {
        const hasResponse = ticket.admin_response && ticket.admin_response.trim() !== '';
        const isUnread = !hasResponse && ticket.status === 'open';
        return `<div class="ticket-item ${isUnread ? 'unread' : ''}" onclick="openReplyWindow(${ticket.id})"><div class="ticket-user">${ticket.user_email || 'Пользователь'}</div><div class="ticket-message">${ticket.message ? ticket.message.substring(0, 50) : ''}${ticket.message && ticket.message.length > 50 ? '...' : ''}</div><div class="ticket-time">${new Date(ticket.created_at).toLocaleString()}</div>${hasResponse ? '<div style="color: green; font-size: 11px;">Есть ответ</div>' : ''}</div>`;
    }).join('');
}

async function openReplyWindow(ticketId) {
    currentReplyTicketId = ticketId;
    
    try {
        // Получаем тикет
        const { data: ticket, error: ticketError } = await supabaseClient
            .from('support_tickets')
            .select('*')
            .eq('id', ticketId)
            .single();
            
        if (ticketError) throw ticketError;
        
        // Получаем все сообщения этого тикета
        const { data: messages, error: messagesError } = await supabaseClient
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });
            
        if (messagesError) throw messagesError;
        
        let replyWin = document.getElementById('replyWindow');
        if (replyWin) replyWin.remove();
        
        replyWin = document.createElement('div');
        replyWin.className = 'reply-window';
        replyWin.id = 'replyWindow';
        
        // Формируем HTML сообщений
        let messagesHtml = '';
        if (messages && messages.length > 0) {
            messages.forEach(msg => {
                const msgText = msg.message || 'Сообщение отсутствует';
                if (msg.sender_role === 'user') {
                    messagesHtml += `
                        <div class="message user">
                            <strong>Пользователь:</strong><br>
                            ${escapeHtml(msgText)}
                            <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
                        </div>
                    `;
                } else {
                    messagesHtml += `
                        <div class="message admin">
                            <strong>Администратор:</strong><br>
                            ${escapeHtml(msgText)}
                            <div class="message-time">${new Date(msg.created_at).toLocaleString()}</div>
                        </div>
                    `;
                }
            });
        } else {
            messagesHtml = `
                <div class="message user">
                    <strong>Пользователь:</strong><br>
                    Сообщений пока нет
                    <div class="message-time">${new Date().toLocaleString()}</div>
                </div>
            `;
        }
        
        replyWin.innerHTML = `
            <div class="reply-header">
                <span>Чат с пользователем</span>
                <button onclick="closeReplyWindow()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">×</button>
            </div>
            <div class="reply-messages" id="replyMessages">
                ${messagesHtml}
            </div>
            <div class="reply-input-area">
                <input type="text" class="reply-input" id="replyInput" placeholder="Введите ответ..." onkeypress="if(event.key==='Enter') sendAdminReply()">
                <button class="reply-send" onclick="sendAdminReply()">➤</button>
            </div>
        `;
        
        document.body.appendChild(replyWin);
        
        const messagesDiv = document.getElementById('replyMessages');
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
    } catch (error) {
        console.error('Error opening reply window:', error);
        showMessagePopup('Ошибка загрузки чата', 'error');
    }
}

function closeReplyWindow() {
    const win = document.getElementById('replyWindow');
    if (win) win.remove();
    currentReplyTicketId = null;
}

async function sendAdminReply() {
    const input = document.getElementById('replyInput');
    const response = input.value.trim();
    
    if (!response) {
        showMessagePopup('Введите ответ', 'error');
        return;
    }
    
    if (!currentReplyTicketId) return;
    
    try {
        console.log('Отправка ответа:', response);
        
        const { error } = await supabaseClient
            .from('support_messages')
            .insert([{
                ticket_id: currentReplyTicketId,
                sender_role: 'admin',
                message: response
            }]);
            
        if (error) throw error;
        
        // Обновляем время обновления тикета
        await supabaseClient
            .from('support_tickets')
            .update({ updated_at: new Date() })
            .eq('id', currentReplyTicketId);
        
        input.value = '';
        closeReplyWindow();
        await loadAllTickets();
        showMessagePopup('Ответ отправлен пользователю', 'success');
        
    } catch (error) {
        console.error('Error sending reply:', error);
        showMessagePopup('Ошибка при отправке: ' + error.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    localStorage.setItem('lastMessageTime', Date.now().toString());
});