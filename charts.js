Object.assign(app, {
destroyChart(key, canvasId) {
    if (this.charts && this.charts[key]) {
        this.charts[key].destroy();
        delete this.charts[key];
    }
    if (canvasId && typeof Chart !== 'undefined') {
        const existingChart = Chart.getChart(canvasId);
        if (existingChart) {
            existingChart.destroy();
        }
    }
},

renderBurndownChart() {
    const canvas = document.getElementById('burndownChart');
    if (!canvas) return;

    this.destroyChart('burndown', 'burndownChart');
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatLocalDateKey(today);

    const startDateStr = this.state.allowanceStartDate || todayKey;
    const endDateStr = this.state.targetAllowanceDate;

    const startDate = parseLocalDate(startDateStr);
    let endDate = endDateStr ? parseLocalDate(endDateStr) : new Date(startDate);
    
    if (!endDateStr || endDate <= startDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 14);
    }

    const totalCycleDays = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const labels = [];
    const idealData = [];
    const actualData = [];

    const initialAllowance = this.state.initialAllowance || this.state.balance || 0;
    let currentActualBal = initialAllowance;

    const expensesByDate = {};
    (this.state.recentExpenses || []).forEach(exp => {
        const dKey = exp.rawDate ? formatLocalDateKey(exp.rawDate) : null;
        if (dKey) {
            expensesByDate[dKey] = (expensesByDate[dKey] || 0) + exp.amount;
        }
    });

    for (let i = 0; i < totalCycleDays; i++) {
        const currDate = new Date(startDate);
        currDate.setDate(currDate.getDate() + i);

        const dateStr = currDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        labels.push(dateStr);

        const idealVal = Math.max(0, initialAllowance - (i * (initialAllowance / totalCycleDays)));
        idealData.push(Math.round(idealVal));

        const dateKey = formatLocalDateKey(currDate);

        if (i === 0) {
            currentActualBal = initialAllowance - (expensesByDate[dateKey] || 0);
        } else {
            currentActualBal -= (expensesByDate[dateKey] || 0);
        }

        if (currDate < today) {
            actualData.push(Math.max(0, Math.round(currentActualBal)));
        } else if (dateKey === todayKey) {
            actualData.push(Math.max(0, Math.round(this.state.balance)));
        } else {
            actualData.push(null);
        }
    }

    const labelEl = document.getElementById('burndown-cycle-label');
    if (labelEl) {
        labelEl.textContent = `${totalCycleDays}-Day Cycle (${labels[0]} - ${labels[labels.length - 1]})`;
    }

    const textColor = this.state.darkMode ? '#94a3b8' : '#64748b';
    const gridColor = this.state.darkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.7)';

    this.charts.burndown = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ideal Pace',
                    data: idealData,
                    borderColor: '#cbd5e1',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                },
                {
                    label: 'Actual Balance',
                    data: actualData,
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7,
                    pointHoverBorderWidth: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 16, right: 12, left: 4, bottom: 4 }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    align: 'end',
                    labels: {
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 14,
                        color: textColor,
                        font: { family: 'Nunito', size: 11, weight: '700' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Nunito', size: 12, weight: '800' },
                    bodyFont: { family: 'Nunito', size: 11, weight: '600' },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: true,
                    boxWidth: 8,
                    boxHeight: 8,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += '₱' + context.parsed.y.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textColor,
                        font: { family: 'Nunito', size: 10, weight: '700' },
                        maxTicksLimit: 6,
                        autoSkip: true
                    }
                },
                y: {
                    grid: { color: gridColor, borderDash: [4, 4] },
                    ticks: {
                        color: textColor,
                        font: { family: 'Nunito', size: 10, weight: '700' },
                        maxTicksLimit: 5,
                        callback: value => (value >= 1000 ? '₱' + (value / 1000) + 'k' : '₱' + value)
                    }
                }
            }
        }
    });
},

getDailyExpensesData(labels) {
    const expensesByDate = {};
    (this.state.recentExpenses || []).forEach(exp => {
        if (exp.rawDate) {
            const dateKey = formatLocalDateKey(exp.rawDate);
            expensesByDate[dateKey] = (expensesByDate[dateKey] || 0) + exp.amount;
        }
    });

    return labels.map(labelDateStr => {
        const d = new Date(labelDateStr + ' ' + new Date().getFullYear());
        const dateKey = formatLocalDateKey(d);
        return expensesByDate[dateKey] || 0;
    });
},

