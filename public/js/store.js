let currentStudent = null;
let products = [];
let cart = [];
let allStudents = [];
let operatorMode = false;

const productBarcodeInput = document.getElementById('productBarcodeInput');

if (window.__sessionUser && window.__sessionUser.role === 'admin') {
  operatorMode = true;
  document.getElementById('operatorBadge').classList.remove('hidden');
  document.getElementById('operatorName').textContent = window.__sessionUser.username + ' (מנהל)';
}

loadProducts();

productBarcodeInput.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const barcode = productBarcodeInput.value.trim();
  if (!barcode) return;

  if (!operatorMode) {
    const opData = await api('/api/operator/' + barcode);
    if (opData.found) {
      const perms = (opData.operator.permissions || '').split(',');
      if (perms.includes('store')) {
        operatorMode = true;
        showToast(opData.operator.username + ' נכנס/ה כמוכר/ת');
        document.getElementById('operatorBadge').classList.remove('hidden');
        document.getElementById('operatorName').textContent = opData.operator.username;
      } else {
        showToast('אין הרשאת חנות', 'error');
      }
      productBarcodeInput.value = '';
      return;
    }
  }

  await handleProductScan(barcode);
  productBarcodeInput.value = '';
});

async function loadProducts() {
  products = await api('/api/products');
  renderProducts();
}

function getProductEmoji(name) {
  var n = name.toLowerCase();
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
  var grid = document.getElementById('productsGrid');
  grid.innerHTML = '';
  for (var i = 0; i < products.length; i++) {
    var product = products[i];
    var inCart = cart.find(function(c) { return c.product.id === product.id; });
    var emoji = getProductEmoji(product.name);
    var card = document.createElement('div');
    card.className = 'store-product-card' + (inCart ? ' selected' : '');
    card.onclick = (function(p) { return function() { addToCart(p); }; })(product);
    card.innerHTML =
      '<div class="store-product-emoji">' + emoji + '</div>' +
      '<div class="store-product-name">' + product.name + '</div>' +
      '<div class="store-product-price">' + product.price + ' נק׳</div>';
    grid.appendChild(card);
  }
}

async function handleProductScan(barcode) {
  var data = await api('/api/product/' + barcode);
  if (data.found) {
    addToCart(data.product);
  } else {
    document.getElementById('newProductBarcode').value = barcode;
    document.getElementById('newProductName').value = '';
    document.getElementById('newProductPrice').value = '';
    document.getElementById('newProductModal').classList.remove('hidden');
    setTimeout(function() { document.getElementById('newProductName').focus(); }, 100);
  }
}

function addToCart(product) {
  var existing = cart.find(function(c) { return c.product.id === product.id; });
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ product: product, quantity: 1 });
  }
  updateCart();
  renderProducts();
}

function removeFromCart(productId) {
  var idx = cart.findIndex(function(c) { return c.product.id === productId; });
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
  var checkoutSection = document.getElementById('checkoutSection');
  var cartItems = document.getElementById('cartItems');

  if (cart.length === 0) {
    checkoutSection.classList.add('hidden');
    return;
  }

  checkoutSection.classList.remove('hidden');
  cartItems.innerHTML = '';

  var total = 0;
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var itemTotal = item.product.price * item.quantity;
    total += itemTotal;
    var productJson = JSON.stringify(item.product).replace(/"/g, '&quot;');
    cartItems.innerHTML +=
      '<div class="store-cart-item">' +
        '<span class="store-cart-item-name">' + item.product.name + '</span>' +
        '<div class="store-cart-controls">' +
          '<button class="store-qty-btn store-qty-minus" onclick="removeFromCart(' + item.product.id + ')">−</button>' +
          '<span class="store-qty-value">' + item.quantity + '</span>' +
          '<button class="store-qty-btn store-qty-plus" onclick="addToCart(' + productJson + ')">+</button>' +
          '<span class="store-cart-price">' + itemTotal + ' נק׳</span>' +
        '</div>' +
      '</div>';
  }

  document.getElementById('totalAmount').textContent = total;
  document.getElementById('buyBtn').textContent = '💳 לתשלום - ' + total + ' נק׳';
}

function startCheckout() {
  if (!operatorMode) {
    showToast('סרוק כרטיס מפעיל קודם', 'error');
    return;
  }
  openStudentModal();
}

