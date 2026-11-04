// js/state.js - Firebase initialization, app state, & reset logic

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let db = null;
let auth = null;
let isFirebaseActive = false;

if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        isFirebaseActive = true;
        console.log("Firebase initialized successfully!");
    } catch (err) {
        console.warn("Firebase config incomplete, operating in localStorage mode.", err);
    }
}

const app = {
    state: {
        categoryCaps: {},
        isMasked: false,
        selectedAccountFilter: 'All',
        accounts: [],
        badgesCollapsed: true,
        isRecurring: false,
        subscriptions: [],
        lastResetTimestamp: null,
        burnRateView: '31days',
        isLoggedIn: false,
        userName: '',
        userEmail: '',
        userPassword: '',
        userPin: '',
        enteredPin: '',
        authTab: 'signin',
        balance: 0,
        remainingDays: 0,
        dailyLimit: 0,
        streakDays: 0,
        targetAllowanceDate: "",
        allowanceStartDate: "",
        initialAllowance: 0,
        notificationsEnabled: true,
        darkMode: false,
        recentExpenses: [],
        goals: [],
        upcomingExpenses: [],
        affordChecksCount: 0,
        nightlyWrapCount: 0,
        lastNightlyCheckDate: "",
        wasOverspentYesterday: false,
        badges: [
            { id: 1, name: 'Goal Getter', icon: '🎯', unlocked: false, desc: 'Set first savings goal' },
            { id: 2, name: 'Streak Master', icon: '🔥', unlocked: false, desc: '5-Day budget streak' },
            { id: 3, name: 'Nightly Wrap', icon: '🌙', unlocked: false, desc: 'Check app after 8 PM (3x)' },
            { id: 4, name: 'Second Thought', icon: '🛒', unlocked: false, desc: 'Check "Can I Afford It?" 3x' },
            { id: 5, name: 'Phoenix Spender', icon: '🦅', unlocked: false, desc: 'Bounce back after overspending' },
            { id: 6, name: 'Super Saver', icon: '💰', unlocked: false, desc: 'Save ₱1,000 extra' },
            { id: 7, name: 'Future Proof', icon: '📅', unlocked: false, desc: 'Schedule 3 upcoming bills' },
            { id: 8, name: 'Health Pioneer', icon: '❤️', unlocked: false, desc: 'Reach Health Score of 80+' }
        ],
        selectedCategory: 'Food',
        selectedIcon: 'fa-burger',
        selectedColor: 'var(--primary-green)',
        activeGoalId: null,
        calYear: new Date().getFullYear(),
        calMonth: new Date().getMonth(),
        calSelectedDate: null
    },

    charts: {},

    async nukeAndResetSystem() {
        if (!confirm("Are you sure? This will permanently wipe local storage, Firebase database records, and log you out!")) {
            return;
        }

        try {
            if (isFirebaseActive && db && auth && auth.currentUser) {
                await db.collection('users').doc(auth.currentUser.uid).delete();
            }
            if (isFirebaseActive && auth) {
                await auth.signOut();
            }
            localStorage.clear();
            window.location.reload();
        } catch (err) {
            console.error("Reset Error:", err);
            alert("Error resetting system: " + err.message);
        }
    }
};