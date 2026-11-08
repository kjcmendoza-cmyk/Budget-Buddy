Object.assign(app, {
    renderAccountsUI() {
        const container = document.getElementById('accounts-stack-list');
        const netEl = document.getElementById('accounts-total-net');
        if (!container) return;
        container.innerHTML = '';

        const accounts = this.state.accounts || [];
        const filterCat = this.state.accountFilterCategory || 'All';
        const isMasked = this.state.maskBalances || false;

        const totalNet = this.getCalculatedTotalBalance();
        if (netEl) {
            netEl.textContent = isMasked ? '₱••••••' : this.formatPeso(totalNet);
        }

        const filtered = accounts.filter(acc => {
            if (filterCat === 'All') return true;
            return acc.type === filterCat;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem 1rem; color: var(--text-gray);">
                    <i class="fa-solid fa-wallet" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p style="font-size: 0.85rem; font-weight: 700;">No accounts found</p>
                    <p style="font-size: 0.75rem; margin-top: 4px;">Click "+ Add Account" to set up your wallets or cards.</p>
                </div>
            `;
            return;
        }

        filtered.forEach(acc => {
            const gradientClass = acc.gradient || 'card-gradient-gcash';
            const iconClass = acc.icon || 'fa-wallet';
            const last4Text = acc.last4 ? `•••• ${acc.last4}` : '';
            const displayBal = isMasked ? '₱••••••' : this.formatPeso(acc.balance);

            const html = `
    <div class="stacked-card ${gradientClass}" onclick="this.classList.toggle('expanded')">
        <!-- Top Row: Brand & Last 4 Digits -->
        <div class="card-top-row">
            <span class="card-brand"><i class="fa-solid ${iconClass}"></i> ${acc.name}</span>
            <span class="card-num">${last4Text}</span>
        </div>
        
        <!-- Middle Row: Balance -->
        <div style="margin-top: 1.5rem;">
            <div class="card-balance-label">Current Balance</div>
            <div class="card-balance-val">${displayBal}</div>
        </div>
        
        <!-- Hidden Drawer: Expands when the card is tapped -->
        <div class="card-details-drawer">
            <div class="flex justify-between items-center">
                <button onclick="event.stopPropagation(); app.openAddDepositModal();" 
                        style="background: rgba(255, 255, 255, 0.2); color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; gap: 6px; align-items: center; transition: background 0.2s;">
                    <i class="fa-solid fa-plus"></i> Add Money
                </button>
                <button onclick="event.stopPropagation(); app.deleteAccount('${acc.id}')" 
                        title="Delete Account" 
                        style="background: transparent; color: white; border: none; font-size: 1.2rem; cursor: pointer; opacity: 0.8; transition: opacity 0.2s;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </div>
    </div>
`;
container.insertAdjacentHTML('beforeend', html);
});
},
    openAddAccountModal() {
        this.resetSplitState('account');
        
        const nameInput = document.getElementById('acc-name-input');
        const balInput = document.getElementById('acc-balance-input');
        const digitsInput = document.getElementById('acc-digits-input');
        
        if (nameInput) nameInput.value = '';
        if (balInput) balInput.value = '';
        if (digitsInput) digitsInput.value = '';

        const dateInput = document.getElementById('acc-date-input');
        if (dateInput) {
            dateInput.value = this.state.targetAllowanceDate || '';
        }

        this.state.selectedCardGradient = 'card-gradient-gcash';
        this.updateCardPreview();
        this.updateSplitPreview('account');

        this.openModal('modal-add-account');
    },

    selectAccountPreset(name, type, last4) {
        const nameEl = document.getElementById('acc-name-input');
        const typeEl = document.getElementById('acc-type-select');
        const digitsEl = document.getElementById('acc-digits-input');

        if (name && nameEl) nameEl.value = name;
        if (typeEl) typeEl.value = type;
        if (last4 && digitsEl) digitsEl.value = last4;
        
        this.updateCardPreview();
    },

    selectCardColor(gradientClass, swatchEl) {
        this.state.selectedCardGradient = gradientClass;
        if (swatchEl && swatchEl.parentElement) {
            swatchEl.parentElement.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            swatchEl.classList.add('selected');
        }
        this.updateCardPreview();
    },

    updateCardPreview() {
        const card = document.getElementById('card-preview');
        if (!card) return;

        const name = document.getElementById('acc-name-input')?.value || 'GCash';
        const type = document.getElementById('acc-type-select')?.value || 'digital';
        const bal = parseFloat(document.getElementById('acc-balance-input')?.value) || 0;
        const last4 = document.getElementById('acc-digits-input')?.value || '1234';

        card.className = `${this.state.selectedCardGradient || 'card-gradient-gcash'} mb-3`;

        const prevName = document.getElementById('preview-name');
        const prevType = document.getElementById('preview-type');
        const prevBal = document.getElementById('preview-balance');
        const prevDigits = document.getElementById('preview-digits');

        if (prevName) prevName.textContent = name || 'Account Name';
        if (prevType) prevType.textContent = type.toUpperCase() + ' WALLET';
        if (prevBal) prevBal.textContent = this.formatPeso(bal);
        if (prevDigits) prevDigits.textContent = `•••• ${last4 || '1234'}`;
    },

    toggleMaskBalances() {
        this.state.maskBalances = !this.state.maskBalances;
        const icon = document.getElementById('mask-balance-icon');
        if (icon) {
            icon.className = this.state.maskBalances ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        }
        this.renderAccountsUI();
    },

    filterAccounts(category, btnEl) {
        document.querySelectorAll('.filter-chips-scroll .chip-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        this.state.accountFilterCategory = category;
        this.renderAccountsUI();
    },

    populateAccountDropdown() {
        const selectEl = document.getElementById('expense-account-select');
        if (!selectEl) return;

        selectEl.innerHTML = '';
        const accounts = this.state.accounts || [];

        if (accounts.length === 0) {
            selectEl.insertAdjacentHTML('beforeend', `<option value="">General Balance (${this.formatPeso(this.state.balance)})</option>`);
        } else {
            accounts.forEach(acc => {
                selectEl.insertAdjacentHTML('beforeend', `
                    <option value="${acc.id}">${acc.name} (${this.formatPeso(acc.balance)})</option>
                `);
            });
        }
    },

    saveAccount() {
        const name = document.getElementById('acc-name-input').value.trim();
        const type = document.getElementById('acc-type-select').value;
        const totalBalance = parseFloat(document.getElementById('acc-balance-input').value) || 0;
        const cycleDate = document.getElementById('acc-date-input').value;
        const last4 = document.getElementById('acc-digits-input')?.value.trim() || '';

        if (!name) {
            this.showToast("⚠️ Please enter an account name.");
            return;
        }

        if (!cycleDate) {
            this.showToast("⚠️ Next Allowance Date is required!");
            return;
        }

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

        this.routeSavingsToGoal(savingsAmt);

        this.state.balance = this.getCalculatedTotalBalance();
        this.state.initialAllowance = this.state.balance;

        const todayStr = formatLocalDateKey(new Date());
        if (!this.state.allowanceStartDate) {
            this.state.allowanceStartDate = todayStr;
        }
        this.state.targetAllowanceDate = cycleDate;

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
        this.state.accounts = (this.state.accounts || []).filter(a => a.id !== id);
        this.state.balance = this.getCalculatedTotalBalance();
        this.saveState();
        this.renderAccountsUI();
        this.updateHomeUI();
        this.showToast("Account removed.");
    }
});