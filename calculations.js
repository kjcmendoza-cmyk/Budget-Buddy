// Safely adds two currency amounts avoiding floating-point precision bugs
function safeAdd(a, b) {
    return Math.round((Number(a) + Number(b) + Number.EPSILON) * 100) / 100;
}

// Safely subtracts two currency amounts avoiding floating-point precision bugs
function safeSub(a, b) {
    return Math.round((Number(a) - Number(b) + Number.EPSILON) * 100) / 100;
}
// Safely converts 'YYYY-MM-DD' strings or Date objects into local midnight Date instances
function parseLocalDate(dateInput) {
    if (!dateInput) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (dateInput instanceof Date) {
        const d = new Date(dateInput);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    if (typeof dateInput === 'string' && dateInput.includes('-')) {
        const parts = dateInput.split('T')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
    }
    const d = new Date(dateInput);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Formats any Date object or string reliably as local 'YYYY-MM-DD'
function formatLocalDateKey(dateInput) {
    const d = parseLocalDate(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

        function getDaysLeft(targetDateStr) {
    if (!targetDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = parseLocalDate(targetDateStr);
    const diffTime = targetDate - today;
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

        function getNextCycleDate(dateStr, cycle) {
            if (!dateStr || !cycle || cycle === 'one-time') return null;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return null;
            let year = parseInt(parts[0], 10);
            let month = parseInt(parts[1], 10) - 1; // 0-indexed
            let day = parseInt(parts[2], 10);

            let d = new Date(year, month, day);

            if (cycle === 'weekly') {
                d.setDate(d.getDate() + 7);
            } else if (cycle === 'bi-weekly') {
                d.setDate(d.getDate() + 14);
            } else if (cycle === 'monthly') {
                d.setMonth(d.getMonth() + 1);
            } else if (cycle === 'yearly') {
                d.setFullYear(d.getFullYear() + 1);
            } else {
                return null;
            }

            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
        }