Object.assign(app, {
    updateCardPreview() {
    const nameInput = document.getElementById('acc-name-input');
    const typeSelect = document.getElementById('acc-type-select');
    const balanceInput = document.getElementById('acc-balance-input');
    const digitsInput = document.getElementById('acc-digits-input');

    const previewName = document.getElementById('preview-name');
    const previewType = document.getElementById('preview-type');
    const previewBalance = document.getElementById('preview-balance');
    const previewDigits = document.getElementById('preview-digits');

    if (previewName) previewName.textContent = nameInput.value.trim() || 'Card Name';
    if (previewType && typeSelect) {
        const selectedText = typeSelect.options[typeSelect.selectedIndex]?.text || 'Digital Wallet';
        previewType.textContent = selectedText.toUpperCase();
    }
    if (previewBalance) {
        const val = parseFloat(balanceInput.value) || 0;
        previewBalance.textContent = this.formatPeso ? this.formatPeso(val) : `₱${val.toLocaleString()}`;
    }
    if (previewDigits) {
        previewDigits.textContent = digitsInput.value ? `•••• ${digitsInput.value}` : '•••• 1234';
    }
},
toggleMaskBalances() {
    this.state.isMasked = !this.state.isMasked;
    const icon = document.getElementById('mask-balance-icon');
    if (icon) icon.className = this.state.isMasked ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    this.renderAccountsUI();
    this.updateHomeUI();
},

getCalculatedTotalBalance() {
    if (!this.state.accounts) return 0;
    const totalCents = this.state.accounts.reduce((sum, acc) => sum + Math.round((acc.balance || 0) * 100), 0);
    return totalCents / 100;
},

filterAccounts(type, btnEl) {
    this.state.selectedAccountFilter = type;
    document.querySelectorAll('.filter-chips-scroll .chip-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    this.renderAccountsUI();
},

toggleCardExpand(cardEl) {
    const isExpanded = cardEl.classList.contains('expanded');
    document.querySelectorAll('.stacked-card').forEach(c => c.classList.remove('expanded'));
    if (!isExpanded) {
        cardEl.classList.add('expanded');
    }
},

renderAccountsUI() {
    const listEl = document.getElementById('accounts-stack-list');
    const netTotalEl = document.getElementById('accounts-total-net');
    if (!listEl) return;

    const total = this.getCalculatedTotalBalance();
    if (netTotalEl) {
        netTotalEl.textContent = this.state.isMasked ? '₱••••••' : this.formatPeso(total);
    }

    listEl.innerHTML = '';
    const filter = this.state.selectedAccountFilter;
    const filtered = (this.state.accounts || []).filter(acc => filter === 'All' || acc.type === filter);

    if (filtered.length === 0) {
    listEl.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-gray); background: var(--card-bg); border-radius: 16px; border: 1px dashed var(--border-color);">
            <i class="fa-solid fa-wallet" style="font-size: 1.8rem; margin-bottom: 8px; opacity: 0.4;"></i>
            <p style="font-size: 0.85rem; font-weight: 700;">No accounts found</p>
            <p style="font-size: 0.75rem; margin-top: 4px;">No active cards or wallets under "${filter}".</p>
        </div>
    `;
    return;
}

    filtered.forEach(acc => {
        const balDisplay = this.state.isMasked ? '₱••••••' : this.formatPeso(acc.balance);
        const html = `
            <div class="stacked-card ${acc.gradient || 'card-gradient-bank'}" onclick="app.toggleCardExpand(this)">
                <div class="card-top-row">
                    <div class="card-brand">
                        <i class="fa-solid ${acc.icon || 'fa-wallet'}"></i> ${acc.name}
                    </div>
                    <div class="card-num">${acc.last4 ? '•••• ' + acc.last4 : ''}</div>
                </div>
                <div class="card-balance-label">${acc.type === 'card' ? 'Available Credit' : 'Balance'}</div>
                <div class="card-balance-val">${balDisplay}</div>
                
                <div class="card-details-drawer">
                    <div class="flex justify-between items-center">
                        <span>Account Type: <b style="text-transform:capitalize;">${acc.type}</b></span>
                        <button onclick="event.stopPropagation(); app.deleteAccount('${acc.id}')" style="background:rgba(255,255,255,0.2); border:none; color:white; padding:4px 8px; border-radius:6px; cursor:pointer;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });

    this.populateAccountDropdown();
},

populateAccountDropdown() {
    const selectEl = document.getElementById('expense-account-select');
    if (!selectEl) return;
    selectEl.innerHTML = '';
    (this.state.accounts || []).forEach(acc => {
        selectEl.insertAdjacentHTML('beforeend', `
            <option value="${acc.id}">${acc.name} (${this.formatPeso(acc.balance)})</option>
        `);
    });
},

selectAccountPreset(name, type, last4) {
    document.getElementById('acc-name-input').value = name;
    document.getElementById('acc-type-select').value = type;
    document.getElementById('acc-digits-input').value = last4 || '';
    
    // Highlight selected preset chip
    document.querySelectorAll('.preset-chip').forEach(chip => {
        const text = chip.textContent.trim();
        if (name && text.toLowerCase().includes(name.split(' ')[0].toLowerCase())) {
            chip.classList.add('selected');
        } else if (!name && text.includes('Custom')) {
            chip.classList.add('selected');
        } else {
            chip.classList.remove('selected');
        }
    });

    // Auto-focus starting balance input for fast typing
    const balInput = document.getElementById('acc-balance-input');
    if (balInput) balInput.focus();
},
selectCardColor(gradientClass, el) {
    this.state.selectedCardGradient = gradientClass;
    document.querySelectorAll('#acc-color-palette .color-swatch').forEach(swatch => {
        swatch.classList.remove('selected');
    });
    if (el) el.classList.add('selected');

    // Update Live Card Preview Gradient
    const preview = document.getElementById('card-preview');
    if (preview) {
        preview.className = `card-gradient-gcash mb-3 ${gradientClass}`;
    }
},

openAddAccountModal() {
        this.resetSplitState('account');

        document.getElementById('acc-name-input').value = '';
        document.getElementById('acc-balance-input').value = '';
        document.getElementById('acc-digits-input').value = '';
        document.getElementById('acc-date-input').value = this.state.targetAllowanceDate || '';

        // Real-time preview listeners
        ['acc-name-input', 'acc-balance-input', 'acc-digits-input'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.oninput = () => this.updateCardPreview();
        });

        const typeSelect = document.getElementById('acc-type-select');
        if (typeSelect) typeSelect.onchange = () => this.updateCardPreview();

        this.updateCardPreview();
        this.updateSplitPreview('account');
        this.openModal('modal-add-account');
    },

    saveAccount() {
        const name = document.getElementById('acc-name-input').value.trim();
        const type = document.getElementById('acc-type-select').value;
        const totalBalance = parseFloat(document.getElementById('acc-balance-input').value) || 0;
        const cycleDate = document.getElementById('acc-date-input').value;
        const last4 = document.getElementById('acc-digits-input').value.trim();

        if (!name) {
            alert("Please enter an account name.");
            return;
        }

        // MANDATORY NEXT ALLOWANCE DATE CHECK
        if (!cycleDate) {
            alert("Next Allowance Date is required so BudgetBuddy can calculate your daily budget limit!");
            return;
        }

        // 1. Calculate savings split using shared helper
        const { savingsAmt, spendableAmt } = this.getSplitAmounts(totalBalance, 'account');

        const typeGradients = {
            digital: 'card-gradient-gcash',
            bank: 'card-gradient-bank',
            cash: 'card-gradient-cash',
            card: 'card-gradient-card'
        };

        const typeIcons = {
            digital: 'fa-mobile-screen',
            bank: 'fa-building-columns',
            cash: 'fa-wallet',
            card: 'fa-credit-card'
        };

        const newAcc = {
            id: 'acc_' + Date.now(),
            name,
            type,
            balance: spendableAmt,
            last4,
            gradient: this.state.selectedCardGradient || typeGradients[type],
            icon: typeIcons[type]
        };

        if (!this.state.accounts) this.state.accounts = [];
        this.state.accounts.push(newAcc);

        // 2. Route savings portion directly to active savings goal
        this.routeSavingsToGoal(savingsAmt);

        this.state.balance = this.getCalculatedTotalBalance();
        this.state.initialAllowance = this.state.balance;

        // Establish allowance cycle dates
        const todayStr = formatLocalDateKey(new Date());
        if (!this.state.allowanceStartDate) {
            this.state.allowanceStartDate = todayStr;
        }
        this.state.targetAllowanceDate = cycleDate;

        // 3. Reset split selection & refresh app state
        this.resetSplitState('account');
        this.recalculateDailyLimit();
        this.saveState();
        this.closeModal('modal-add-account');
        this.renderAccountsUI();
        this.updateHomeUI();
        this.updateGoalsUI();

        const msg = savingsAmt > 0
            ? `Account added! ${this.formatPeso(spendableAmt)} balance & ${this.formatPeso(savingsAmt)} saved!`
            : "Account added & cycle set successfully!";
        this.showToast(msg);
    },

deleteAccount(id) {
    if (confirm("Delete this account?")) {
        this.state.accounts = this.state.accounts.filter(a => a.id !== id);
        this.state.balance = this.getCalculatedTotalBalance();
        this.saveState();
        this.renderAccountsUI();
        this.updateHomeUI();
        this.showToast("Account removed.");
    }
}
});