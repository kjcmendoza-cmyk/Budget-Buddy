Object.assign(app, {
    openEditNameModal() {
    const input = document.getElementById('edit-name-input');
    if (input) input.value = this.state.userName || '';
    this.openModal('modal-edit-name');
},

confirmEditName() {
    const name = document.getElementById('edit-name-input')?.value.trim();
    if (!name) {
        this.showToast("⚠️ Please enter a valid name.");
        return;
    }
    this.state.userName = name;
    this.saveState();
    this.closeModal('modal-edit-name');
    
    const nameDisp = document.getElementById('profile-name-display');
    const lockName = document.getElementById('lock-user-name');
    if (nameDisp) nameDisp.textContent = name;
    if (lockName) lockName.textContent = name;
    this.showToast("Profile name updated!");
},
checkCycleReset() {
    if (!this.state.targetAllowanceDate || !this.state.allowanceStartDate) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0); 
    
    const endDate = parseLocalDate(this.state.targetAllowanceDate);

    // If today is past the user's custom end date, trigger the reset
    if (now > endDate) {
        // 1. Reset Balance and Expenses
        this.state.balance = this.state.initialAllowance || 0;
        this.state.recentExpenses = [];
        this.state.lastResetTimestamp = now.getTime();

        // 2. Reset Badges & Cycle Counters
        if (this.state.badges) {
            this.state.badges.forEach(b => b.unlocked = false);
        }
        this.state.affordChecksCount = 0;
        this.state.nightlyWrapCount = 0;
        this.state.wasOverspentYesterday = false;

        // 3. Calculate the length of their custom cycle
        const startDate = parseLocalDate(this.state.allowanceStartDate);
        const cycleLengthDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

        // 4. Shift dates forward for the next cycle
        const newStartDate = new Date(endDate);
        newStartDate.setDate(newStartDate.getDate() + 1); 
        this.state.allowanceStartDate = formatLocalDateKey(newStartDate);

        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + cycleLengthDays);
        this.state.targetAllowanceDate = formatLocalDateKey(newEndDate);

        // 5. Save storage & refresh UI / Charts / Badges
        if (typeof this.saveState === 'function') this.saveState();
        if (typeof this.recalculateDailyLimit === 'function') this.recalculateDailyLimit();
        if (typeof this.updateHomeUI === 'function') this.updateHomeUI();
        if (typeof this.updateGoalsUI === 'function') this.updateGoalsUI();
        if (typeof this.renderBurndownChart === 'function') this.renderBurndownChart();
        
        if (typeof this.showToast === 'function') {
            this.showToast("New cycle! Budget & achievements have reset.");
        }
    }
},

runSimulator() {
    const incomeVal = parseFloat(document.getElementById('sim-income-slider')?.value) || 0;
    const incomeFreq = document.getElementById('sim-income-freq')?.value || 'monthly';

    const expenseVal = parseFloat(document.getElementById('sim-expense-slider')?.value) || 0;
    const expenseFreq = document.getElementById('sim-expense-freq')?.value || 'monthly';

    const freqDivisors = {
        'daily': 1,
        'weekly': 7,
        'monthly': 30,
        'yearly': 365
    };

    const dailyIncome = incomeVal / freqDivisors[incomeFreq];
    const dailyExpense = expenseVal / freqDivisors[expenseFreq];

    const incValEl = document.getElementById('sim-income-val');
    const expValEl = document.getElementById('sim-expense-val');
    if (incValEl) incValEl.textContent = incomeVal.toLocaleString();
    if (expValEl) expValEl.textContent = expenseVal.toLocaleString();

    const netDailyChange = dailyIncome - dailyExpense;
    const currentLimit = this.state.dailyLimit || 0;

    const curLimitEl = document.getElementById('sim-current-limit');
    if (curLimitEl) curLimitEl.textContent = this.formatPeso(currentLimit);

    const newLimit = Math.max(0, currentLimit + netDailyChange);
    const newLimitEl = document.getElementById('sim-new-limit');
    if (newLimitEl) newLimitEl.textContent = this.formatPeso(newLimit);

    const goalImpactText = document.getElementById('sim-goal-impact');
    const approxMonthlyNet = Math.round(netDailyChange * 30);

    if (goalImpactText) {
        if (netDailyChange > 0) {
            goalImpactText.textContent = `Awesome! This adds +${this.formatPeso(Math.round(netDailyChange))}/day (+${this.formatPeso(approxMonthlyNet)}/mo) to hit your goals faster.`;
            goalImpactText.style.color = "var(--primary-green-dark)";
        } else if (netDailyChange < 0) {
            goalImpactText.textContent = `Caution: This reduces your safe limit by -${this.formatPeso(Math.abs(Math.round(netDailyChange)))}/day (-${this.formatPeso(Math.abs(approxMonthlyNet))}/mo).`;
            goalImpactText.style.color = "var(--danger-red)";
        } else {
            goalImpactText.textContent = `Your savings timeline remains unchanged.`;
            goalImpactText.style.color = "var(--text-dark)";
        }
    }
},

init() {
    this.loadState();
    this.state.balance = this.getCalculatedTotalBalance();
    this.checkCycleReset();
    const appEl = document.getElementById('app');
    const darkToggle = document.getElementById('dark-mode-toggle');
    if (this.state.darkMode) {
        appEl?.classList.add('dark-theme');
        if (darkToggle) darkToggle.classList.add('active');
    } else {
        appEl?.classList.remove('dark-theme');
        if (darkToggle) darkToggle.classList.remove('active');
    }

    this.bindEvents();
    this.checkDueExpenses();
    this.recalculateDailyLimit();
    this.updateHomeUI();
    this.updateUpcomingUI();

    if (isFirebaseActive && auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                this.state.userEmail = user.email || this.state.userEmail;
                if (user.displayName) this.state.userName = user.displayName;
                this.state.isLoggedIn = true;
                this.fetchFirestoreData(user.uid);
            }
        });
    }

    if (this.state.isLoggedIn) {
        this.showScreen('lock-screen');
    } else {
        this.showScreen('auth-screen');
    }
},

bindEvents() {
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
            const target = e.currentTarget;
            target.classList.add('selected');
            this.state.selectedCategory = target.getAttribute('data-cat');
        });
    });

    const nameInput = document.getElementById('afford-item-name');
    const priceInput = document.getElementById('afford-price');
    if (nameInput) nameInput.addEventListener('input', () => this.calculateAffordability());
    if (priceInput) priceInput.addEventListener('input', () => this.calculateAffordability());
},

formatPeso(num) {
    if (isNaN(num) || num === null || num === undefined) return "₱0";
    const cleanVal = Math.round((Number(num) + Number.EPSILON) * 100) / 100;
    return "₱" + cleanVal.toLocaleString('en-PH', { 
        minimumFractionDigits: cleanVal % 1 === 0 ? 0 : 2, 
        maximumFractionDigits: 2 
    });
},

showScreen(screenId) {
    if (screenId === 'accounts-screen') this.renderAccountsUI();
    if (screenId === 'quick-add-screen') {
        this.populateAccountDropdown();
        this.renderCategoryCapBadgesOnGrid();
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    
    const nav = document.querySelector('.bottom-nav');
    if (screenId === 'lock-screen' || screenId === 'auth-screen') {
        if (nav) nav.style.display = 'none';
        const lockName = document.getElementById('lock-user-name');
        if (lockName) lockName.textContent = this.state.userName || 'User';
    } else {
        if (nav) nav.style.display = 'flex';
    }

    const floatWidget = document.getElementById('floating-health-widget');
    if (floatWidget) {
        floatWidget.style.display = (screenId === 'home-screen') ? 'flex' : 'none';
    }

    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => item.classList.remove('active'));
    if (screenId === 'home-screen') document.querySelectorAll('.bottom-nav .nav-item')[0]?.classList.add('active');
    else if (screenId === 'insights-screen') document.querySelectorAll('.bottom-nav .nav-item')[1]?.classList.add('active');
    else if (screenId === 'goals-screen') document.querySelectorAll('.bottom-nav .nav-item')[3]?.classList.add('active');
    else if (screenId === 'profile-screen') document.querySelectorAll('.bottom-nav .nav-item')[4]?.classList.add('active');

    if (screenId === 'home-screen') {
        this.updateHomeUI();
    } else if (screenId === 'upcoming-screen') {
        this.updateUpcomingUI();
    } else if (screenId === 'history-screen') {
        this.renderHistoryUI();
    } else if (screenId === 'goals-screen') {
        this.updateGoalsUI();
    } else if (screenId === 'insights-screen') {
        this.renderInsightsCharts();
    } else if (screenId === 'afford-screen') {
        this.calculateAffordability();
    } else if (screenId === 'profile-screen') {
        const nameDisp = document.getElementById('profile-name-display');
        const emailDisp = document.getElementById('profile-email-display');
        if (nameDisp) nameDisp.textContent = this.state.userName || 'User';
        if (emailDisp) emailDisp.textContent = this.state.userEmail || 'Smart Spender';
    }
},

showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
},

openModal(id) { document.getElementById(id)?.classList.add('active'); },
closeModal(id) { document.getElementById(id)?.classList.remove('active'); },

getTodayTotal() {
    const todayKey = formatLocalDateKey(new Date());
    const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (this.state.recentExpenses || [])
        .filter(e => e.rawDate === todayKey || e.date === todayFormatted)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
},

evaluateStreak() {
    const streakText = document.getElementById('home-streak-text');
    const streakSub = document.getElementById('home-streak-sub');
    
    if (streakText && streakSub) {
        if (this.state.streakDays > 0) {
            streakText.textContent = `${this.state.streakDays}-Day Smart Spender Streak!`;
            streakSub.textContent = `Under daily limit ${this.state.streakDays} days in a row`;
        } else {
            streakText.textContent = `0-Day Smart Spender Streak!`;
            streakSub.textContent = `Start tracking to build your streak`;
        }
    }
},

