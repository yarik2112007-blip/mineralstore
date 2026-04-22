let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentCategory = 'all';
let currentPage = 0;
let isLoading = false;
let hasMore = true;
const PAGE_SIZE = 20;
// Основные функции для работы с товарами и корзиной
const ALL_CATEGORIES = [
    { id: 'all', name: 'Все' },
    { id: 'Кристаллы', name: 'Кристаллы' },
    { id: 'Минералы', name: 'Минералы' },
    { id: 'Органика', name: 'Органика' }
];

const categoryCache = new Map();
let searchTimeout = null;
let allProductsCache = [];

function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) cartCount.textContent = cart.length;
}

async function loadAllProductsForSearch() {
    if (allProductsCache.length > 0) return allProductsCache;
    try {
        const { data, error } = await supabaseClient.from('products').select('*').order('name');
        if (error) throw error;
        allProductsCache = data || [];
        return allProductsCache;
    } catch (error) {
        console.error('Error loading products for search:', error);
        return [];
    }
}

async function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const panel = document.getElementById('productsPanel');
    if (!searchTerm || searchTerm.trim().length === 0) {
        const panel = document.getElementById('productsPanel');
        panel.innerHTML = '<div class="loading">Введите текст для поиска</div>';
        return;
    }
    panel.innerHTML = '<div class="loading">Поиск...</div>';
    const allProducts = await loadAllProductsForSearch();
    const filtered = allProducts.filter(product => {
        const nameMatch = product.name && product.name.toLowerCase().includes(searchTerm);
        const descMatch = product.description && product.description.toLowerCase().includes(searchTerm);
        const catMatch = product.category && product.category.toLowerCase().includes(searchTerm);
        return nameMatch || descMatch || catMatch;
    });
    if (filtered.length === 0) {
        panel.innerHTML = '<div class="loading">Ничего не найдено</div>';
        return;
    }
    displayProducts(filtered);
}

function searchProductsDebounced() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { searchProducts(); }, 300);
}

async function loadProducts(category = 'all', reset = true) {
    const panel = document.getElementById('productsPanel');
    if (!panel || isLoading) return;
    
    if (reset) {
        currentPage = 0;
        hasMore = true;
        panel.innerHTML = '<div class="loading">Загрузка...</div>';
    }
    
    if (!hasMore) return;
    
    isLoading = true;
    currentCategory = category;
    
    try {
        let query = supabaseClient.from('products').select('*');
        
        if (category !== 'all') {
            query = query.eq('category', category);
        }
        
        const { data, error } = await query.order('name');
        
        if (error) throw error;
        
        // Если данных нет
        if (!data || data.length === 0) {
            panel.innerHTML = '<div class="loading">Нет товаров</div>';
            hasMore = false;
            isLoading = false;
            return;
        }
        
        // Постраничная обрезка (временное решение)
        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = data.slice(start, end);
        
        if (reset) {
            displayProducts(pageData);
        } else {
            appendProducts(pageData);
        }
        
        // Проверяем, есть ли ещё товары
        if (end >= data.length) {
            hasMore = false;
        }
        
        currentPage++;
        
    } catch (error) {
        console.error('Error loading products:', error);
        panel.innerHTML = `<div class="loading" style="color: red;">Ошибка загрузки: ${error.message}<br><button onclick="loadProducts('${category}', true)" class="auth" style="position: static; margin-top: 20px; width: auto;">Попробовать снова</button></div>`;
    } finally {
        isLoading = false;
    }
}

function appendProducts(products) {
    const panel = document.getElementById('productsPanel');
    products.forEach(product => {
        panel.innerHTML += createProductCard(product);
    });
}

function createProductCard(product) {
    const firstLetter = product.name ? product.name.charAt(0) : '?';
    let imageHtml;
    if (product.image_url && product.image_url.trim() !== '') {
        imageHtml = `<img src="${product.image_url}" class="product-image" alt="${product.name}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML = '<div class=\\'image-placeholder\\'>${firstLetter}</div>';">`;
    } else {
        imageHtml = `<div class="image-placeholder">${firstLetter}</div>`;
    }
    return `
    <div class="product-card" onclick="location.href='product.html?id=${product.id}'" style="cursor: pointer;">
        <div class="product-image-container">${imageHtml}</div>
        <div class="product-name">${product.name || 'Без названия'}</div>
        <div class="product-description">${product.description || 'Нет описания'}</div>
        <div class="product-price">${product.price || 0} ₽</div>
        <div class="product-stock">В наличии: ${product.stock || 0} шт.</div>
        <button class="add-to-cart" onclick="event.stopPropagation(); addToCart(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${product.price})" ${product.stock === 0 ? 'disabled' : ''}>${product.stock === 0 ? 'Нет в наличии' : 'В корзину'}</button>
    </div>`;
}

