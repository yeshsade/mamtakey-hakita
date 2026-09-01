let currentStudent = null;
let products = [];
let cart = [];
let operatorMode = false;

const studentBarcodeInput = document.getElementById('studentBarcodeInput');
const productBarcodeInput = document.getElementById('productBarcodeInput');
const scanSection = document.getElementById('scanSection');
const shopSection = document.getElementById('shopSection');

if (window.__sessionUser && window.__sessionUser.role === 'admin') {
  operatorMode = true;
  document.getElementById('operatorBadge').classList.remove('hidden');
  document.getElementById('operatorName').textContent = window.__sessionUser.username + ' (מנהל)';
  scanSection.querySelector('.store-scan-title').textContent = 'סרוק כרטיס תלמיד כדי להתחיל';
}

studentBarcodeInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const barcode = studentBarcodeInput.value.trim();
    if (!barcode) return;

    if (!operatorMode) {
      const opData = await api(`/api/operator/${barcode}`);
      if (opData.found) {
        const perms = (opData.operator.permissions || '').split(',');
        if (perms.includes('store')) {
          operatorMode = true;
          showToast(`${opData.operator.username} נכנס/ה כמוכר/ת`);
          document.getElementById('operatorBadge').classList.remove('hidden');
          document.getElementById('operatorName').textContent = opData.operator.username;
          studentBarcodeInput.value = '';
          studentBarcodeInput.focus();
          return;
        } else {
          showToast('אין הרשאת חנות', 'error');
          studentBarcodeInput.value = '';
          return;
        }
      }
    }

    await loadCustomer(barcode);
  }
});

productBarcodeInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const barcode = productBarcodeInput.value.trim();
    if (!barcode) return;
    await handleProductScan(barcode);
    productBarcodeInput.value = '';
  }
});

async function loadCustomer(barcode) {
  const data = await api(`/api/student/${barcode}`);
  if (!data.found) {
    showToast('תלמיד לא נמצא', 'error');
    studentBarcodeInput.value = '';
    studentBarcodeInput.focus();
    return;
  }

  currentStudent = data.student;
  document.getElementById('customerName').textContent = currentStudent.name;
  document.getElementById('customerBalance').textContent = currentStudent.balance;
  document.getElementById('customerAvatar').textContent = currentStudent.name.charAt(0);

  scanSection.classList.add('hidden');
  shopSection.classList.remove('hidden');

  cart = [];
  updateCart();
  await loadProducts();
  productBarcodeInput.focus();
}

async function loadProducts() {
  products = await api('/api/products');
  renderProducts();
}

function getProductEmoji(name) {
  const n = name.toLowerCase();
  if (n.includes('סוכריה') || n.includes('סוכרי')) return '🍬';
  if (n.includes('שוקולד')) return '🍫';
  if (n.includes('גומי')) return '🐻';
  if (n.includes('ביסלי') || n.includes('חטיף')) return '🌽';
  if (n.includes('במבה') || n.includes('בוטנים')) return '🥜';
  if (n.includes('עוגיה') || n.includes('עוגי')) return '🍪';
  if (n.includes('גלידה')) return '🍦';
  if (n.includes('מסטיק')) return '🫧';
  if (n.includes('שלגון') || n.includes('ארטיק')) return '🧊';
  if (n.includes('וופל')) return '🧇';
  if (n.includes('קרקר')) return '🍘';
  if (n.includes('פופקורן')) return '🍿';
  if (n.includes('עוגה') || n.includes('קאפקייק')) return '🧁';
  if (n.includes('סוכריה על מקל') || n.includes('מקל')) return '🍭';
  return '🍬';
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';

  for (const product of products) {
    const inCart = cart.find(c => c.product.id === product.id);
    const emoji = getProductEmoji(product.name);
    const card = document.createElement('div');
    card.className = `store-product-card${inCart ? ' selected' : ''}`;
    card.onclick = () => addToCart(product);
    card.innerHTML = `
      <div class="store-product-emoji">${emoji}</div>
      <div class="store-product-name">${product.name}</div>
      <div class="store-product-price">${product.price} נק׳</div>
    `;
    grid.appendChild(card);
  }
}