generatePeerInsights() {
    const nudgeCard = document.getElementById('peer-insight-text');
    if (!nudgeCard) return;
    if ((this.state.recentExpenses || []).length === 0) {
        nudgeCard.innerHTML = `<b>Peer Insight:</b> Track your first expense to see how you compare to other students!`;
    } else {
        nudgeCard.innerHTML = `<b>Peer Insight:</b> You're doing great! Keep tracking to unlock more insights.`;
    }
},

updateMascot() {
    const todayTotal = this.getTodayTotal();
    const startOfDayLimit = this.state.startOfDayLimit || this.state.dailyLimit || 0;
    const remainingSafe = startOfDayLimit - todayTotal;
    
    const mascotBox = document.querySelector('.mascot-status-box');
    const mascotBubble = document.getElementById('mascot-bubble');
    const mascotIcon = document.getElementById('mascot-icon');
    const remValEl = document.getElementById('val-remaining');
    const spentValEl = document.getElementById('val-spent');
    const dailyLimitEl = document.getElementById('home-daily-limit');
    
    if (remValEl) {
        remValEl.textContent = this.formatPeso(remainingSafe);
        remValEl.style.color = remainingSafe < 0 ? "var(--danger-red)" : "var(--primary-green-dark)";
    }

    if (spentValEl) {
        spentValEl.textContent = this.formatPeso(todayTotal);
    }

    if (!mascotBubble) return;

    if (startOfDayLimit === 0 && todayTotal === 0) {
        mascotBubble.textContent = "Set up budget";
        if (mascotIcon) mascotIcon.textContent = "🤖";
        mascotBox?.classList.remove('over-limit');
        dailyLimitEl?.classList.remove('over-limit');
    } else if (todayTotal <= startOfDayLimit) {
        mascotBubble.textContent = "You're on track!";
        if (mascotIcon) mascotIcon.textContent = "🤖";
        mascotBox?.classList.remove('over-limit');
        dailyLimitEl?.classList.remove('over-limit');
    } else {
        mascotBubble.textContent = "Over limit!";
        if (mascotIcon) mascotIcon.textContent = "🚨";
        mascotBox?.classList.add('over-limit');
        dailyLimitEl?.classList.add('over-limit');
    }
},

generateTip() {
    const titleEl = document.getElementById('tip-title');
    const shortEl = document.getElementById('tip-short');
    const expEl = document.getElementById('tip-expanded');
    if (!titleEl || !shortEl || !expEl) return;

    const expenses = this.state.recentExpenses || [];
    const balance = this.state.balance || 0;
    const dailyLimit = this.state.dailyLimit || 0;

    if (balance === 0 && expenses.length === 0) {
        titleEl.textContent = "Welcome to BudgetBuddy!";
        shortEl.textContent = "Set your allowance to begin.";
        expEl.textContent = "Click on the 'AVAILABLE MONEY' card above to set your starting balance and schedule your next allowance date.";
        return;
    }

    if (balance > 0 && expenses.length === 0) {
        titleEl.textContent = "Allowance Set! 🎯";
        shortEl.textContent = `Safe daily limit: ${this.formatPeso(dailyLimit)}/day.`;
        expEl.textContent = `Your balance of ${this.formatPeso(balance)} is active. Log expenses using the Quick Add (+) button to start tracking!`;
        return;
    }

    const catTotals = {};
    let totalSpent = 0;
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
        totalSpent += e.amount;
    });

    let topCategory = "";
    let maxCatSpent = 0;
    for (const [cat, amt] of Object.entries(catTotals)) {
        if (amt > maxCatSpent) {
            maxCatSpent = amt;
            topCategory = cat;
        }
    }

    const todaySpent = this.getTodayTotal();

    if (todaySpent > dailyLimit && dailyLimit > 0) {
        titleEl.textContent = "⚠️ Over Daily Limit";
        shortEl.textContent = `You spent ${this.formatPeso(todaySpent - dailyLimit)} over your daily limit today.`;
        expEl.textContent = `Try cutting back on non-essential spending tomorrow to keep your daily budget balanced before your next allowance.`;
    } else if (topCategory && maxCatSpent / (totalSpent || 1) > 0.4) {
        const pct = Math.round((maxCatSpent / totalSpent) * 100);
        titleEl.textContent = `High Spending in ${topCategory}`;
        shortEl.textContent = `${topCategory} takes up ${pct}% of your total spending (${this.formatPeso(maxCatSpent)}).`;
        expEl.textContent = `Consider setting a weekly cap for ${topCategory.toLowerCase()} to free up money for your active savings goals!`;
    } else if (this.state.streakDays >= 3) {
        titleEl.textContent = "🔥 Great Momentum!";
        shortEl.textContent = `You're on a ${this.state.streakDays}-day budget streak!`;
        expEl.textContent = `Consistently staying under your daily limit ensures you can put excess funds directly into your active goals.`;
    } else {
        titleEl.textContent = "Smart Spender Tip";
        shortEl.textContent = "Keep your daily limit in check!";
        expEl.textContent = `Your current safe daily spending limit is ${this.formatPeso(dailyLimit)}/day. Log transactions immediately to stay on track.`;
    }
},

toggleTip() {
    const exp = document.getElementById('tip-expanded');
    const chev = document.getElementById('tip-chevron');
    if (!exp || !chev) return;
    if (exp.style.display === 'block') {
        exp.style.display = 'none';
        chev.classList.replace('fa-chevron-up', 'fa-chevron-down');
    } else {
        exp.style.display = 'block';
        chev.classList.replace('fa-chevron-down', 'fa-chevron-up');
    }
},

pressPin(digit) {
    if (this.state.enteredPin.length < 4) {
        this.state.enteredPin += digit;
        this.updatePinDots();
        
        if (this.state.enteredPin.length === 4) {
            setTimeout(() => {
                if (this.state.enteredPin === this.state.userPin) {
                    this.state.enteredPin = '';
                    this.updatePinDots();
                    this.showScreen('home-screen');
                    this.showToast(`Welcome back, ${this.state.userName}!`);
                } else {
                    this.triggerPinError();
                }
            }, 150);
        }
    }
},

clearPin() {
    if (this.state.enteredPin.length > 0) {
        this.state.enteredPin = this.state.enteredPin.slice(0, -1);
        this.updatePinDots();
    }
},

updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    const len = this.state.enteredPin.length;
    dots.forEach((dot, idx) => {
        if (idx < len) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled', 'error');
        }
    });
},

triggerPinError() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(dot => dot.classList.add('error'));
    this.showToast("Incorrect PIN. Try again.");
    setTimeout(() => {
        this.state.enteredPin = '';
        this.updatePinDots();
    }, 500);
},

openForgotPinModal() {
    const pInput = document.getElementById('forgot-pass-input');
    const npInput = document.getElementById('forgot-new-pin');
    if (pInput) pInput.value = '';
    if (npInput) npInput.value = '';
    this.openModal('modal-forgot-pin');
},

confirmResetPin() {
    const pass = document.getElementById('forgot-pass-input').value;
    const newPin = document.getElementById('forgot-new-pin').value.trim();

    if (pass !== this.state.userPassword) {
        this.showToast("⚠️ Incorrect account password.");
        return;
    }
    if (!newPin || newPin.length !== 4 || isNaN(newPin)) {
        this.showToast("⚠️ Please enter a valid 4-digit PIN.");
        return;
    }

    this.state.userPin = newPin;
    this.saveState();
    this.closeModal('modal-forgot-pin');
    this.showToast("PIN reset successfully!");
},

switchAuthTab(tab) {
    this.state.authTab = tab;
    document.getElementById('tab-signin')?.classList.toggle('active', tab === 'signin');
    document.getElementById('tab-signup')?.classList.toggle('active', tab === 'signup');
    const extraFields = document.getElementById('signup-extra-fields');
    if (extraFields) extraFields.style.display = tab === 'signup' ? 'block' : 'none';
    
    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) {
        submitBtn.innerHTML = tab === 'signin' 
            ? 'Sign In <i class="fa-solid fa-right-to-bracket"></i>' 
            : 'Create Account <i class="fa-solid fa-user-plus"></i>';
    }
},

async handleAuthSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;

    if (!email || !pass) {
        this.showToast("⚠️ Please enter both email and password.");
        return;
    }

    if (this.state.authTab === 'signin') {
        if (isFirebaseActive && auth) {
            try {
                const res = await auth.signInWithEmailAndPassword(email, pass);
                this.state.userEmail = res.user.email;
                this.state.isLoggedIn = true;
                this.saveState();
                await this.fetchFirestoreData(res.user.uid);
                this.showScreen('lock-screen');
                this.showToast(`Welcome back, ${this.state.userName}! Please enter your PIN.`);
            } catch (err) {
                this.showToast("⚠️ Sign In Error: " + err.message);
            }
        } else {
            if (email.toLowerCase() === this.state.userEmail.toLowerCase() && pass === this.state.userPassword) {
                this.state.isLoggedIn = true;
                this.saveState();
                this.showScreen('lock-screen');
                this.showToast(`Welcome back, ${this.state.userName}! Please enter your PIN.`);
            } else {
                this.showToast("⚠️ Invalid email or password.");
            }
        }
    } else {
        const name = document.getElementById('auth-name').value.trim();
        const pin = document.getElementById('auth-pin').value.trim();

        if (!name) return this.showToast("⚠️ Please enter your name.");
        if (!pin || pin.length !== 4 || isNaN(pin)) return this.showToast("⚠️ Please set a valid 4-digit PIN.");

        this.state.userName = name;
        this.state.userEmail = email;
        this.state.userPassword = pass;
        this.state.userPin = pin;

        if (isFirebaseActive && auth) {
            try {
                const res = await auth.createUserWithEmailAndPassword(email, pass);
                await res.user.updateProfile({ displayName: name });
                this.state.isLoggedIn = true;
                this.saveState();
                this.showScreen('lock-screen');
                this.showToast("Account registered! Please enter your PIN to continue.");
            } catch (err) {
                this.showToast("⚠️ Sign Up Error: " + err.message);
            }
        } else {
            this.state.isLoggedIn = true;
            this.saveState();
            this.showScreen('lock-screen');
            this.showToast("Account created! Please confirm your PIN.");
        }
    }
},