function displayProducts(products) {
    const panel = document.getElementById('productsPanel');
    panel.innerHTML = products.map(p => createProductCard(p)).join('');
}

function setupInfiniteScroll() {
    const panel = document.getElementById('productsPanel');
    if (!panel) return;
    panel.addEventListener('scroll', () => {
        if (isLoading || !hasMore) return;
        if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 100) {
            loadProducts(currentCategory, false);
        }
    });
}

function displayCategories() {
    const menu = document.getElementById('categoriesMenu');
    if (!menu) return;
    menu.innerHTML = ALL_CATEGORIES.map(cat => `<button class="category-btn ${cat.id === currentCategory ? 'active' : ''}" onclick="filterByCategory('${cat.id}')">${cat.name}</button>`).join('');
}

function filterByCategory(category) {
    if (category === currentCategory) return;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    currentCategory = category;
    loadProducts(category, true);
    updateActiveCategory(category);
}

function updateActiveCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.trim() === (category === 'all' ? 'Все' : category)) {
            btn.classList.add('active');
        }
    });
}

function addToCart(id, name, price) {
    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        cart.push({ id, name, price, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showMessagePopup(`${name} добавлен в корзину`, 'success');
}

function closeCartWindow() {
    const overlay = document.querySelector('.cart-overlay');
    if (overlay) overlay.remove();
}

function updateCartItem(index, change) {
    if (cart[index]) {
        cart[index].quantity = (cart[index].quantity || 1) + change;
        if (cart[index].quantity <= 0) cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        closeCartWindow();
        showCart();
    }
}

function removeCartItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    closeCartWindow();
    showCart();
}

function showCart() {
    const overlay = document.createElement('div');
    overlay.className = 'cart-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeCartWindow(); };
    const modal = document.createElement('div');
    modal.className = 'cart-modal';
    const title = document.createElement('h2');
    title.className = 'cart-title';
    title.textContent = 'Корзина';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cart-close';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = closeCartWindow;
    const content = document.createElement('div');
    content.className = 'cart-items';
    if (cart.length === 0) {
        content.innerHTML = `<div class="cart-empty-graphic"><div class="cart-empty-icon">🛒</div><p>Корзина пуста</p><p class="cart-empty-hint">Добавьте товары из каталога</p><button class="cart-continue-btn" onclick="closeCartWindow()">Продолжить покупки</button></div>`;
    } else {
        let total = 0;
        let itemsHtml = '';
        cart.forEach((item, index) => {
            const sum = item.price * item.quantity;
            total += sum;
            itemsHtml += `<div class="cart-item"><div class="cart-item-info"><span class="cart-item-name">${escapeHtml(item.name)}</span><span class="cart-item-price">${item.price} ₽</span></div><div class="cart-item-controls"><button class="cart-qty-btn" onclick="updateCartItem(${index}, -1)">−</button><span class="cart-item-qty">${item.quantity}</span><button class="cart-qty-btn" onclick="updateCartItem(${index}, 1)">+</button><button class="cart-remove-btn" onclick="removeCartItem(${index})">🗑️</button></div></div>`;
        });
        content.innerHTML = itemsHtml;
        const totalDiv = document.createElement('div');
        totalDiv.className = 'cart-total';
        totalDiv.innerHTML = `<span>Итого:</span> <span>${total} ₽</span>`;
        content.appendChild(totalDiv);
        const checkoutBtn = document.createElement('button');
        checkoutBtn.className = 'cart-checkout';
        checkoutBtn.textContent = 'Оформить заказ';
        checkoutBtn.onclick = () => { closeCartWindow(); showCheckoutModal(); };
        content.appendChild(checkoutBtn);
    }
    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

function showCheckoutModal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const overlay = document.createElement('div');
    overlay.className = 'checkout-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeCheckoutModal(); };
    const modal = document.createElement('div');
    modal.className = 'checkout-modal';
    modal.innerHTML = `<button class="checkout-close" onclick="closeCheckoutModal()">✕</button><h2 class="checkout-title">Оформление заказа</h2><div class="delivery-option" data-method="call_me"><div class="delivery-option-title">Позвоните мне</div><div class="delivery-option-desc">Мы свяжемся с вами для подтверждения заказа</div><input type="tel" class="phone-input" id="phoneInputCallMe" placeholder="+7 (___) ___-__-__" style="display: none;"></div><div class="delivery-option" data-method="call_myself"><div class="delivery-option-title">Я позвоню сам</div><div class="delivery-option-desc">Вы свяжетесь с нами по номеру: +7 (987) 361-49-43</div><input type="tel" class="phone-input" id="phoneInputCallMyself" placeholder="Ваш номер (необязательно)" style="display: none;"></div><div class="order-summary"><div class="order-summary-title">Ваш заказ</div><div class="order-summary-items" id="orderSummaryItems"></div><div class="order-summary-total"><span>Итого:</span><span>${total} ₽</span></div></div><div class="checkout-buttons"><button class="checkout-btn checkout-cancel" onclick="closeCheckoutModal()">Отмена</button><button class="checkout-btn checkout-confirm" onclick="submitOrder()">Подтвердить заказ</button></div>`;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const itemsContainer = document.getElementById('orderSummaryItems');
    itemsContainer.innerHTML = cart.map(item => `<div class="order-summary-item"><span>${escapeHtml(item.name)} x${item.quantity}</span><span>${item.price * item.quantity} ₽</span></div>`).join('');
    const options = document.querySelectorAll('.delivery-option');
    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            if (e.target.classList.contains('phone-input')) return;
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            document.querySelectorAll('.phone-input').forEach(input => { input.style.display = 'none'; });
            const method = opt.dataset.method;
            const phoneInput = document.getElementById(`phoneInput${method === 'call_me' ? 'CallMe' : 'CallMyself'}`);
            if (phoneInput) phoneInput.style.display = 'block';
        });
    });
    const defaultOption = document.querySelector('[data-method="call_me"]');
    if (defaultOption) defaultOption.click();
}

