const API = 'http://127.0.0.1:8000';
let conversationHistory = [];
let allProducts = [];
let allOrders = [];

// Navigation
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = {
    dashboard: 'Dashboard', products: 'Product Catalog',
    orders: 'Order Management', chatbot: 'AI Support Chat', analytics: 'Sales Analytics'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  if (page === 'dashboard') loadDashboard();
  else if (page === 'products') loadProducts();
  else if (page === 'orders') loadOrders();
  else if (page === 'analytics') loadAnalytics();
}

// Clock
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Toast Notifications
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="font-size:16px">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; el.style.transition = '0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// API Helper
async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(API + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Request failed');
    return data;
  } catch (e) {
    toast(e.message, 'error');
    throw e;
  }
}

// Dashboard
async function loadDashboard() {
  try {
    const [products, orders, summary] = await Promise.all([
      api('GET', '/products/'),
      api('GET', '/orders/'),
      api('GET', '/orders/analytics/summary')
    ]);
    allProducts = products;
    allOrders = orders;

    // Animate stats
    animateNumber('stat-revenue', summary.total_revenue, '$');
    animateNumber('stat-orders', summary.total_orders);
    animateNumber('stat-products', products.length);
    const lowStock = products.filter(p => p.stock <= 10).length;
    animateNumber('stat-low-stock', lowStock);

    // Recent orders table
    renderRecentOrders(orders.slice(0, 5));

    // Top products
    const sorted = [...products].sort((a, b) => b.price - a.price).slice(0, 5);
    renderTopProducts(sorted);

    // Revenue chart
    renderRevenueChart(orders);

    // Status donut
    renderStatusChart(summary.orders_by_status);

  } catch (e) { console.error(e); }
}

function animateNumber(id, target, prefix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const isDecimal = target % 1 !== 0;
  let start = 0, duration = 1000, startTime = null;
  function step(ts) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * ease;
    el.textContent = prefix + (isDecimal ? current.toFixed(2) : Math.floor(current).toLocaleString());
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recent-orders');
  if (!tbody) return;
  if (!orders.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No orders yet</div></div></td></tr>`; return; }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span style="font-family:var(--font-mono);color:var(--accent-cyan)">#${o.id}</span></td>
      <td class="td-name">${o.customer_name}</td>
      <td>${o.product_name || 'N/A'}</td>
      <td><span style="color:var(--accent-green);font-family:var(--font-mono)">$${o.total_price.toFixed(2)}</span></td>
      <td><span class="badge badge-${o.status}">${o.status}</span></td>
    </tr>`).join('');
}

function renderTopProducts(products) {
  const el = document.getElementById('top-products');
  if (!el) return;
  el.innerHTML = products.map((p, i) => `
    <div class="product-rank-item">
      <span class="rank-number">${i + 1}</span>
      <div style="flex:1">
        <div class="rank-name">${p.name}</div>
        <div class="rank-category">${p.category || 'General'} · Stock: ${p.stock}</div>
      </div>
      <span class="rank-price">$${p.price.toFixed(2)}</span>
    </div>`).join('');
}

let revenueChartInstance = null;
function renderRevenueChart(orders) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  if (revenueChartInstance) revenueChartInstance.destroy();

  // Group by day (last 7 days)
  const days = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0;
  }
  orders.forEach(o => {
    if (!o.created_at) return;
    const d = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (d in days) days[d] += o.total_price;
  });

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(days),
      datasets: [{
        label: 'Revenue',
        data: Object.values(days),
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0,229,255,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#00e5ff',
        pointRadius: 4,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: 'rgba(0,229,255,0.3)', borderWidth: 1, titleColor: '#f0f4ff', bodyColor: '#8892a4', padding: 12 } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 11 }, callback: v => '$' + v } }
      }
    }
  });
}

let statusChartInstance = null;
function renderStatusChart(statusData) {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  if (statusChartInstance) statusChartInstance.destroy();
  const labels = Object.keys(statusData);
  const data = Object.values(statusData);
  const colors = { pending: '#ff6b35', processing: '#00e5ff', shipped: '#7c3aed', delivered: '#00ffa3', cancelled: '#f72585' };
  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: labels.map(l => colors[l] || '#888'), borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8892a4', padding: 14, font: { family: 'DM Mono', size: 11 }, boxWidth: 10, usePointStyle: true } },
        tooltip: { backgroundColor: '#111827', titleColor: '#f0f4ff', bodyColor: '#8892a4', padding: 12 }
      }
    }
  });
}