async logout() {
    if (isFirebaseActive && auth) {
        try { await auth.signOut(); } catch (e) { console.error(e); }
    }
    this.state.enteredPin = '';
    this.state.isLoggedIn = false;
    this.saveState();
    this.updatePinDots();
    this.showScreen('auth-screen');
    this.showToast("Logged out securely.");
},

toggleExpenseRecurringUI() {
    this.state.isRecurring = !this.state.isRecurring;
    const toggle = document.getElementById('expense-recurring-toggle');
    const options = document.getElementById('expense-recurring-options');
    const dateInput = document.getElementById('expense-first-date');

    if (toggle) toggle.classList.toggle('active', this.state.isRecurring);
    if (options) options.classList.toggle('active', this.state.isRecurring);
    if (dateInput && !dateInput.value) {
        dateInput.value = formatLocalDateKey(new Date());
    }
},

calculateMonthlyEquivalent(amount, frequency) {
    switch (frequency) {
        case 'daily': return amount * 30.4375;
        case 'weekly': return amount * 4.333;
        case 'monthly': return amount;
        case 'yearly': return amount / 12;
        default: return amount;
    }
},

saveState() {
    try {
        localStorage.setItem('budget_app_state', JSON.stringify(this.state));
        if (isFirebaseActive && db && auth && auth.currentUser) {
            db.collection('users').doc(auth.currentUser.uid).set(this.state, { merge: true })
              .catch(err => console.error("Firebase Firestore sync error:", err));
        }
    } catch (e) {
        console.error("Failed to save state:", e);
    }
},

