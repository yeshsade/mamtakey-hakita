let currentStudent = null;
let currentAction = null;
let operatorMode = false;
let allStudents = [];

const barcodeInput = document.getElementById('barcodeInput');
const studentGrid = document.getElementById('studentGrid');
const studentListSection = document.getElementById('studentListSection');
const accountSection = document.getElementById('accountSection');
const amountModal = document.getElementById('amountModal');
const amountInput = document.getElementById('amountInput');

if (window.__sessionUser && window.__sessionUser.role === 'admin') {
  operatorMode = true;
  document.getElementById('operatorBadge').classList.remove('hidden');
  document.getElementById('operatorName').textContent = window.__sessionUser.username + ' (מנהל)';
}

loadStudents();

async function loadStudents() {
  allStudents = await api('/api/students');
  renderStudentGrid(allStudents);
}

function renderStudentGrid(students) {
  studentGrid.innerHTML = '';
  if (students.length === 0) {
    studentGrid.innerHTML = '<div style="text-align:center;color:#bbb;padding:24px;grid-column:1/-1;">לא נמצאו תלמידים</div>';
    return;
  }
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    var card = document.createElement('div');
    card.className = 'bank-student-card';
    card.onclick = (function(student) { return function() { selectStudent(student); }; })(s);
    card.innerHTML =
      '<div class="bank-student-avatar">' + s.name.charAt(0) + '</div>' +
      '<div class="bank-student-name">' + s.name + '</div>' +
      '<div class="bank-student-barcode">#' + s.barcode + '</div>' +
      '<div class="bank-student-balance">' + s.balance + ' נק׳</div>';
    studentGrid.appendChild(card);
  }
}

barcodeInput.addEventListener('input', function() {
  var q = barcodeInput.value.trim().toLowerCase();
  if (!q) {
    renderStudentGrid(allStudents);
    return;
  }
  var filtered = allStudents.filter(function(s) {
    return s.name.includes(q) || s.barcode.includes(q);
  });
  renderStudentGrid(filtered);
});

barcodeInput.addEventListener('keydown', async function(e) {
  if (e.key !== 'Enter') return;
  var barcode = barcodeInput.value.trim();
  if (!barcode) return;

  if (!operatorMode) {
    var opData = await api('/api/operator/' + barcode);
    if (opData.found) {
      var perms = (opData.operator.permissions || '').split(',');
      if (perms.includes('bank')) {
        operatorMode = true;
        showToast(opData.operator.username + ' נכנס/ה כפקיד/ת בנק');
        document.getElementById('operatorBadge').classList.remove('hidden');
        document.getElementById('operatorName').textContent = opData.operator.username;
      } else {
        showToast('אין הרשאת בנק', 'error');
      }
      barcodeInput.value = '';
      renderStudentGrid(allStudents);
      return;
    }
  }

  var data = await api('/api/student/' + barcode);
  if (data.found) {
    selectStudent(data.student);
    barcodeInput.value = '';
  }
});

function selectStudent(student) {
  currentStudent = student;
  document.getElementById('studentName').textContent = student.name;
  document.getElementById('studentBarcode').textContent = student.barcode;
  document.getElementById('balanceAmount').textContent = student.balance;
  document.getElementById('studentAvatar').textContent = student.name.charAt(0);

  studentListSection.classList.add('hidden');
  accountSection.classList.remove('hidden');

  loadHistory();
}

async function loadHistory() {
  var transactions = await api('/api/student/' + currentStudent.id + '/history');
  var list = document.getElementById('historyList');
  list.innerHTML = '';

  if (transactions.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#bbb;padding:16px;">אין תנועות עדיין</div>';
    return;
  }

  for (var i = 0; i < transactions.length; i++) {
    var tx = transactions[i];
    var isPositive = tx.type === 'deposit';
    var date = new Date(tx.created_at + 'Z');
    var dateStr = date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    var div = document.createElement('div');
    div.className = 'bank-tx-item';
    div.innerHTML =
      '<div>' +
        '<div class="bank-tx-desc">' + tx.description + '</div>' +
        '<div class="bank-tx-date">' + dateStr + '</div>' +
      '</div>' +
      '<div class="bank-tx-amount ' + (isPositive ? 'positive' : 'negative') + '">' +
        (isPositive ? '+' : '-') + tx.amount +
      '</div>';
    list.appendChild(div);
  }
}

function openAmountDialog(action) {
  if (!operatorMode) {
    showToast('סרוק כרטיס מפעיל קודם', 'error');
    return;
  }
  currentAction = action;
  document.getElementById('dialogTitle').textContent = action === 'deposit' ? 'הפקדה' : 'משיכה';
  document.getElementById('dialogIcon').textContent = action === 'deposit' ? '💵' : '🏧';
  amountInput.value = '';
  amountModal.classList.remove('hidden');
  setTimeout(function() { amountInput.focus(); }, 100);
}

function closeAmountDialog() {
  amountModal.classList.add('hidden');
  currentAction = null;
}

async function confirmAction() {
  var amount = parseInt(amountInput.value);
  if (!amount || amount <= 0) {
    showToast('הכנס סכום תקין', 'error');
    return;
  }

  var endpoint = currentAction === 'deposit' ? '/api/bank/deposit' : '/api/bank/withdraw';
  var data = await api(endpoint, {
    method: 'POST',
    body: { student_id: currentStudent.id, amount: amount }
  });

  if (data.success) {
    document.getElementById('balanceAmount').textContent = data.balance;
    currentStudent.balance = data.balance;
    showToast(currentAction === 'deposit' ? 'הופקדו ' + amount + ' נקודות' : 'נמשכו ' + amount + ' נקודות');
    closeAmountDialog();
    loadHistory();
  } else {
    showToast(data.error, 'error');
  }
}

function resetToList() {
  currentStudent = null;
  accountSection.classList.add('hidden');
  studentListSection.classList.remove('hidden');
  barcodeInput.value = '';
  barcodeInput.focus();
  loadStudents();
}

function logoutOperator() {
  operatorMode = false;
  document.getElementById('operatorBadge').classList.add('hidden');
  showToast('המפעיל יצא');
}

amountInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') confirmAction();
  if (e.key === 'Escape') closeAmountDialog();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (!amountModal.classList.contains('hidden')) {
      closeAmountDialog();
    } else if (!accountSection.classList.contains('hidden')) {
      resetToList();
    }
  }
});
