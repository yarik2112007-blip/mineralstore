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

async function checkAuth() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        if (data?.session?.user) return data.session.user;
        window.location.href = 'index.html';
        return null;
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = 'index.html';
        return null;
    }
}

async function checkIsAdmin() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return false;
        const { data, error } = await supabaseClient.from('profiles').select('is_admin').eq('id', user.id).single();
        if (error) return false;
        return data?.is_admin === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

function goToAdmin() {
    window.location.href = 'admin.html';
}

async function login(email, password) {
    try {
        if (!email || !password) {
            showMessagePopup('Заполните все поля', 'error');
            return false;
        }
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (error) throw error;
        localStorage.setItem('user', JSON.stringify(data.user));
        showMessagePopup('Вход выполнен!', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
        return true;
    } catch (error) {
        console.error('Login error:', error);
        showMessagePopup('Ошибка входа: ' + error.message, 'error');
        return false;
    }
}

async function register(email, password) {
    try {
        if (!email || !password) {
            showMessagePopup('Заполните все поля', 'error');
            return false;
        }
        if (password.length < 6) {
            showMessagePopup('Пароль должен быть минимум 6 символов', 'error');
            return false;
        }
        const { data, error } = await supabaseClient.auth.signUp({ email: email, password: password, options: { emailRedirectTo: window.location.origin + '/dashboard.html' } });
        if (error) throw error;
        showMessagePopup('Регистрация успешна! Проверьте почту для подтверждения.', 'success');
        setTimeout(() => { window.location.href = 'vhod.html'; }, 2000);
        return true;
    } catch (error) {
        console.error('Register error:', error);
        showMessagePopup('Ошибка регистрации: ' + error.message, 'error');
        return false;
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function showError(message) {
    showMessagePopup(message, 'error');
}

function showSuccess(message) {
    showMessagePopup(message, 'success');
}