loadState() {
    try {
        const saved = localStorage.getItem('budget_app_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            
            if (parsed.badges && parsed.badges.length < this.state.badges.length) {
                delete parsed.badges;
            }
            
            this.state = { ...this.state, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load local state:", e);
    }
},

async fetchFirestoreData(uid) {
    if (!db) return;
    try {
        db.collection('users').doc(uid).onSnapshot((doc) => {
            if (doc.exists) {
                const cloudData = doc.data();
                this.state = { ...this.state, ...cloudData };
            } else {
                this.state.recentExpenses = [];
                this.state.goals = [];
                this.state.upcomingExpenses = [];
                this.state.subscriptions = [];
                this.state.balance = 0;
            }

            localStorage.setItem('budget_app_state', JSON.stringify(this.state));

            this.recalculateDailyLimit();
            this.updateHomeUI();
            this.updateUpcomingUI();
            if (this.charts && this.charts.burndown) {
                this.renderBurndownChart();
            }
        }, (err) => {
            console.warn("Firestore listener error:", err);
        });
    } catch (err) {
        console.warn("Could not attach Firestore listener:", err);
    }
},

recalculateDailyLimit() {
    const daysLeft = getDaysLeft(this.state.targetAllowanceDate) || 1; 
    this.state.remainingDays = daysLeft;
    
    // 1. Calculate total reserved money for pending upcoming bills
    const totalReserved = (this.state.upcomingExpenses || [])
        .filter(e => e.status === 'pending')
        .reduce((sum, e) => safeAdd(sum, e.amount || 0), 0);

    // 2. Spent Today
    const spentToday = this.getTodayTotal();

    // 3. Start of Day Baseline Target (rounded whole pesos)
    const startOfDayBalance = safeAdd(this.state.balance, spentToday);
    const startOfDayAvailable = Math.max(0, safeSub(startOfDayBalance, totalReserved));
    const startOfDayLimit = Math.round(startOfDayAvailable / daysLeft);

    // 4. Current Dynamic Pace across remaining days
    const currentAvailable = Math.max(0, safeSub(this.state.balance, totalReserved));
    const dynamicPace = Math.round(currentAvailable / daysLeft);

    // Store startOfDayLimit for today's "Remaining Today" baseline
    this.state.startOfDayLimit = startOfDayLimit;

    // 5. Logic Rule: If overspent today, immediately drop "Safe to Spend" to dynamic pace.
    // Otherwise, hold at startOfDayLimit until midnight reset.
    if (spentToday > startOfDayLimit) {
        this.state.dailyLimit = dynamicPace;
    } else {
        this.state.dailyLimit = startOfDayLimit;
    }

    const limitEl = document.getElementById('home-daily-limit');
    if (limitEl) limitEl.textContent = this.formatPeso(this.state.dailyLimit);
    
    if (typeof this.updateMascot === 'function') this.updateMascot();
},

getAllowanceTargetDate() {
    if (this.state.targetAllowanceDate) {
        const rawDate = parseLocalDate(this.state.targetAllowanceDate);
        if (!isNaN(rawDate.getTime())) {
            return rawDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        }
    }
    return "Not set";
},

checkDueExpenses() {
    const today = formatLocalDateKey(new Date());

    if (!this.state.upcomingExpenses) return;

    this.state.upcomingExpenses.forEach(exp => {
        if (exp.status === 'pending') {
            if (exp.date <= today) {
                if (exp.mode === 'auto') {
                    this.autoLogExpense(exp);
                }
            }
        }
    });
},

spawnNextRecurringInstance(exp) {
    if (exp && exp.cycle && exp.cycle !== 'one-time') {
        const nextDate = getNextCycleDate(exp.date, exp.cycle);
        if (nextDate) {
            const nextExp = {
                id: Date.now() + Math.random(),
                name: exp.name,
                date: nextDate,
                amount: exp.amount,
                mode: exp.mode,
                cycle: exp.cycle,
                status: 'pending',
                icon: exp.icon || (exp.mode === 'auto' ? 'fa-robot' : 'fa-bell')
            };
            this.state.upcomingExpenses.push(nextExp);
        }
    }
},

autoLogExpense(exp) {
    exp.status = 'auto-logged';
    exp.loggedAt = Date.now(); 

    const newExp = {
        id: Date.now() + Math.random(),
        name: exp.name + " (Auto)",
        category: "Bills",
        amount: exp.amount,
        icon: exp.icon || 'fa-robot',
        color: "var(--accent-orange)",
        period: 'Today',
        rawDate: formatLocalDateKey(new Date()),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isAutoLogged: true,
        linkedId: exp.id
    };
    
    this.state.recentExpenses.unshift(newExp);

    if (this.state.accounts && this.state.accounts.length > 0) {
        this.state.accounts[0].balance = Math.max(0, safeSub(this.state.accounts[0].balance, exp.amount));
        this.state.balance = this.getCalculatedTotalBalance();
    } else {
        this.state.balance = Math.max(0, safeSub(this.state.balance, exp.amount));
    }

    this.spawnNextRecurringInstance(exp);
    this.saveState();
},

undoAutoLog(id) {
    const exp = this.state.upcomingExpenses.find(e => e.id === id);
    if (exp) {
        exp.status = 'pending';
        delete exp.loggedAt;
        
        if (this.state.accounts && this.state.accounts.length > 0) {
            this.state.accounts[0].balance = safeAdd(this.state.accounts[0].balance, exp.amount);
            this.state.balance = this.getCalculatedTotalBalance();
        } else {
            this.state.balance = safeAdd(this.state.balance, exp.amount);
        }

        this.state.recentExpenses = this.state.recentExpenses.filter(r => !(r.isAutoLogged && r.linkedId === exp.id));

        const nextDate = getNextCycleDate(exp.date, exp.cycle);
        if (nextDate) {
            this.state.upcomingExpenses = this.state.upcomingExpenses.filter(e => !(e.name === exp.name && e.date === nextDate && e.status === 'pending'));
        }

        this.saveState();
        this.recalculateDailyLimit();
        this.updateHomeUI();
        this.updateUpcomingUI();
        this.showToast("Auto-log undone.");
    }
},

confirmManualExpense(id, amount) {
    const exp = this.state.upcomingExpenses.find(e => e.id === id);
    if (exp) {
        exp.status = 'confirmed';

        if (this.state.accounts && this.state.accounts.length > 0) {
            this.state.accounts[0].balance = Math.max(0, safeSub(this.state.accounts[0].balance, amount));
            this.state.balance = this.getCalculatedTotalBalance();
        } else {
            this.state.balance = Math.max(0, safeSub(this.state.balance, amount));
        }
        
        const newExp = {
            id: Date.now() + Math.random(),
            name: exp.name,
            category: "Bills",
            amount: amount,
            icon: exp.icon || 'fa-file-invoice-dollar',
            color: "var(--secondary-purple)",
            period: 'Today',
            rawDate: formatLocalDateKey(new Date()),
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
        this.state.recentExpenses.unshift(newExp);

        this.spawnNextRecurringInstance(exp);

        this.saveState();
        this.recalculateDailyLimit();
        this.updateHomeUI();
        this.updateUpcomingUI();
        this.showToast("Expense confirmed & logged!");
    }
},

editManualExpense(id) {
    const exp = this.state.upcomingExpenses.find(e => e.id === id);
    if (exp) {
        const nameEl = document.getElementById('sched-name');
        const dateEl = document.getElementById('sched-date');
        const amtEl = document.getElementById('sched-amount');
        const cycleEl = document.getElementById('sched-cycle');
        const modeEl = document.getElementById('sched-mode');
        
        if (nameEl) nameEl.value = exp.name;
        if (dateEl) dateEl.value = exp.date;
        if (amtEl) amtEl.value = exp.amount;
        if (cycleEl) cycleEl.value = exp.cycle || 'monthly';
        if (modeEl) modeEl.value = exp.mode || 'auto';

        this.deleteUpcomingExpense(id);
        this.showScreen('upcoming-screen');
        this.showToast(`Loaded ${exp.name} for editing.`);
    }
},

dismissManualExpense(id) {
    this.deleteUpcomingExpense(id);
    this.showToast("Reminder dismissed.");
},

renderActionableNotifications() {
    const bannerContainer = document.getElementById('home-action-banners');
    const autoContainer = document.getElementById('home-auto-logged');
    const autoList = document.getElementById('auto-logged-list');

    if (!bannerContainer || !autoContainer || !autoList) return;

    bannerContainer.innerHTML = '';
    autoList.innerHTML = '';
    let hasAuto = false;

    const today = formatLocalDateKey(new Date());

    const pendingBanners = this.state.upcomingExpenses.filter(exp => 
        exp.status === 'pending' && exp.mode === 'manual' && exp.date <= today
    );

    pendingBanners.sort((a, b) => (a.date < today ? -1 : 1));

    pendingBanners.forEach(exp => {
        const isOverdue = exp.date < today;
        const bannerClass = isOverdue ? 'action-banner overdue-banner' : 'action-banner';
        const iconClass = isOverdue ? 'fa-solid fa-triangle-exclamation text-red' : 'fa-regular fa-bell text-accent-orange';
        const headerText = isOverdue ? `OVERDUE: ${exp.name}` : `Due Today: ${exp.name}`;
        const cycleLabel = exp.cycle && exp.cycle !== 'one-time' ? ` (${exp.cycle})` : '';
        
        const html = `
            <div class="${bannerClass}">
                <div class="flex justify-between items-center">
                    <div>
                        <h4 style="display:flex; align-items:center; gap:6px;">
                            ${headerText}${cycleLabel}
                        </h4>
                        <p class="text-xs text-gray mt-1">Due: ${exp.date} • Expected: ${this.formatPeso(exp.amount)}</p>
                    </div>
                    <i class="${iconClass} text-lg"></i>
                </div>
                <div class="action-banner-actions">
                    <button class="action-banner-btn btn-confirm-expense" onclick="app.confirmManualExpense(${exp.id}, ${exp.amount})">Confirm ${this.formatPeso(exp.amount)}</button>
                    <button class="action-banner-btn btn-edit-expense" onclick="app.editManualExpense(${exp.id})">Edit</button>
                    ${isOverdue ? `<button class="action-banner-btn btn-dismiss-expense" onclick="app.dismissManualExpense(${exp.id})">Dismiss</button>` : ''}
                </div>
            </div>
        `;
        bannerContainer.insertAdjacentHTML('beforeend', html);
    });

    this.state.upcomingExpenses.forEach(exp => {
        if (exp.status === 'auto-logged' && exp.loggedAt) {
            const hoursSince = (Date.now() - exp.loggedAt) / (1000 * 60 * 60);
            if (hoursSince <= 48) {
                hasAuto = true;
                const html = `
                    <div class="transaction-item" style="background: var(--accent-orange-light); padding: 10px; border-radius: 12px; border: 1px dashed var(--accent-orange);">
                        <div class="tx-left">
                            <div class="tx-icon" style="color: var(--accent-orange);"><i class="fa-solid fa-robot"></i></div>
                            <div class="tx-details">
                                <h4>${exp.name}</h4>
                                <p>Auto-logged ${Math.floor(hoursSince)}h ago</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="tx-amount deduct">−${this.formatPeso(exp.amount)}</span>
                            <button onclick="app.undoAutoLog(${exp.id})" style="background: var(--card-bg); border: 1px solid var(--border-color); padding: 5px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 700; cursor: pointer; color: var(--danger-red);">Undo</button>
                        </div>
                    </div>
                `;
                autoList.insertAdjacentHTML('beforeend', html);
            } else {
                exp.status = 'confirmed';
                this.saveState();
            }
        }
    });

    autoContainer.style.display = hasAuto ? 'block' : 'none';
},

scheduleNewExpense() {
    const name = document.getElementById('sched-name').value.trim();
    const date = document.getElementById('sched-date').value;
    const cycle = document.getElementById('sched-cycle').value;
    const amount = parseFloat(document.getElementById('sched-amount').value);
    const mode = document.getElementById('sched-mode').value;

    if (!name || !date || isNaN(amount) || amount <= 0) {
        this.showToast("Please fill all fields correctly.");
        return;
    }

    const newExp = {
        id: Date.now(),
        name, 
        date,
        cycle: cycle || 'one-time', 
        amount, 
        mode,
        status: 'pending',
        icon: mode === 'auto' ? 'fa-robot' : 'fa-bell'
    };

    this.state.upcomingExpenses.push(newExp);
    this.saveState();
    
    this.checkDueExpenses();
    this.recalculateDailyLimit();
    this.updateUpcomingUI();
    this.updateHomeUI();

    document.getElementById('sched-name').value = '';
    document.getElementById('sched-date').value = '';
    document.getElementById('sched-amount').value = '';
    this.showToast("Expense scheduled!");
},

deleteUpcomingExpense(id) {
    this.state.upcomingExpenses = this.state.upcomingExpenses.filter(e => e.id !== id);
    this.saveState();
    this.recalculateDailyLimit();
    this.updateHomeUI();
    this.updateUpcomingUI();
    this.showToast("Scheduled expense removed.");
},

prevCalMonth() {
    this.state.calMonth--;
    if (this.state.calMonth < 0) {
        this.state.calMonth = 11;
        this.state.calYear--;
    }
    this.renderCalendar();
},

nextCalMonth() {
    this.state.calMonth++;
    if (this.state.calMonth > 11) {
        this.state.calMonth = 0;
        this.state.calYear++;
    }
    this.renderCalendar();
},

selectCalendarDate(dateStr) {
    if (this.state.calSelectedDate === dateStr) {
        this.state.calSelectedDate = null;
    } else {
        this.state.calSelectedDate = dateStr;
    }
    this.renderCalendar();
    this.renderUpcomingList();
},

clearCalendarFilter() {
    this.state.calSelectedDate = null;
    this.renderCalendar();
    this.renderUpcomingList();
},

toggleCalendarCollapse() {
    this.state.isCalendarCollapsed = !this.state.isCalendarCollapsed;
    this.applyCalendarCollapseState();
    this.saveState();
},

applyCalendarCollapseState() {
    const body = document.getElementById('calendar-body');
    const icon = document.getElementById('cal-collapse-icon');
    
    const isCollapsed = this.state.isCalendarCollapsed !== false;

    if (body) {
        body.style.display = isCollapsed ? 'none' : 'block';
    }
    if (icon) {
        icon.className = isCollapsed 
            ? 'fa-solid fa-chevron-right text-xs text-gray' 
            : 'fa-solid fa-chevron-down text-xs text-gray';
    }
},

renderCalendar() {
    const monthTitle = document.getElementById('cal-month-year-title');
    const grid = document.getElementById('calendar-grid');
    const filterStatus = document.getElementById('cal-filter-status');
    const filterText = document.getElementById('cal-filter-text');

    if (!monthTitle || !grid) return;

    this.applyCalendarCollapseState();

    const year = this.state.calYear;
    const month = this.state.calMonth;
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    monthTitle.textContent = `${monthNames[month]} ${year}`;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const firstDayIndex = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = formatLocalDateKey(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
        grid.insertAdjacentHTML('beforeend', `<div class="cal-day-cell empty"></div>`);
    }

    for (let day = 1; day <= totalDays; day++) {
        const dayFormatted = String(day).padStart(2, '0');
        const monthFormatted = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;

        const billsForDay = (this.state.upcomingExpenses || []).filter(e => e.status === 'pending' && e.date === dateStr);
        const hasOverdue = billsForDay.some(e => e.date < todayStr);
        const hasAuto = billsForDay.some(e => e.mode === 'auto');
        const hasHybrid = billsForDay.some(e => e.mode === 'manual');

        let cellClasses = "cal-day-cell";
        if (dateStr === todayStr) cellClasses += " today";
        if (hasOverdue) cellClasses += " has-overdue";
        if (this.state.calSelectedDate === dateStr) cellClasses += " selected";

        let dotsHtml = '';
        if (billsForDay.length > 0) {
            dotsHtml += '<div class="dot-container">';
            if (hasOverdue) dotsHtml += '<div class="cal-dot overdue"></div>';
            else {
                if (hasAuto) dotsHtml += '<div class="cal-dot auto"></div>';
                if (hasHybrid) dotsHtml += '<div class="cal-dot hybrid"></div>';
            }
            dotsHtml += '</div>';
        }

        const cellHtml = `
            <div class="${cellClasses}" onclick="app.selectCalendarDate('${dateStr}')">
                <span>${day}</span>
                ${dotsHtml}
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', cellHtml);
    }

    if (filterStatus && filterText) {
        if (this.state.calSelectedDate) {
            filterStatus.style.display = 'flex';
            filterText.textContent = `Showing bills for ${this.state.calSelectedDate}`;
        } else {
            filterStatus.style.display = 'none';
        }
    }
},

renderUpcomingList() {
    const upcomingList = document.getElementById('upcoming-screen-list');
    const screenTotal = document.getElementById('upcoming-screen-total');
    if (!upcomingList) return;

    upcomingList.innerHTML = '';
    const todayStr = formatLocalDateKey(new Date());

    let expensesToDisplay = this.state.upcomingExpenses.filter(e => e.status === 'pending');

    if (this.state.calSelectedDate) {
        expensesToDisplay = expensesToDisplay.filter(e => e.date === this.state.calSelectedDate);
    }

    expensesToDisplay.sort((a, b) => a.date.localeCompare(b.date));

    let totalReserved = 0;
    this.state.upcomingExpenses.forEach(exp => {
        if (exp.status === 'pending') totalReserved += exp.amount;
    });
    if (screenTotal) screenTotal.textContent = `Total reserved ${this.formatPeso(totalReserved)}`;

    if (expensesToDisplay.length === 0) {
        upcomingList.innerHTML = `
            <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-gray);">
                <i class="fa-regular fa-calendar-check" style="font-size: 1.8rem; margin-bottom: 8px; opacity: 0.5; color: var(--primary-green);"></i>
                <p style="font-size: 0.85rem; font-weight: 700;">All caught up!</p>
                <p style="font-size: 0.72rem; margin-top: 2px;">
                    ${this.state.calSelectedDate ? 'No upcoming bills on this date.' : 'No pending bills reserved.'}
                </p>
            </div>
        `;
        return;
    }

    expensesToDisplay.forEach(exp => {
        const isOverdue = exp.date < todayStr;
        const modeIcon = exp.mode === 'auto' ? 'fa-robot' : (isOverdue ? 'fa-circle-exclamation text-red' : 'fa-bell text-orange');
        const modeBadge = exp.mode === 'auto' ? 
            `<span class="badge-hybrid auto"><i class="fa-solid fa-robot"></i> Auto</span>` : 
            (isOverdue ? `<span class="badge-hybrid overdue"><i class="fa-solid fa-triangle-exclamation"></i> Overdue</span>` : `<span class="badge-hybrid manual"><i class="fa-solid fa-bell"></i> Hybrid</span>`);
        
        const cycleLabel = exp.cycle && exp.cycle !== 'one-time' ? ` • ${exp.cycle}` : '';

        const html = `
            <div class="transaction-item">
                <div class="tx-left">
                    <div class="tx-icon" style="color:${isOverdue ? 'var(--danger-red)' : 'var(--accent-orange)'}">
                        <i class="fa-solid ${modeIcon}"></i>
                    </div>
                    <div class="tx-details">
                        <h4>${exp.name}${modeBadge}</h4>
                        <p>${exp.date}${cycleLabel}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="tx-amount deduct">−${this.formatPeso(exp.amount)}</span>
                    <button class="delete-btn" onclick="app.deleteUpcomingExpense(${exp.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
        upcomingList.insertAdjacentHTML('beforeend', html);
    });
},

updateUpcomingUI() {
    this.renderCalendar();
    this.renderUpcomingList();
},

updateHomeUI() {
    const currentHour = new Date().getHours();
    const todayDateStr = formatLocalDateKey(new Date());

    if (currentHour >= 20 && this.state.lastNightlyCheckDate !== todayDateStr) {
        this.state.nightlyWrapCount = (this.state.nightlyWrapCount || 0) + 1;
        this.state.lastNightlyCheckDate = todayDateStr;
        this.saveState();
    }
    this.renderActionableNotifications();

    const todayKey = formatLocalDateKey(new Date());

    const spentToday = (this.state.recentExpenses || [])
        .filter(exp => exp.rawDate === todayKey || exp.date === new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
        .reduce((sum, exp) => sum + exp.amount, 0);

    const startOfDayLimit = this.state.startOfDayLimit || this.state.dailyLimit || 0;
    const dailyLimitVal = this.state.dailyLimit || 0;
    const remainingSafeToday = startOfDayLimit - spentToday;

    const balEl = document.getElementById('home-balance');
    if (balEl) balEl.textContent = this.formatPeso(this.state.balance);

    const limitEl = document.getElementById('home-daily-limit');
    if (limitEl) {
        limitEl.textContent = this.formatPeso(dailyLimitVal);
    }

    const safeRemEl = document.getElementById('home-safe-remaining');
    if (safeRemEl) {
        if (remainingSafeToday < 0) {
            safeRemEl.innerHTML = `<span style="color: var(--danger-red); font-weight: 700;">Over by ${this.formatPeso(Math.abs(remainingSafeToday))}</span> <span class="spent-subtext">(Target: ${this.formatPeso(startOfDayLimit)}/day)</span>`;
        } else {
            safeRemEl.innerHTML = `<span style="color: var(--primary-green-dark); font-weight: 700;">${this.formatPeso(remainingSafeToday)} left today</span> <span class="spent-subtext">(Target: ${this.formatPeso(startOfDayLimit)}/day)</span>`;
        }
    }

    const targetDateEl = document.getElementById('home-target-date');
    if (targetDateEl) targetDateEl.textContent = this.getAllowanceTargetDate();

    const daysLeftEl = document.getElementById('home-days-left');
    if (daysLeftEl) {
        const days = getDaysLeft(this.state.targetAllowanceDate);
        daysLeftEl.textContent = `${days} day${days === 1 ? '' : 's'} left`;
    }

    this.evaluateStreak();
    this.updateHealthScoreUI();
    this.generateTip();

    this.filterRecentSpending(document.getElementById('recent-filter-select')?.value || 'Today');

    const upcomingList = document.getElementById('home-upcoming-list');
    if (upcomingList) {
        upcomingList.innerHTML = '';
        const pendingList = this.state.upcomingExpenses ? this.state.upcomingExpenses.filter(e => e.status === 'pending') : [];
        pendingList.sort((a, b) => a.date.localeCompare(b.date));

        if (pendingList.length === 0) {
            upcomingList.innerHTML = `<div class="text-center p-3 text-gray text-xs">No upcoming bills reserved</div>`;
        } else {
            const todayStr = formatLocalDateKey(new Date());
            pendingList.slice(0, 3).forEach(exp => {
                const isOverdue = exp.date < todayStr;
                const modeBadge = exp.mode === 'auto' ? 
                    `<span class="badge-hybrid auto"><i class="fa-solid fa-robot"></i> Auto</span>` : 
                    (isOverdue ? `<span class="badge-hybrid overdue"><i class="fa-solid fa-triangle-exclamation"></i> Overdue</span>` : `<span class="badge-hybrid manual"><i class="fa-solid fa-bell"></i> Hybrid</span>`);

                const html = `
                    <div class="transaction-item">
                        <div class="tx-left">
                            <div class="tx-icon" style="color:var(--accent-orange)"><i class="fa-regular fa-calendar"></i></div>
                            <div class="tx-details">
                                <h4>${exp.name}${modeBadge}</h4>
                                <p>Due ${exp.date}</p>
                            </div>
                        </div>
                        <span class="tx-amount deduct">−${this.formatPeso(exp.amount)}</span>
                    </div>
                `;
                upcomingList.insertAdjacentHTML('beforeend', html);
            });
        }
    }
},

saveExpense() {
    const amtInput = document.getElementById('expense-amount');
    const noteInput = document.getElementById('expense-note');
    const amount = parseFloat(amtInput.value);

    if (isNaN(amount) || amount <= 0) {
        this.showToast("⚠️ Please enter a valid amount.");
        return;
    }

    const catIcons = {
        'Food': 'fa-burger',
        'Transport': 'fa-car-side',
        'Coffee': 'fa-mug-hot',
        'School': 'fa-graduation-cap',
        'Shopping': 'fa-bag-shopping',
        'Entertainment': 'fa-gamepad',
        'Other': 'fa-ellipsis'
    };

    const localIsoDate = formatLocalDateKey(new Date());
    const expenseName = noteInput.value.trim() || this.state.selectedCategory;
    const selectedAccId = document.getElementById('expense-account-select')?.value;

    const oldDailyLimit = this.state.dailyLimit || 0;

    const newTx = {
        id: Date.now(),
        name: expenseName,
        category: this.state.selectedCategory,
        amount: amount,
        accountId: selectedAccId,
        icon: catIcons[this.state.selectedCategory] || 'fa-receipt',
        color: "var(--primary-green)",
        period: 'Today',
        rawDate: localIsoDate,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };

    if (!this.state.recentExpenses) this.state.recentExpenses = [];
    this.state.recentExpenses.unshift(newTx);

    const targetAccount = (this.state.accounts || []).find(a => a.id === selectedAccId);
    if (targetAccount) {
        targetAccount.balance = Math.max(0, safeSub(targetAccount.balance, amount));
    }

    if (this.state.accounts && this.state.accounts.length > 0) {
        this.state.balance = this.getCalculatedTotalBalance();
    } else {
        this.state.balance = Math.max(0, safeSub(this.state.balance, amount));
    }

    this.checkCategoryCapAlert(this.state.selectedCategory, amount);
    this.saveState();
    this.recalculateDailyLimit();
    this.updateHomeUI();

    amtInput.value = '';
    noteInput.value = '';

    this.showPostActionImpactSheet(expenseName, amount, oldDailyLimit);
},

showPostActionImpactSheet(name, amount, oldLimit) {
    const spentToday = this.getTodayTotal();
    const newDailyLimit = this.state.dailyLimit || 0;
    const remainingSafeToday = Math.max(0, newDailyLimit - spentToday);
    const isOverLimit = spentToday > oldLimit;

    const iconEl = document.getElementById('impact-icon-wrapper');
    const titleEl = document.getElementById('impact-title');
    const spentValEl = document.getElementById('impact-spent-val');
    const safeTodayEl = document.getElementById('impact-safe-today');
    const newDailyEl = document.getElementById('impact-new-daily');

    if (iconEl) iconEl.textContent = isOverLimit ? "🚨" : "🟢";
    if (titleEl) titleEl.textContent = isOverLimit ? "Daily Limit Exceeded!" : `Logged ${this.formatPeso(amount)}`;
    if (spentValEl) spentValEl.textContent = `-${this.formatPeso(amount)}`;
    if (safeTodayEl) {
        safeTodayEl.textContent = this.formatPeso(remainingSafeToday);
        safeTodayEl.style.color = remainingSafeToday <= 0 ? "var(--danger-red)" : "var(--text-dark)";
    }
    if (newDailyEl) {
        newDailyEl.textContent = `${this.formatPeso(newDailyLimit)}/day`;
        newDailyEl.style.color = newDailyLimit < oldLimit ? "var(--accent-orange)" : "var(--primary-green-dark)";
    }

    this.openModal('modal-impact-feedback');
},

filterRecentSpending(filterVal) {
    const container = document.getElementById('recent-spending-list');
    if (!container) return;
    container.innerHTML = '';

    const todayKey = formatLocalDateKey(new Date());
    const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const filtered = this.state.recentExpenses.filter(exp => {
        if (filterVal === 'Today') {
            return exp.rawDate === todayKey || exp.date === todayFormatted;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 1.25rem 1rem; color: var(--text-gray);">
                <i class="fa-solid fa-receipt" style="font-size: 1.5rem; margin-bottom: 6px; opacity: 0.4;"></i>
                <p style="font-size: 0.8rem; font-weight: 700;">No expenses logged for ${filterVal}</p>
            </div>
        `;
        return;
    }

    filtered.slice(0, 2).forEach(exp => {
        const html = `
            <div class="transaction-item">
                <div class="tx-left">
                    <div class="tx-icon"><i class="fa-solid ${exp.icon || 'fa-receipt'}"></i></div>
                    <div class="tx-details">
                        <h4>${exp.name}</h4>
                        <p>${exp.category} • ${exp.date}</p>
                    </div>
                </div>
                <span class="tx-amount deduct">−${this.formatPeso(exp.amount)}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
},

renderHistoryUI() {
    const container = document.getElementById('full-history-list');
    const searchVal = document.getElementById('history-search-input')?.value.toLowerCase() || '';
    const catVal = document.getElementById('history-category-filter')?.value || 'All';

    if (!container) return;
    container.innerHTML = '';

    const filtered = (this.state.recentExpenses || []).filter(exp => {
        const matchesSearch = exp.name.toLowerCase().includes(searchVal) || exp.category.toLowerCase().includes(searchVal);
        const matchesCat = catVal === 'All' || exp.category === catVal;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem 1rem; color: var(--text-gray);">
                <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
                <p style="font-size: 0.85rem; font-weight: 700;">No transactions found</p>
                <p style="font-size: 0.75rem; margin-top: 4px;">Try adjusting your search query or category filter.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(exp => {
        const html = `
            <div class="transaction-item">
                <div class="tx-left">
                    <div class="tx-icon"><i class="fa-solid ${exp.icon || 'fa-receipt'}"></i></div>
                    <div class="tx-details">
                        <h4>${exp.name}</h4>
                        <p>${exp.category} • ${exp.date}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="tx-amount deduct">−${this.formatPeso(exp.amount)}</span>
                    <button class="delete-btn" onclick="app.deleteExpense(${exp.id})" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
},

deleteExpense(id) {
    const exp = this.state.recentExpenses.find(e => e.id === id);
    if (exp) {
        let targetAccount = (this.state.accounts || []).find(a => a.id === exp.accountId);
        if (!targetAccount && this.state.accounts && this.state.accounts.length > 0) {
            targetAccount = this.state.accounts[0];
        }
        if (targetAccount) {
            targetAccount.balance = safeAdd(targetAccount.balance, exp.amount);
            this.state.balance = this.getCalculatedTotalBalance();
        } else {
            this.state.balance = safeAdd(this.state.balance, exp.amount);
        }

        this.state.recentExpenses = this.state.recentExpenses.filter(e => e.id !== id);

        this.saveState();
        this.recalculateDailyLimit();
        this.renderHistoryUI();
        this.renderAccountsUI();
        this.updateHomeUI();
        this.showToast("Transaction deleted.");
    }
},

calculateAffordability() {
    const priceInput = document.getElementById('afford-price');
    const price = parseFloat(priceInput?.value) || 0;
    const buyNowBtn = document.getElementById('afford-buy-now-btn');

    if (price > 0) {
        this.state.affordChecksCount = (this.state.affordChecksCount || 0) + 1;
        this.saveState();
    }

    const curBalEl = document.getElementById('afford-current-bal');
    const purAmtEl = document.getElementById('afford-purchase-amt');
    const newBalEl = document.getElementById('afford-new-bal');
    const befLimitEl = document.getElementById('afford-before-limit');
    const aftLimitEl = document.getElementById('afford-after-limit');
    const msgEl = document.getElementById('afford-result-msg');

    const curBal = this.state.balance;
    const newBal = curBal - price;
    const remDays = Math.max(1, this.state.remainingDays || 1);
    
    const beforeLimit = this.state.dailyLimit;
    const afterLimit = Math.max(0, Math.round(newBal / remDays));

    if (curBalEl) curBalEl.textContent = this.formatPeso(curBal);
    if (purAmtEl) purAmtEl.textContent = `-${this.formatPeso(price)}`;
    if (newBalEl) newBalEl.textContent = this.formatPeso(newBal);
    if (befLimitEl) befLimitEl.textContent = `${this.formatPeso(beforeLimit)}/day`;
    if (aftLimitEl) aftLimitEl.textContent = `${this.formatPeso(afterLimit)}/day`;

    if (!msgEl) return;
    if (price <= 0) {
        msgEl.className = "result-msg";
        msgEl.textContent = "Enter an item and price to check your budget impact.";
        if (buyNowBtn) buyNowBtn.style.display = "none";
    } else if (newBal < 0) {
        msgEl.className = "result-msg warning";
        msgEl.textContent = "⚠️ Over budget! This purchase exceeds your total remaining balance.";
        if (buyNowBtn) buyNowBtn.style.display = "none";
    } else if (afterLimit < 50) {
        msgEl.className = "result-msg warning";
        msgEl.textContent = "⚠️ Careful! This will cut your daily allowance to under ₱50/day.";
        if (buyNowBtn) buyNowBtn.style.display = "flex";
    } else {
        msgEl.className = "result-msg";
        msgEl.textContent = `👍 You can afford this! Your daily limit will adjust to ${this.formatPeso(afterLimit)}/day.`;
        if (buyNowBtn) buyNowBtn.style.display = "flex";
    }
},

logAffordedExpense() {
    const itemName = document.getElementById('afford-item-name')?.value.trim() || 'Shopping Item';
    const price = parseFloat(document.getElementById('afford-price')?.value) || 0;

    if (price <= 0) return;

    const amtInput = document.getElementById('expense-amount');
    const noteInput = document.getElementById('expense-note');
    if (amtInput) amtInput.value = price;
    if (noteInput) noteInput.value = itemName;

    this.saveExpense();

    document.getElementById('afford-item-name').value = '';
    document.getElementById('afford-price').value = '';
},

triggerConfettiCelebration() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    },

    checkAchievements() {
    if (!this.state.badges) return;

    const unlock = (id) => {
        const badge = this.state.badges.find(b => b.id === id);
        if (badge && !badge.unlocked) {
            badge.unlocked = true;
            this.triggerConfettiCelebration();
            this.showToast(`🏆 Badge Unlocked: ${badge.name}!`);
        }
    };

    if (this.state.goals && this.state.goals.length > 0) unlock(1);
    if (this.state.streakDays >= 5) unlock(2);
    if ((this.state.nightlyWrapCount || 0) >= 3) unlock(3);
    if ((this.state.affordChecksCount || 0) >= 3) unlock(4);
    if (this.state.wasOverspentYesterday && this.getTodayTotal() <= this.state.dailyLimit && this.getTodayTotal() > 0) unlock(5);

    const totalSaved = (this.state.goals || []).reduce((sum, g) => sum + g.current, 0);
    if (totalSaved >= 1000) unlock(6);
    if ((this.state.upcomingExpenses || []).length >= 3) unlock(7);

    const health = this.calculateFinancialHealthScore();
    if (health && health.score >= 80) unlock(8);
},

toggleBadgesCollapse() {
    this.state.badgesCollapsed = !this.state.badgesCollapsed;
    this.saveState();
    this.updateGoalsUI();
},

updateGoalsUI() {
    this.checkAchievements();

    const totalSavedEl = document.getElementById('goals-total-saved');
    const listEl = document.getElementById('goals-list');
    const badgesContainer = document.getElementById('badges-container');
    const toggleBtn = document.getElementById('toggle-badges-btn');

    let totalSaved = 0;
    if (this.state.goals) {
        this.state.goals.forEach(g => totalSaved += g.current);
    }
    if (totalSavedEl) totalSavedEl.textContent = this.formatPeso(totalSaved);

    if (toggleBtn) {
        toggleBtn.textContent = this.state.badgesCollapsed ? "Show All" : "Show Less";
    }

    if (badgesContainer) {
        badgesContainer.innerHTML = '';
        this.state.badges.forEach((b, idx) => {
            const isHidden = this.state.badgesCollapsed && idx >= 3;
            const html = `
                <div class="badge-box ${b.unlocked ? 'unlocked' : ''}" style="${!b.unlocked ? 'opacity: 0.45; filter: grayscale(100%);' : ''} ${isHidden ? 'display: none;' : ''}">
                    <div class="badge-icon">${b.unlocked ? b.icon : '🔒'}</div>
                    <div style="font-size:0.75rem; font-weight:800;">${b.name}</div>
                    <div style="font-size:0.65rem; color:var(--text-gray);">${b.desc}</div>
                </div>
            `;
            badgesContainer.insertAdjacentHTML('beforeend', html);
        });
    }

    if (listEl) {
        listEl.innerHTML = '';
        if (!this.state.goals || this.state.goals.length === 0) {
            listEl.innerHTML = `<div class="text-center p-4 text-gray text-xs">No active savings goals. Click "+ New" to add one!</div>`;
            return;
        }

        this.state.goals.forEach(g => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const html = `
                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-title">${g.name}</span>
                        <div class="goal-icon"><i class="fa-solid fa-bullseye text-purple"></i></div>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${pct}%; background: var(--primary-green);"></div>
                    </div>
                    <div class="goal-stats">
                        <span>${this.formatPeso(g.current)} of ${this.formatPeso(g.target)}</span>
                        <span>${pct}%</span>
                    </div>
                    <div class="goal-actions">
                        <button onclick="app.openAddFundsModal(${g.id})" style="background:var(--primary-green-light); color:var(--primary-green-dark); border:none; padding:6px 12px; border-radius:8px; font-weight:700; cursor:pointer; font-size:0.75rem;">+ Add Funds</button>
                        <button class="delete-btn" onclick="app.deleteGoal(${g.id})"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
            listEl.insertAdjacentHTML('beforeend', html);
        });
    }
},

openAddGoalModal() {
    document.getElementById('new-goal-name').value = '';
    document.getElementById('new-goal-target').value = '';
    this.openModal('modal-add-goal');
},

confirmAddGoal() {
    const name = document.getElementById('new-goal-name').value.trim();
    const target = parseFloat(document.getElementById('new-goal-target').value);

    if (!name || isNaN(target) || target <= 0) {
        this.showToast("⚠️ Please enter a valid goal name and target amount.");
        return;
    }

    const newGoal = {
        id: Date.now(),
        name,
        target,
        current: 0
    };

    if (!this.state.goals) this.state.goals = [];
    this.state.goals.push(newGoal);

    if (this.state.badges[0]) this.state.badges[0].unlocked = true;

    this.saveState();
    this.closeModal('modal-add-goal');
    this.updateGoalsUI();
    this.showToast("Goal created!");
},

openAddFundsModal(id) {
        this.state.activeGoalId = id;
        const targetGoal = (this.state.goals || []).find(g => g.id === id);
        if (!targetGoal) return;

        document.getElementById('funds-target-name').textContent = `Target: ${targetGoal.name}`;
        document.getElementById('add-funds-amount').value = '';

        const sourceSelect = document.getElementById('add-funds-source-select');
        if (sourceSelect) {
            sourceSelect.innerHTML = '';
            
            (this.state.accounts || []).forEach(acc => {
                sourceSelect.insertAdjacentHTML('beforeend', `
                    <option value="acc_${acc.id}">Wallet: ${acc.name} (${this.formatPeso(acc.balance)})</option>
                `);
            });

            (this.state.goals || []).forEach(g => {
                if (g.id !== id && g.current > 0) {
                    sourceSelect.insertAdjacentHTML('beforeend', `
                        <option value="goal_${g.id}">Savings: ${g.name} (${this.formatPeso(g.current)})</option>
                    `);
                }
            });
        }

        this.openModal('modal-add-funds');
    },

confirmAddFunds() {
    const amt = parseFloat(document.getElementById('add-funds-amount').value);
    if (isNaN(amt) || amt <= 0) return this.showToast("⚠️ Please enter a valid amount.");

    const targetGoal = (this.state.goals || []).find(g => g.id === this.state.activeGoalId);
    if (!targetGoal) return;

    const sourceVal = document.getElementById('add-funds-source-select')?.value;
    if (!sourceVal) return this.showToast("⚠️ Please select a valid funding source.");

    if (sourceVal.startsWith('acc_')) {
        const accId = sourceVal.replace('acc_', '');
        const sourceAcc = (this.state.accounts || []).find(a => a.id === accId);
        if (!sourceAcc || sourceAcc.balance < amt) {
            this.showToast(`⚠️ Insufficient balance in ${sourceAcc ? sourceAcc.name : 'selected account'}!`);
            return;
        }
        sourceAcc.balance = safeSub(sourceAcc.balance, amt);
        targetGoal.current = safeAdd(targetGoal.current, amt);
        this.state.balance = this.getCalculatedTotalBalance();
    } 
    else if (sourceVal.startsWith('goal_')) {
        const sourceGoalId = parseFloat(sourceVal.replace('goal_', ''));
        const sourceGoal = (this.state.goals || []).find(g => g.id === sourceGoalId);
        if (!sourceGoal || sourceGoal.current < amt) {
            this.showToast(`⚠️ Insufficient savings in ${sourceGoal ? sourceGoal.name : 'selected goal'}!`);
            return;
        }
        sourceGoal.current = safeSub(sourceGoal.current, amt);
        targetGoal.current = safeAdd(targetGoal.current, amt);
    }

    this.recalculateDailyLimit();
    this.saveState();
    this.closeModal('modal-add-funds');
    this.updateGoalsUI();
    this.updateHomeUI();
    this.renderAccountsUI();
    this.showToast(`Transferred ${this.formatPeso(amt)} to ${targetGoal.name}!`);
},

openEditAllowanceModal() {
        this.resetSplitState('allowance');

        if (!this.state.accounts || this.state.accounts.length === 0) {
            this.showToast("Please add your first card to start your budget!");
            this.openAddAccountModal();
            return;
        }

        const selectEl = document.getElementById('edit-allowance-account-select');
        if (selectEl) {
            selectEl.innerHTML = '';
            this.state.accounts.forEach(acc => {
                selectEl.insertAdjacentHTML('beforeend', `
                    <option value="${acc.id}">${acc.name} (Current: ${this.formatPeso(acc.balance)})</option>
                `);
            });
            selectEl.insertAdjacentHTML('beforeend', `
                <option value="+new">+ Add New Account / Card</option>
            `);
        }

        const firstAcc = this.state.accounts[0];
        if (firstAcc) {
            document.getElementById('edit-allowance-amount').value = firstAcc.balance;
        }
        document.getElementById('edit-allowance-date').value = this.state.targetAllowanceDate || '';

        this.updateSplitPreview('allowance');
        this.openModal('modal-edit-allowance');
    },

onAllowanceAccountChange(accId) {
    if (accId === '+new') {
        this.closeModal('modal-edit-allowance');
        this.openAddAccountModal();
        return;
    }
    const targetAccount = (this.state.accounts || []).find(a => a.id === accId);
    if (targetAccount) {
        const amtInput = document.getElementById('edit-allowance-amount');
        if (amtInput) amtInput.value = targetAccount.balance;
        this.updateSplitPreview('allowance');
    }
},

confirmEditAllowance() {
    const selectedAccId = document.getElementById('edit-allowance-account-select')?.value;

    if (!selectedAccId || selectedAccId === '+new') {
        this.closeModal('modal-edit-allowance');
        this.openAddAccountModal();
        this.showToast("Please create an account first!");
        return;
    }

    const totalAmt = parseFloat(document.getElementById('edit-allowance-amount').value);
    const dateVal = document.getElementById('edit-allowance-date').value;

    if (!dateVal) {
        this.showToast("⚠️ Next Allowance Date is required!");
        document.getElementById('edit-allowance-date').focus();
        return;
    }

    const selectedDate = parseLocalDate(dateVal);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate <= today) {
        this.showToast("⚠️ Next Allowance Date must be in the future!");
        document.getElementById('edit-allowance-date').focus();
        return;
    }

    if (isNaN(totalAmt) || totalAmt < 0) {
        this.showToast("⚠️ Please enter a valid allowance amount.");
        return;
    }

    const { savingsAmt, spendableAmt } = this.getSplitAmounts(totalAmt, 'allowance');

    const targetAccount = (this.state.accounts || []).find(a => a.id === selectedAccId);
    if (targetAccount) {
        targetAccount.balance = spendableAmt;
    }

    this.routeSavingsToGoal(savingsAmt);

    this.state.balance = this.getCalculatedTotalBalance();
    this.state.initialAllowance = this.state.balance;
    this.state.allowanceStartDate = formatLocalDateKey(new Date());
    this.state.targetAllowanceDate = dateVal;

    this.resetSplitState('allowance');
    this.recalculateDailyLimit();
    this.saveState();
    this.updateHomeUI();
    this.renderAccountsUI();
    this.updateGoalsUI();
    this.closeModal('modal-edit-allowance');

    const msg = savingsAmt > 0 
        ? `Allowance set! ${this.formatPeso(spendableAmt)} spendable & ${this.formatPeso(savingsAmt)} saved!`
        : "Allowance cycle set successfully!";
    this.showToast(msg);
},

openAddDepositModal() {
        this.resetSplitState('deposit');

        const selectEl = document.getElementById('deposit-account-select');
        if (selectEl) {
            selectEl.innerHTML = '';
            if (!this.state.accounts || this.state.accounts.length === 0) {
                selectEl.insertAdjacentHTML('beforeend', `<option value="+new">+ Create New Account</option>`);
            } else {
                (this.state.accounts || []).forEach(acc => {
                    selectEl.insertAdjacentHTML('beforeend', `
                        <option value="${acc.id}">${acc.name} (${this.formatPeso(acc.balance)})</option>
                    `);
                });
            }
        }
        document.getElementById('deposit-amount').value = '';
        document.getElementById('deposit-note').value = '';
        const dateInput = document.getElementById('deposit-date');
        if (dateInput) dateInput.value = formatLocalDateKey(new Date());

        this.updateSplitPreview('deposit');
        this.openModal('modal-add-deposit');
    },

confirmAddDeposit() {
    const selectedAccId = document.getElementById('deposit-account-select')?.value;

    if (!selectedAccId || selectedAccId === '+new') {
        this.closeModal('modal-add-deposit');
        this.openAddAccountModal();
        this.showToast("Please create an account first!");
        return;
    }

    const totalAmt = parseFloat(document.getElementById('deposit-amount').value);
    const depositDate = document.getElementById('deposit-date')?.value;

    if (!depositDate) {
        this.showToast("⚠️ Please select a date for this deposit.");
        document.getElementById('deposit-date')?.focus();
        return;
    }

    if (isNaN(totalAmt) || totalAmt <= 0) {
        this.showToast("⚠️ Please enter a valid deposit amount.");
        return;
    }

    const { savingsAmt, spendableAmt } = this.getSplitAmounts(totalAmt, 'deposit');

    const targetAccount = (this.state.accounts || []).find(a => a.id === selectedAccId);
    if (targetAccount) {
        targetAccount.balance = safeAdd(targetAccount.balance, spendableAmt);
    }
    this.state.balance = this.getCalculatedTotalBalance();

    this.routeSavingsToGoal(savingsAmt);

    this.resetSplitState('deposit');
    this.recalculateDailyLimit();
    this.saveState();
    this.updateHomeUI();
    this.renderAccountsUI();
    this.updateGoalsUI();
    this.closeModal('modal-add-deposit');

    const msg = savingsAmt > 0 
        ? `Added ${this.formatPeso(spendableAmt)} to account & ${this.formatPeso(savingsAmt)} to ${this.state.goals[0].name}!`
        : `Deposited ${this.formatPeso(totalAmt)} to ${targetAccount ? targetAccount.name : 'account'}!`;
    this.showToast(msg);
},

setSplitPct(pctVal, prefix, btnEl) {
        if (!this.state.splitPcts) this.state.splitPcts = {};
        this.state.splitPcts[prefix] = pctVal;

        const container = btnEl.closest('.preset-grid');
        if (container) {
            container.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('selected'));
        }
        btnEl.classList.add('selected');

        const customWrap = document.getElementById(`${prefix}-custom-input-wrap`);
        if (customWrap) {
            if (pctVal === 'custom') {
                customWrap.style.display = 'block';
                document.getElementById(`${prefix}-custom-savings`)?.focus();
            } else {
                customWrap.style.display = 'none';
            }
        }

        this.updateSplitPreview(prefix);
    },

updateSplitPreview(prefix) {
    let amtInputId = '';
    if (prefix === 'deposit') amtInputId = 'deposit-amount';
    else if (prefix === 'allowance') amtInputId = 'edit-allowance-amount';
    else if (prefix === 'account') amtInputId = 'acc-balance-input';

    const totalAmt = parseFloat(document.getElementById(amtInputId)?.value) || 0;
    const selectedPct = (this.state.splitPcts && this.state.splitPcts[prefix]) || '0';
    
    let savingsAmt = 0;
    if (selectedPct === 'custom') {
        const customVal = parseFloat(document.getElementById(`${prefix}-custom-savings`)?.value) || 0;
        savingsAmt = Math.min(totalAmt, customVal);
    } else {
        const pctNum = parseFloat(selectedPct) || 0;
        savingsAmt = Math.round(totalAmt * (pctNum / 100));
    }

    const spendableAmt = Math.max(0, totalAmt - savingsAmt);
    const previewEl = document.getElementById(`${prefix}-split-preview`);

    if (previewEl) {
        if (savingsAmt > 0 && totalAmt > 0) {
            previewEl.textContent = `🎯 ${this.formatPeso(savingsAmt)} to Goal • 🟢 ${this.formatPeso(spendableAmt)} Spendable`;
        } else {
            previewEl.textContent = `₱0 to savings`;
        }
    }
},

getSplitAmounts(totalAmt, prefix) {
    const selectedPct = (this.state.splitPcts && this.state.splitPcts[prefix]) || '0';
    let savingsAmt = 0;
    if (selectedPct === 'custom') {
        const customVal = parseFloat(document.getElementById(`${prefix}-custom-savings`)?.value) || 0;
        savingsAmt = Math.min(totalAmt, customVal);
    } else {
        const pctNum = parseFloat(selectedPct) || 0;
        savingsAmt = Math.round(totalAmt * (pctNum / 100));
    }
    const spendableAmt = Math.max(0, totalAmt - savingsAmt);
    return { savingsAmt, spendableAmt };
},

routeSavingsToGoal(savingsAmt) {
    if (savingsAmt <= 0) return;
    let activeGoal = (this.state.goals || [])[0];
    if (activeGoal) {
        activeGoal.current = safeAdd(activeGoal.current, savingsAmt);
    } else {
        if (!this.state.goals) this.state.goals = [];
        activeGoal = { id: Date.now(), name: "General Savings", target: 5000, current: savingsAmt };
        this.state.goals.push(activeGoal);
    }
},

resetSplitState(prefix) {
    if (!this.state.splitPcts) this.state.splitPcts = {};
    this.state.splitPcts[prefix] = '0';

    const customWrap = document.getElementById(`${prefix}-custom-input-wrap`);
    if (customWrap) customWrap.style.display = 'none';

    const customInput = document.getElementById(`${prefix}-custom-savings`);
    if (customInput) customInput.value = '';

    const modalId = prefix === 'account' ? 'modal-add-account' : (prefix === 'allowance' ? 'modal-edit-allowance' : 'modal-add-deposit');
    const container = document.querySelector(`#${modalId} .preset-grid`);
    if (container) {
        container.querySelectorAll('.preset-chip').forEach((c, idx) => {
            if (idx === 0) c.classList.add('selected');
            else c.classList.remove('selected');
        });
    }

    this.updateSplitPreview(prefix);
},

toggleNotifications() {
    this.state.notificationsEnabled = !this.state.notificationsEnabled;
    document.getElementById('notif-toggle')?.classList.toggle('active', this.state.notificationsEnabled);
    this.saveState();
    this.showToast(`Notifications ${this.state.notificationsEnabled ? 'enabled' : 'disabled'}`);
},

toggleDarkMode() {
    this.state.darkMode = !this.state.darkMode;
    const appEl = document.getElementById('app');
    const darkToggle = document.getElementById('dark-mode-toggle');

    if (this.state.darkMode) {
        appEl?.classList.add('dark-theme');
        if (darkToggle) darkToggle.classList.add('active');
    } else {
        appEl?.classList.remove('dark-theme');
        if (darkToggle) darkToggle.classList.remove('active');
    }
    this.saveState();
    this.showToast(`Dark mode ${this.state.darkMode ? 'ON' : 'OFF'}`);
},

openCategoryCapsModal() {
    const listEl = document.getElementById('category-caps-input-list');
    if (!listEl) return;

    const categories = ['Food', 'Transport', 'Coffee', 'School', 'Shopping', 'Entertainment', 'Bills', 'Other'];
    const caps = this.state.categoryCaps || {};

    listEl.innerHTML = '';
    categories.forEach(cat => {
        const currentCap = caps[cat] || '';
        const html = `
            <div class="flex justify-between items-center mb-2 gap-2" style="background: var(--bg-color); padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border-color);">
                <span style="font-weight: 700; font-size: 0.85rem; width: 110px;">${cat}</span>
                <input type="number" id="cap-input-${cat}" class="generic-input" style="margin-bottom: 0; padding: 6px 10px; text-align: right; font-size: 0.85rem;" placeholder="No limit" value="${currentCap}" inputmode="decimal">
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });

    this.openModal('modal-category-caps');
},

saveCategoryCaps() {
    const categories = ['Food', 'Transport', 'Coffee', 'School', 'Shopping', 'Entertainment', 'Bills', 'Other'];
    if (!this.state.categoryCaps) this.state.categoryCaps = {};

    categories.forEach(cat => {
        const val = parseFloat(document.getElementById(`cap-input-${cat}`)?.value);
        if (!isNaN(val) && val > 0) {
            this.state.categoryCaps[cat] = val;
        } else {
            delete this.state.categoryCaps[cat];
        }
    });

    this.saveState();
    this.closeModal('modal-category-caps');
    this.renderInsightsCharts();
    this.showToast("Category caps updated!");
},

checkCategoryCapAlert(category, newAmount) {
    const cap = this.state.categoryCaps ? this.state.categoryCaps[category] : null;
    if (!cap || cap <= 0) return;

    const catSpent = (this.state.recentExpenses || [])
        .filter(exp => exp.category === category)
        .reduce((sum, exp) => safeAdd(sum, exp.amount || 0), 0);

    const pct = Math.round((catSpent / cap) * 100);

    if (pct >= 100) {
        setTimeout(() => {
            this.showToast(`🚨 Limit Exceeded: ${category} is at ${pct}% of cap (${this.formatPeso(catSpent)} / ${this.formatPeso(cap)})`);
        }, 600);
    } else if (pct >= 80) {
        setTimeout(() => {
            this.showToast(`⚠️ Cap Alert: ${category} has reached ${pct}% of its cap!`);
        }, 600);
    }
},

renderCategoryCapBadgesOnGrid() {
    const caps = this.state.categoryCaps || {};
    const recentExpenses = this.state.recentExpenses || [];

    document.querySelectorAll('.cat-btn').forEach(btn => {
        const cat = btn.getAttribute('data-cat');
        btn.querySelector('.cat-cap-badge')?.remove();

        const capVal = caps[cat];
        if (capVal && capVal > 0) {
            const spent = recentExpenses
                .filter(e => e.category === cat)
                .reduce((sum, e) => sum + e.amount, 0);

            const pct = Math.round((spent / capVal) * 100);
            if (pct >= 80) {
                const badge = document.createElement('span');
                badge.className = `cat-cap-badge ${pct >= 100 ? 'over-cap' : ''}`;
                badge.textContent = `${pct}%`;
                btn.appendChild(badge);
            }
        }
    });
}
});

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