renderDailyVsSpentChart() {
    const canvas = document.getElementById('dailyVsSpentChart');
    if (!canvas) return;

    this.destroyChart('dailyVsSpent', 'dailyVsSpentChart');
    const ctx = canvas.getContext('2d');

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const dayOfWeek = now.getDay(); 
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);

    const expensesByDate = {};
    (this.state.recentExpenses || []).forEach(exp => {
        if (exp.rawDate) {
            const dKey = formatLocalDateKey(exp.rawDate);
            expensesByDate[dKey] = (expensesByDate[dKey] || 0) + exp.amount;
        }
    });

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const spentData = [];
    const limitData = [];
    const dailyLimitVal = this.state.dailyLimit || 0;

    for (let i = 0; i < 7; i++) {
        const currDate = new Date(monday);
        currDate.setDate(monday.getDate() + i);
        const dateKey = formatLocalDateKey(currDate);

        spentData.push(expensesByDate[dateKey] || 0);
        limitData.push(dailyLimitVal);
    }

    const textColor = this.state.darkMode ? '#94a3b8' : '#64748b';
    const gridColor = this.state.darkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.7)';

    this.charts.dailyVsSpent = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: daysOfWeek,
            datasets: [
                {
                    type: 'line',
                    label: 'Daily Limit',
                    data: limitData,
                    borderColor: '#f97316',
                    borderWidth: 2,
                    borderDash: [6, 6],
                    pointRadius: 0,
                    fill: false
                },
                {
                    type: 'bar',
                    label: 'Spent',
                    data: spentData,
                    backgroundColor: '#10b981',
                    borderRadius: 8,
                    borderSkipped: false,
                    minBarLength: 4,
                    barThickness: 18
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 16, right: 10, left: 4, bottom: 4 }
            },
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    align: 'end',
                    labels: {
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 14,
                        color: textColor,
                        font: { family: 'Nunito', size: 11, weight: '700' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Nunito', size: 12, weight: '800' },
                    bodyFont: { family: 'Nunito', size: 11, weight: '600' },
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += '₱' + context.parsed.y.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Nunito', size: 10, weight: '700' } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, borderDash: [4, 4] },
                    ticks: {
                        color: textColor,
                        font: { family: 'Nunito', size: 10, weight: '700' },
                        maxTicksLimit: 5,
                        callback: value => (value >= 1000 ? '₱' + (value / 1000) + 'k' : '₱' + value)
                    }
                }
            }
        }
    });
},

