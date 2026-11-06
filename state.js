function safeAdd(a, b) {
    return Math.round(((Number(a) || 0) + (Number(b) || 0) + Number.EPSILON) * 100) / 100;
}

function safeSub(a, b) {
    return Math.round(((Number(a) || 0) - (Number(b) || 0) + Number.EPSILON) * 100) / 100;
}

function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(dateStr);
}

function formatLocalDateKey(d) {
    const date = d || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDaysLeft(targetDateStr) {
    if (!targetDateStr) return 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = parseLocalDate(targetDateStr);
    target.setHours(0, 0, 0, 0);

    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
}

function getNextCycleDate(currentDateStr, cycle) {
    const d = parseLocalDate(currentDateStr);
    if (cycle === 'daily') d.setDate(d.getDate() + 1);
    else if (cycle === 'weekly') d.setDate(d.getDate() + 7);
    else if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else return null;
    return formatLocalDateKey(d);
}

const defaultState = {
    isLoggedIn: false,
    userName: '',
    userEmail: '',
    userPassword: '',
    userPin: '1234',
    enteredPin: '',
    authTab: 'signin',
    darkMode: false,
    notificationsEnabled: true,
    selectedCategory: 'Food',
    balance: 0,
    initialAllowance: 0,
    allowanceStartDate: '',
    targetAllowanceDate: '',
    dailyLimit: 0,
    startOfDayLimit: 0,
    remainingDays: 1,
    streakDays: 0,
    affordChecksCount: 0,
    nightlyWrapCount: 0,
    wasOverspentYesterday: false,
    accounts: [],
    recentExpenses: [],
    upcomingExpenses: [],
    goals: [],
    categoryCaps: {},
    badgesCollapsed: true,
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calSelectedDate: null,
    isCalendarCollapsed: true,
    badges: [
        { id: 1, name: "First Goal", desc: "Created your first goal", icon: "🎯", unlocked: false },
        { id: 2, name: "Streak Master", desc: "Under limit 5 days in a row", icon: "🔥", unlocked: false },
        { id: 3, name: "Nightly Wrap", desc: "Logged 3 evening check-ins", icon: "🌙", unlocked: false },
        { id: 4, name: "Affordability Pro", desc: "Checked 3 items before buying", icon: "🛍️", unlocked: false },
        { id: 5, name: "Comeback Spender", desc: "Stayed under limit after overspending", icon: "⚡", unlocked: false },
        { id: 6, name: "Savings Champ", desc: "Saved over ₱1,000 total", icon: "🏆", unlocked: false },
        { id: 7, name: "Planner", desc: "Scheduled 3 upcoming bills", icon: "📅", unlocked: false },
        { id: 8, name: "Financial Health Guru", desc: "Reached 80+ health score", icon: "💚", unlocked: false }
    ]
};

Object.assign(app, {
    state: { ...defaultState },

    getCalculatedTotalBalance() {
        if (this.state.accounts && this.state.accounts.length > 0) {
            return this.state.accounts.reduce((sum, acc) => safeAdd(sum, acc.balance || 0), 0);
        }
        return this.state.balance || 0;
    },

    async nukeAndResetSystem() {
        try {
            if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && typeof db !== 'undefined' && db && typeof auth !== 'undefined' && auth && auth.currentUser) {
                await db.collection('users').doc(auth.currentUser.uid).delete();
            }
            if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && typeof auth !== 'undefined' && auth) {
                await auth.signOut();
            }
            localStorage.clear();
            window.location.reload();
        } catch (err) {
            console.error("Reset Error:", err);
            if (typeof this.showToast === 'function') {
                this.showToast("⚠️ Error resetting system: " + err.message);
            }
        }
    }
});