// Products
async function loadProducts() {
  try {
    const products = await api('GET', '/products/');
    allProducts = products;
    renderProductsTable(products);
  } catch (e) { console.error(e); }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No products yet</div><div class="empty-text">Add your first product to get started</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><span style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">#${p.id}</span></td>
      <td class="td-name">${p.name}</td>
      <td><span style="font-family:var(--font-mono);color:var(--text-muted);font-size:12px">${p.sku}</span></td>
      <td>${p.category || '—'}</td>
      <td><span style="color:var(--accent-green);font-family:var(--font-mono);font-weight:600">$${p.price.toFixed(2)}</span></td>
      <td>
        <span class="badge ${p.stock <= 10 ? 'badge-low' : 'badge-ok'}">${p.stock} ${p.stock <= 10 ? '⚠' : '✓'}</span>
      </td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ai btn-sm" onclick="openAIModal(${p.id}, '${escHtml(p.name)}', '${escHtml(p.category || '')}', ${p.price})">✦ AI Desc</button>
          <button class="btn btn-secondary btn-sm" onclick="openEditModal(${p.id})">✏ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function escHtml(str) { return (str || '').replace(/'/g, "\\'"); }

function filterProducts() {
  const q = document.getElementById('product-search').value.toLowerCase();
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  renderProductsTable(filtered);
}

// Add Product Modal
function openAddProduct() {
  document.getElementById('product-modal-title').textContent = '＋ Add New Product';
  document.getElementById('product-form').reset();
  document.getElementById('edit-product-id').value = '';
  document.getElementById('ai-desc-output').classList.remove('visible');
  document.getElementById('price-suggestion').classList.remove('visible');
  document.getElementById('product-modal').classList.add('open');
}

function closeProductModal() { document.getElementById('product-modal').classList.remove('open'); }

async function openEditModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-modal-title').textContent = '✏ Edit Product';
  document.getElementById('edit-product-id').value = p.id;
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-sku').value = p.sku;
  document.getElementById('p-category').value = p.category || '';
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-stock').value = p.stock;
  document.getElementById('p-description').value = p.description || '';
  document.getElementById('ai-desc-output').classList.remove('visible');
  document.getElementById('price-suggestion').classList.remove('visible');
  document.getElementById('product-modal').classList.add('open');
}

async function saveProduct() {
  const id = document.getElementById('edit-product-id').value;
  const body = {
    name: document.getElementById('p-name').value,
    sku: document.getElementById('p-sku').value,
    category: document.getElementById('p-category').value,
    price: parseFloat(document.getElementById('p-price').value),
    stock: parseInt(document.getElementById('p-stock').value),
    description: document.getElementById('p-description').value
  };
  const btn = document.getElementById('save-product-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...';
  try {
    if (id) {
      await api('PUT', `/products/${id}`, body);
      toast('Product updated successfully!', 'success');
    } else {
      await api('POST', '/products/', body);
      toast('Product added successfully!', 'success');
    }
    closeProductModal();
    loadProducts();
  } catch (e) {}
  finally { btn.disabled = false; btn.innerHTML = '💾 Save Product'; }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product? This action cannot be undone.')) return;
  await api('DELETE', `/products/${id}`);
  toast('Product deleted', 'info');
  loadProducts();
}

// AI Description Generator
async function openAIModal(id, name, category, price) {
  document.getElementById('edit-product-id').value = id;
  document.getElementById('p-name').value = name;
  document.getElementById('p-category').value = category;
  document.getElementById('p-price').value = price;
  document.getElementById('product-modal').classList.add('open');
  document.getElementById('product-modal-title').textContent = '✦ Generate AI Description';
  await generateAIDescription();
}

async function generateAIDescription() {
  const name = document.getElementById('p-name').value;
  const category = document.getElementById('p-category').value;
  const price = document.getElementById('p-price').value;
  const features = document.getElementById('p-description').value;
  if (!name) { toast('Enter a product name first', 'error'); return; }
  const btn = document.getElementById('gen-desc-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating...';
  const output = document.getElementById('ai-desc-output');
  output.classList.remove('visible');
  try {
    const res = await api('POST', '/ai/generate-description', { product_name: name, category, price: parseFloat(price) || null, key_features: features });
    output.textContent = res.description;
    output.classList.add('visible');
    document.getElementById('p-description').value = res.description;
    toast('AI description generated!', 'success');
  } catch (e) {}
  finally { btn.disabled = false; btn.innerHTML = '✦ Generate AI Description'; }
}

async function suggestPrice() {
  const name = document.getElementById('p-name').value;
  const category = document.getElementById('p-category').value;
  if (!name || !category) { toast('Enter product name and category first', 'error'); return; }
  const btn = document.getElementById('suggest-price-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Analyzing...';
  const box = document.getElementById('price-suggestion');
  box.classList.remove('visible');
  try {
    const res = await api('POST', `/ai/suggest-price?product_name=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`);
    box.innerHTML = `<div style="font-size:10px;font-family:var(--font-mono);color:var(--accent-green);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">✦ AI Price Suggestion</div><div style="font-size:13px;line-height:1.7;color:var(--text-secondary)">${res.suggestion}</div>`;
    box.classList.add('visible');
  } catch (e) {}
  finally { btn.disabled = false; btn.innerHTML = '💡 AI Price Suggest'; }
}

// Orders
async function loadOrders() {
  const orders = await api('GET', '/orders/');
  allOrders = orders;
  renderOrdersTable(orders);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">No orders yet</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span style="font-family:var(--font-mono);color:var(--accent-cyan)">#${o.id}</span></td>
      <td class="td-name">${o.customer_name}</td>
      <td style="font-size:12px;color:var(--text-muted)">${o.customer_email}</td>
      <td>${o.product_name || '—'}</td>
      <td><span style="font-family:var(--font-mono)">${o.quantity}</span></td>
      <td><span style="color:var(--accent-green);font-family:var(--font-mono);font-weight:600">$${o.total_price.toFixed(2)}</span></td>
      <td>
        <select class="form-select" style="padding:5px 10px;font-size:12px;width:auto" onchange="updateStatus(${o.id}, this.value)">
          ${['pending','processing','shipped','delivered','cancelled'].map(s => `<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('');
}

async function updateStatus(id, status) {
  await api('PATCH', `/orders/${id}/status?status=${status}`);
  toast(`Order #${id} → ${status}`, 'success');
}

function filterOrders() {
  const q = document.getElementById('order-search').value.toLowerCase();
  const status = document.getElementById('order-status-filter').value;
  const filtered = allOrders.filter(o => {
    const matchQ = o.customer_name.toLowerCase().includes(q) || o.customer_email.toLowerCase().includes(q);
    const matchS = !status || o.status === status;
    return matchQ && matchS;
  });
  renderOrdersTable(filtered);
}

// Create Order Modal
function openCreateOrder() { document.getElementById('order-modal').classList.add('open'); loadProductOptions(); }
function closeOrderModal() { document.getElementById('order-modal').classList.remove('open'); }

async function loadProductOptions() {
  const products = await api('GET', '/products/');
  const sel = document.getElementById('o-product');
  sel.innerHTML = '<option value="">Select product...</option>' + products.map(p => `<option value="${p.id}">${p.name} — $${p.price} (Stock: ${p.stock})</option>`).join('');
}

async function createOrder() {
  const body = {
    customer_name: document.getElementById('o-name').value,
    customer_email: document.getElementById('o-email').value,
    product_id: parseInt(document.getElementById('o-product').value),
    quantity: parseInt(document.getElementById('o-qty').value)
  };
  const btn = document.getElementById('save-order-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Placing...';
  try {
    await api('POST', '/orders/', body);
    toast('Order placed successfully!', 'success');
    closeOrderModal();
    loadOrders();
  } catch (e) {}
  finally { btn.disabled = false; btn.innerHTML = '🛒 Place Order'; }
}

// Chatbot
function initChat() {
  conversationHistory = [];
  const messages = document.getElementById('chat-messages');
  messages.innerHTML = `
    <div class="message bot">
      <div class="message-avatar">🤖</div>
      <div class="message-bubble">Hey there! I'm <strong>ShopGenius AI</strong> — your smart store assistant. I know your entire product catalog and can help with pricing, availability, recommendations, and order questions.<br><br>What can I help you with today?</div>
    </div>`;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });
  showTyping();
  try {
    const res = await api('POST', '/ai/chat', { message: text, conversation_history: conversationHistory.slice(-10) });
    hideTyping();
    appendMessage('bot', res.reply);
    conversationHistory.push({ role: 'assistant', content: res.reply });
  } catch (e) { hideTyping(); }
}

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `<div class="message-avatar">${role === 'bot' ? '🤖' : '👤'}</div><div class="message-bubble">${text.replace(/\n/g, '<br>')}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.id = 'typing-indicator';
  div.className = 'message bot';
  div.innerHTML = `<div class="message-avatar">🤖</div><div class="message-bubble"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() { document.getElementById('typing-indicator')?.remove(); }

function sendQuick(text) { document.getElementById('chat-input').value = text; sendMessage(); }

// Enter key support
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('chat-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
});

// Analytics
let analyticsCharts = {};
async function loadAnalytics() {
  try {
    const [orders, products, summary] = await Promise.all([
      api('GET', '/orders/'), api('GET', '/products/'), api('GET', '/orders/analytics/summary')
    ]);

    // Summary cards
    document.getElementById('a-revenue').textContent = '$' + summary.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 });
    document.getElementById('a-orders').textContent = summary.total_orders;
    document.getElementById('a-avg').textContent = '$' + summary.average_order_value.toFixed(2);
    document.getElementById('a-products').textContent = products.length;

    renderCategoryChart(products);
    renderOrdersBarChart(orders);
    renderInventoryChart(products);

  } catch (e) { console.error(e); }
}

function renderCategoryChart(products) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;
  if (analyticsCharts.category) analyticsCharts.category.destroy();
  const cats = {};
  products.forEach(p => { const c = p.category || 'Uncategorized'; cats[c] = (cats[c] || 0) + 1; });
  analyticsCharts.category = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: Object.keys(cats),
      datasets: [{ data: Object.values(cats), backgroundColor: ['rgba(0,229,255,0.6)','rgba(124,58,237,0.6)','rgba(0,255,163,0.6)','rgba(255,107,53,0.6)','rgba(247,37,133,0.6)'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8892a4', font: { family: 'DM Mono', size: 11 }, padding: 12, boxWidth: 10 } } }, scales: { r: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { display: false } } } }
  });
}

function renderOrdersBarChart(orders) {
  const ctx = document.getElementById('ordersBarChart');
  if (!ctx) return;
  if (analyticsCharts.bar) analyticsCharts.bar.destroy();
  const days = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
  }
  orders.forEach(o => {
    if (!o.created_at) return;
    const d = new Date(o.created_at).toLocaleDateString('en-US', { weekday: 'short' });
    if (d in days) days[d]++;
  });
  analyticsCharts.bar = new Chart(ctx, {
    type: 'bar',
    data: { labels: Object.keys(days), datasets: [{ label: 'Orders', data: Object.values(days), backgroundColor: 'rgba(124,58,237,0.6)', borderRadius: 8, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', titleColor: '#f0f4ff', bodyColor: '#8892a4', padding: 12 } }, scales: { x: { grid: { display: false }, ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 11 } } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 11 }, stepSize: 1 } } } }
  });
}

function renderInventoryChart(products) {
  const ctx = document.getElementById('inventoryChart');
  if (!ctx) return;
  if (analyticsCharts.inv) analyticsCharts.inv.destroy();
  const top = [...products].sort((a, b) => a.stock - b.stock).slice(0, 8);
  analyticsCharts.inv = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(p => p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name), datasets: [{ label: 'Stock', data: top.map(p => p.stock), backgroundColor: top.map(p => p.stock <= 10 ? 'rgba(247,37,133,0.6)' : 'rgba(0,255,163,0.6)'), borderRadius: 8, borderSkipped: false }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5568', font: { family: 'DM Mono', size: 11 } } }, y: { grid: { display: false }, ticks: { color: '#8892a4', font: { family: 'DM Mono', size: 11 } } } } }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  initChat();
});