async function handleProductScan(barcode) {
  const data = await api(`/api/product/${barcode}`);
  if (data.found) {
    addToCart(data.product);
  } else {
    document.getElementById('newProductBarcode').value = barcode;
    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';
    document.getElementById('newProductModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('newProductName').focus(), 100);
  }
}

function addToCart(product) {
  const existing = cart.find(c => c.product.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ product, quantity: 1 });
  }
  updateCart();
  renderProducts();
}

function removeFromCart(productId) {
  const idx = cart.findIndex(c => c.product.id === productId);
  if (idx !== -1) {
    if (cart[idx].quantity > 1) {
      cart[idx].quantity--;
    } else {
      cart.splice(idx, 1);
    }
  }
  updateCart();
  renderProducts();
}

function updateCart() {
  const checkoutSection = document.getElementById('checkoutSection');
  const cartItems = document.getElementById('cartItems');
  const buyBtn = document.getElementById('buyBtn');

  if (cart.length === 0) {
    checkoutSection.classList.add('hidden');
    return;
  }

  checkoutSection.classList.remove('hidden');
  cartItems.innerHTML = '';

  let total = 0;
  for (const item of cart) {
    const itemTotal = item.product.price * item.quantity;
    total += itemTotal;

    cartItems.innerHTML += `
      <div class="store-cart-item">
        <span class="store-cart-item-name">${item.product.name}</span>
        <div class="store-cart-controls">
          <button class="store-qty-btn store-qty-minus" onclick="removeFromCart(${item.product.id})">−</button>
          <span class="store-qty-value">${item.quantity}</span>
          <button class="store-qty-btn store-qty-plus" onclick="addToCart(${JSON.stringify(item.product).replace(/"/g, '&quot;')})">+</button>
          <span class="store-cart-price">${itemTotal} נק׳</span>
        </div>
      </div>
    `;
  }

  document.getElementById('totalAmount').textContent = total;

  if (total > currentStudent.balance) {
    buyBtn.disabled = true;
    buyBtn.textContent = 'אין מספיק יתרה';
  } else {
    buyBtn.disabled = false;
    buyBtn.textContent = `💳 לתשלום - ${total} נק׳`;
  }
}

async function completePurchase() {
  for (const item of cart) {
    const data = await api('/api/store/purchase', {
      method: 'POST',
      body: {
        student_id: currentStudent.id,
        product_id: item.product.id,
        quantity: item.quantity
      }
    });

    if (!data.success) {
      showToast(data.error, 'error');
      return;
    }

    currentStudent.balance = data.balance;
  }

  document.getElementById('customerBalance').textContent = currentStudent.balance;
  showToast('הקנייה הושלמה בהצלחה!');
  cart = [];
  updateCart();
  renderProducts();
  productBarcodeInput.focus();
}

async function saveNewProduct() {
  const barcode = document.getElementById('newProductBarcode').value;
  const name = document.getElementById('newProductName').value.trim();
  const price = document.getElementById('newProductPrice').value;

  if (!name || !price) {
    showToast('מלא שם ומחיר', 'error');
    return;
  }

  const res = await fetch('/admin/product/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `name=${encodeURIComponent(name)}&barcode=${encodeURIComponent(barcode)}&price=${price}`,
    redirect: 'manual'
  });

  closeNewProductModal();
  await loadProducts();

  const product = products.find(p => p.barcode === barcode);
  if (product) addToCart(product);

  showToast(`${name} נוסף לחנות!`);
}

function closeNewProductModal() {
  document.getElementById('newProductModal').classList.add('hidden');
  productBarcodeInput.focus();
}

function resetShop() {
  currentStudent = null;
  cart = [];
  shopSection.classList.add('hidden');
  scanSection.classList.remove('hidden');
  studentBarcodeInput.value = '';
  studentBarcodeInput.focus();
}

function logoutOperator() {
  operatorMode = false;
  document.getElementById('operatorBadge').classList.add('hidden');
  resetShop();
  showToast('המפעיל יצא');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('newProductModal');
    if (!modal.classList.contains('hidden')) {
      closeNewProductModal();
    } else if (!shopSection.classList.contains('hidden')) {
      resetShop();
    }
  }
});