renderInsightsCharts() {
    this.destroyChart('burndown', 'burndownChart');
    this.destroyChart('dailyVsSpent', 'dailyVsSpentChart');
    this.destroyChart('donut', 'categoryDonutChart');
    this.destroyChart('bar', 'dailyBarChart');

    this.renderBurndownChart();
    this.renderDailyVsSpentChart();

    const isDark = this.state.darkMode;
    const textColor = isDark ? '#f8fafc' : '#1e293b';

    const catTotals = {};
    (this.state.recentExpenses || []).forEach(exp => {
        catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amount;
    });

    const catLabels = Object.keys(catTotals);
    const catData = Object.values(catTotals);
    const colors = ['#10b981', '#8b5cf6', '#f97316', '#3b82f6', '#ef4444', '#eab308', '#ec4899'];

    const donutCtx = document.getElementById('categoryDonutChart')?.getContext('2d');
    if (donutCtx) {
        this.charts.donut = new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: catLabels.length > 0 ? catLabels : ['No Data'],
                datasets: [{
                    data: catData.length > 0 ? catData : [1],
                    backgroundColor: catData.length > 0 ? colors.slice(0, catLabels.length) : ['#e2e8f0'],
                    borderWidth: 0,
                    borderRadius: catData.length > 0 ? 6 : 0,
                    spacing: catData.length > 0 ? 3 : 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '78%',
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        padding: 10,
                        cornerRadius: 10,
                        bodyFont: { family: 'Nunito', size: 11, weight: '700' }
                    }
                }
            }
        });
    }

    const breakdownList = document.getElementById('category-breakdown-list');
    const catDetail = document.getElementById('cat-insight-detail');

    if (breakdownList) {
        breakdownList.innerHTML = '';
        if (catLabels.length === 0) {
            breakdownList.innerHTML = `<div class="text-xs text-gray text-center p-2">No category data yet</div>`;
        } else {
            const caps = this.state.categoryCaps || {};

            catLabels.forEach((cat, i) => {
                const spent = catTotals[cat] || 0;
                const cap = caps[cat];
                let progressHtml = '';
                let badgeHtml = '';

                if (cap && cap > 0) {
                    const pct = Math.min(100, Math.round((spent / cap) * 100));
                    let barColor = 'var(--primary-green)';
                    let badgeClass = 'color: var(--primary-green-dark); background: var(--primary-green-light);';

                    if (pct >= 100) {
                        barColor = 'var(--danger-red)';
                        badgeClass = 'color: var(--danger-red); background: var(--danger-red-light);';
                        badgeHtml = `<span style="font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:6px; ${badgeClass}">🚨 ${pct}% (Over Cap)</span>`;
                    } else if (pct >= 80) {
                        barColor = 'var(--accent-orange)';
                        badgeClass = 'color: var(--accent-orange); background: var(--accent-orange-light);';
                        badgeHtml = `<span style="font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:6px; ${badgeClass}">⚠️ ${pct}%</span>`;
                    } else {
                        badgeHtml = `<span style="font-size:0.65rem; font-weight:800; padding:2px 6px; border-radius:6px; ${badgeClass}">${pct}%</span>`;
                    }

                    progressHtml = `
                        <div style="width: 100%; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; margin-top: 6px;">
                            <div style="width: ${pct}%; height: 100%; background: ${barColor}; border-radius: 3px; transition: width 0.3s ease;"></div>
                        </div>
                    `;
                }

                const capLabel = cap ? ` / ${this.formatPeso(cap)}` : '';

                const html = `
                    <div class="cat-pill-item" style="flex-direction: column; align-items: stretch; padding: 10px 12px;">
                        <div class="flex justify-between items-center">
                            <div class="cat-pill-left">
                                <div class="cat-pill-dot" style="background:${colors[i % colors.length]}"></div>
                                <span>${cat}</span>
                                ${badgeHtml}
                            </div>
                            <span style="font-weight:800; font-size:0.85rem;">${this.formatPeso(spent)}<span style="font-size:0.72rem; color:var(--text-gray); font-weight:600;">${capLabel}</span></span>
                        </div>
                        ${progressHtml}
                    </div>
                `;
                breakdownList.insertAdjacentHTML('beforeend', html);
            });
        }
    }

    if (catDetail && catLabels.length > 0) {
        const topCat = catLabels.reduce((a, b) => catTotals[a] > catTotals[b] ? a : b);
        catDetail.innerHTML = `<span>Top Category: <b>${topCat}</b></span><span style="color:var(--primary-green)">${this.formatPeso(catTotals[topCat])}</span>`;
    }

    const dailyCtx = document.getElementById('dailyBarChart')?.getContext('2d');
    if (dailyCtx) {
        const todayLimit = this.state.dailyLimit || 0;

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const dayOfWeek = now.getDay(); 
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        const mondayDate = new Date(now);
        mondayDate.setDate(now.getDate() - diffToMonday);
        mondayDate.setHours(0, 0, 0, 0);

        const weekSpent = [0, 0, 0, 0, 0, 0, 0];

        (this.state.recentExpenses || []).forEach(exp => {
            if (!exp.rawDate) return;
            const expDate = parseLocalDate(exp.rawDate);
            
            const diffDays = Math.round((expDate - mondayDate) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays < 7) {
                weekSpent[diffDays] += Number(exp.amount || 0);
            }
        });

        this.charts.bar = new Chart(dailyCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [
                    {
                        label: 'Daily Limit',
                        data: Array(7).fill(todayLimit),
                        backgroundColor: 'rgba(16, 185, 129, 0.3)'
                    },
                    {
                        label: 'Spent',
                        data: weekSpent,
                        backgroundColor: '#8b5cf6'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor } },
                    y: { ticks: { color: textColor } }
                }
            }
        });
    }

    // Heavy Spending Triggers Aggregation
    const dayTotals = { 'Sun': 0, 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    (this.state.recentExpenses || []).forEach(exp => {
        if (exp.rawDate) {
            const d = parseLocalDate(exp.rawDate);
            const dayName = dayNames[d.getDay()];
            dayTotals[dayName] = (dayTotals[dayName] || 0) + exp.amount;
        }
    });

    let maxDay = '';
    let maxDayAmt = 0;
    for (const [day, amt] of Object.entries(dayTotals)) {
        if (amt > maxDayAmt) {
            maxDayAmt = amt;
            maxDay = day;
        }
    }

    const peakDayEl = document.getElementById('peak-day-val');
    const peakDaySub = document.getElementById('peak-day-sub');
    if (peakDayEl && peakDaySub) {
        if (maxDayAmt > 0) {
            peakDayEl.textContent = maxDay;
            peakDayEl.style.color = 'var(--text-dark)';
            peakDaySub.textContent = `${this.formatPeso(maxDayAmt)} total spent`;
        } else {
            peakDayEl.textContent = '--';
            peakDaySub.textContent = 'Awaiting data';
        }
    }

    // Auto-Savings Progress Widget
    const goalBar = document.getElementById('widget-goal-progress');
    const goalStatus = document.getElementById('widget-goal-status');
    if (goalBar && goalStatus) {
        let totalCurrent = 0;
        let totalTarget = 0;
        (this.state.goals || []).forEach(g => {
            totalCurrent += g.current || 0;
            totalTarget += g.target || 0;
        });
        if (totalTarget > 0) {
            const pct = Math.min(100, Math.round((totalCurrent / totalTarget) * 100));
            goalBar.style.width = `${pct}%`;
            goalStatus.textContent = `${pct}% saved towards goals (${this.formatPeso(totalCurrent)} / ${this.formatPeso(totalTarget)})`;
        } else {
            goalBar.style.width = '0%';
            goalStatus.textContent = 'No active goals set';
        }
    }
}
});