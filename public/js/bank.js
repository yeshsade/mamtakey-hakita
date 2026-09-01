let currentStudent = null;
let currentAction = null;
let operatorMode = false;

const barcodeInput = document.getElementById('barcodeInput');
const scanSection = document.getElementById('scanSection');
const accountSection = document.getElementById('accountSection');
const amountModal = document.getElementById('amountModal');
const amountInput = document.getElementById('amountInput');

if (window.__sessionUser && window.__sessionUser.role === 'admin') {
  operatorMode = true;
  document.getElementById('operatorBadge').classList.remove('hidden');
  document.getElementById('operatorName').textContent = window.__sessionUser.username + ' (מנהל)';
  scanSection.querySelector('.bank-scan-title').textContent = 'סרוק כרטיס תלמיד';
}

barcodeInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const barcode = barcodeInput.value.trim();
    if (!barcode) return;

    if (!operatorMode) {
      const opData = await api(`/api/operator/${barcode}`);
      if (opData.found) {
        const perms = (opData.operator.permissions || '').split(',');
        if (perms.includes('bank')) {
          operatorMode = true;
          showToast(`${opData.operator.username} נכנס/ה כפקיד/ת בנק`);
          document.getElementById('operatorBadge').classList.remove('hidden');
          document.getElementById('operatorName').textContent = opData.operator.username;
          barcodeInput.value = '';
          barcodeInput.focus();
          return;
        } else {
          showToast('אין הרשאת בנק', 'error');
          barcodeInput.value = '';
          return;
        }
      }
    }

    await loadStudent(barcode);
  }
});

async function loadStudent(barcode) {
  const data = await api(`/api/student/${barcode}`);

  if (!data.found) {
    showToast('תלמיד לא נמצא', 'error');
    barcodeInput.value = '';
    barcodeInput.focus();
    return;
  }

  currentStudent = data.student;
  document.getElementById('studentName').textContent = currentStudent.name;
  document.getElementById('studentBarcode').textContent = currentStudent.barcode;
  document.getElementById('balanceAmount').textContent = currentStudent.balance;

  scanSection.classList.add('hidden');
  accountSection.classList.remove('hidden');

  loadHistory();
}

async function loadHistory() {
  const transactions = await api(`/api/student/${currentStudent.id}/history`);
  const list = document.getElementById('historyList');
  list.innerHTML = '';

  if (transactions.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:#bbb;padding:16px;">אין תנועות עדיין</div>';
    return;
  }

  for (const tx of transactions) {
    const isPositive = tx.type === 'deposit';
    const date = new Date(tx.created_at + 'Z');
    const dateStr = date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    list.innerHTML += `
      <div class="bank-tx-item">
        <div>
          <div class="bank-tx-desc">${tx.description}</div>
          <div class="bank-tx-date">${dateStr}</div>
        </div>
        <div class="bank-tx-amount ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '+' : '-'}${tx.amount}
        </div>
      </div>
    `;
  }
}

function openAmountDialog(action) {
  currentAction = action;
  document.getElementById('dialogTitle').textContent = action === 'deposit' ? 'הפקדה' : 'משיכה';
  document.getElementById('dialogIcon').textContent = action === 'deposit' ? '💵' : '🏧';
  amountInput.value = '';
  amountModal.classList.remove('hidden');
  setTimeout(() => amountInput.focus(), 100);
}

function closeAmountDialog() {
  amountModal.classList.add('hidden');
  currentAction = null;
}

async function confirmAction() {
  const amount = parseInt(amountInput.value);
  if (!amount || amount <= 0) {
    showToast('הכנס סכום תקין', 'error');
    return;
  }

  const endpoint = currentAction === 'deposit' ? '/api/bank/deposit' : '/api/bank/withdraw';
  const data = await api(endpoint, {
    method: 'POST',
    body: { student_id: currentStudent.id, amount }
  });

  if (data.success) {
    document.getElementById('balanceAmount').textContent = data.balance;
    currentStudent.balance = data.balance;
    showToast(currentAction === 'deposit' ? `הופקדו ${amount} נקודות` : `נמשכו ${amount} נקודות`);
    closeAmountDialog();
    loadHistory();
  } else {
    showToast(data.error, 'error');
  }
}

function resetScan() {
  currentStudent = null;
  accountSection.classList.add('hidden');
  scanSection.classList.remove('hidden');
  barcodeInput.value = '';
  barcodeInput.focus();
}

function logoutOperator() {
  operatorMode = false;
  document.getElementById('operatorBadge').classList.add('hidden');
  resetScan();
  showToast('המפעיל יצא');
}

amountInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') confirmAction();
  if (e.key === 'Escape') closeAmountDialog();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!amountModal.classList.contains('hidden')) {
      closeAmountDialog();
    } else if (!accountSection.classList.contains('hidden')) {
      resetScan();
    }
  }
});