function closeCheckoutModal() {
    const overlay = document.querySelector('.checkout-overlay');
    if (overlay) overlay.remove();
}

async function submitOrder() {
    const selectedOption = document.querySelector('.delivery-option.selected');
    if (!selectedOption) {
        showMessagePopup('Выберите способ связи', 'error');
        return;
    }
    const deliveryMethod = selectedOption.dataset.method;
    let userPhone = '';
    if (deliveryMethod === 'call_me') {
        userPhone = document.getElementById('phoneInputCallMe').value.trim();
        if (!userPhone) {
            showMessagePopup('Введите номер телефона для связи', 'error');
            return;
        }
    } else {
        userPhone = document.getElementById('phoneInputCallMyself').value.trim() || 'Не указан';
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const items = cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity }));
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showMessagePopup('Необходимо авторизоваться', 'error');
            window.location.href = 'vhod.html';
            return;
        }
        const { error } = await supabaseClient.from('orders').insert([{ user_id: user.id, user_email: user.email, user_phone: userPhone, delivery_method: deliveryMethod, total_amount: total, items: items, status: 'pending' }]);
        if (error) throw error;
        cart = [];
        localStorage.removeItem('cart');
        updateCartCount();
        closeCheckoutModal();
        showMessagePopup('Заказ оформлен!', 'success');
    } catch (error) {
        console.error('Error submitting order:', error);
        showMessagePopup('Ошибка при оформлении заказа: ' + error.message, 'error');
    }
}

function showMessagePopup(message, type) {
    const oldPopup = document.querySelector('.message-popup');
    if (oldPopup) oldPopup.remove();
    const popup = document.createElement('div');
    popup.className = `message-popup ${type}`;
    popup.textContent = message;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => { if (popup.parentNode) popup.remove(); }, 300);
    }, 2000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

updateCartCount();
displayCategories();
loadProducts('all', true);
setupInfiniteScroll();