async function openStudentModal() {
  allStudents = await api('/api/students');
  renderStudentList(allStudents);
  currentStudent = null;
  document.getElementById('selectedStudentInfo').classList.add('hidden');
  document.getElementById('confirmPurchaseBtn').disabled = true;
  document.getElementById('confirmPurchaseBtn').textContent = '💳 בחר תלמיד קודם';
  document.getElementById('studentModal').classList.remove('hidden');
  var input = document.getElementById('studentSearchInput');
  input.value = '';
  setTimeout(function() { input.focus(); }, 100);
}

function renderStudentList(students) {
  var list = document.getElementById('studentList');
  list.innerHTML = '';
  if (students.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#bbb;padding:16px;">לא נמצאו תלמידים</div>';
    return;
  }
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    var div = document.createElement('div');
    div.className = 'store-student-item' + (currentStudent && currentStudent.id === s.id ? ' active' : '');
    div.onclick = (function(student) { return function() { selectStudent(student); }; })(s);
    div.innerHTML =
      '<span class="store-student-item-name">' + s.name + '</span>' +
      '<span class="store-student-item-id">#' + s.barcode + '</span>' +
      '<span class="store-student-item-balance">' + s.balance + ' נק׳</span>';
    list.appendChild(div);
  }
}

document.getElementById('studentSearchInput').addEventListener('input', function(e) {
  var q = e.target.value.trim().toLowerCase();
  if (!q) { renderStudentList(allStudents); return; }
  var filtered = allStudents.filter(function(s) {
    return s.name.includes(q) || s.barcode.includes(q);
  });
  renderStudentList(filtered);
});

document.getElementById('studentSearchInput').addEventListener('keydown', async function(e) {
  if (e.key !== 'Enter') return;
  var barcode = e.target.value.trim();
  if (!barcode) return;
  var data = await api('/api/student/' + barcode);
  if (data.found) {
    selectStudent(data.student);
    e.target.value = '';
  }
});

function selectStudent(student) {
  currentStudent = student;
  document.getElementById('selectedStudentInfo').classList.remove('hidden');
  document.getElementById('selectedAvatar').textContent = student.name.charAt(0);
  document.getElementById('selectedName').textContent = student.name + ' (#' + student.barcode + ')';
  document.getElementById('selectedBalance').textContent = student.balance;
  renderStudentList(allStudents);

  var total = cart.reduce(function(sum, item) { return sum + item.product.price * item.quantity; }, 0);
  var btn = document.getElementById('confirmPurchaseBtn');
  if (total > student.balance) {
    btn.disabled = true;
    btn.textContent = '😔 אין מספיק יתרה';
  } else {
    btn.disabled = false;
    btn.textContent = '💳 אישור קנייה - ' + total + ' נק׳';
  }
}

async function confirmPurchase() {
  if (!currentStudent) return;
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var data = await api('/api/store/purchase', {
      method: 'POST',
      body: { student_id: currentStudent.id, product_id: item.product.id, quantity: item.quantity }
    });
    if (!data.success) {
      showToast(data.error, 'error');
      return;
    }
    currentStudent.balance = data.balance;
  }
  showToast('הקנייה הושלמה בהצלחה!');
  cart = [];
  updateCart();
  renderProducts();
  closeStudentModal();
  currentStudent = null;
  productBarcodeInput.focus();
}

function closeStudentModal() {
  document.getElementById('studentModal').classList.add('hidden');
  productBarcodeInput.focus();
}

async function saveNewProduct() {
  var barcode = document.getElementById('newProductBarcode').value;
  var name = document.getElementById('newProductName').value.trim();
  var price = document.getElementById('newProductPrice').value;
  if (!name || !price) { showToast('מלא שם ומחיר', 'error'); return; }

  await fetch('/admin/product/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'name=' + encodeURIComponent(name) + '&barcode=' + encodeURIComponent(barcode) + '&price=' + price,
    redirect: 'manual'
  });
  closeNewProductModal();
  await loadProducts();
  var product = products.find(function(p) { return p.barcode === barcode; });
  if (product) addToCart(product);
  showToast(name + ' נוסף לחנות!');
}

function closeNewProductModal() {
  document.getElementById('newProductModal').classList.add('hidden');
  productBarcodeInput.focus();
}

function logoutOperator() {
  operatorMode = false;
  document.getElementById('operatorBadge').classList.add('hidden');
  showToast('המפעיל יצא');
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (!document.getElementById('newProductModal').classList.contains('hidden')) {
      closeNewProductModal();
    } else if (!document.getElementById('studentModal').classList.contains('hidden')) {
      closeStudentModal();
    }
  }
});
