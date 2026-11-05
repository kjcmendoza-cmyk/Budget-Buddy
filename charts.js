Object.assign(app, {
    updateBurndownTrendFeedback(idealData, actualData, totalCycleDays) {
    const feedbackBox = document.getElementById('burndown-trend-feedback');
    const feedbackText = document.getElementById('burndown-trend-text');
    if (!feedbackBox || !feedbackText) return;

    // Find the latest day index that has actual balance data logged
    let lastValidIdx = -1;
    for (let i = actualData.length - 1; i >= 0; i--) {
        if (actualData[i] !== null && actualData[i] !== undefined) {
            lastValidIdx = i;
            break;
        }
    }

    // Hide box if there's insufficient cycle history
    if (lastValidIdx < 0) {
        feedbackBox.style.display = 'none';
        return;
    }

    const currentActual = actualData[lastValidIdx];
    const currentIdeal = idealData[lastValidIdx];
    const diff = currentActual - currentIdeal;

    feedbackBox.style.display = 'flex';

    if (diff < -50) {
        // Spending faster than ideal target slope
        const deficit = Math.abs(Math.round(diff));
        feedbackBox.style.background = 'var(--danger-red-light)';
        feedbackBox.style.borderColor = 'var(--danger-red)';
        feedbackText.style.color = 'var(--danger-red)';
        feedbackText.innerHTML = `⚠️ <b>Fast Burn:</b> You are <b>${this.formatPeso(deficit)}</b> below ideal balance for Day ${lastValidIdx + 1}. Slow down to protect your cycle!`;
    } else if (diff > 50) {
        // Spending slower than target (Saving money)
        const surplus = Math.round(diff);
        feedbackBox.style.background = 'var(--primary-green-light)';
        feedbackBox.style.borderColor = 'var(--primary-green)';
        feedbackText.style.color = 'var(--primary-green-dark)';
        feedbackText.innerHTML = `🟢 <b>Ahead of Budget:</b> You have saved <b>${this.formatPeso(surplus)}</b> more than the ideal pace for Day ${lastValidIdx + 1}!`;
    } else {
        // Perfect on-track pacing
        feedbackBox.style.background = 'var(--bg-color)';
        feedbackBox.style.borderColor = 'var(--border-color)';
        feedbackText.style.color = 'var(--text-dark)';
        feedbackText.innerHTML = `🎯 <b>Optimal Pace:</b> Your spending closely matches your ideal burn line for this cycle.`;
    }
},

updateDailyVsSpentTrendFeedback(spentData, dailyLimitVal) {
    const feedbackBox = document.getElementById('daily-trend-feedback');
    const feedbackText = document.getElementById('daily-trend-text');
    if (!feedbackBox || !feedbackText) return;

    const overLimitDays = spentData.filter(amt => amt > dailyLimitVal && dailyLimitVal > 0).length;
    const totalSpent = spentData.reduce((a, b) => a + b, 0);
    const weekendSpent = (spentData[5] || 0) + (spentData[6] || 0); // Sat + Sun
    const weekendPct = totalSpent > 0 ? Math.round((weekendSpent / totalSpent) * 100) : 0;

    if (totalSpent === 0) {
        feedbackBox.style.display = 'none';
        return;
    }

    feedbackBox.style.display = 'flex';

    if (overLimitDays >= 3) {
        feedbackBox.style.background = 'var(--danger-red-light)';
        feedbackBox.style.borderColor = 'var(--danger-red)';
        feedbackText.style.color = 'var(--danger-red)';
        feedbackText.innerHTML = `🚨 <b>Frequent Spikes:</b> Exceeded daily limit on <b>${overLimitDays} days</b> this week.`;
    } else if (weekendPct >= 50 && weekendSpent > 0) {
        feedbackBox.style.background = 'var(--accent-orange-light)';
        feedbackBox.style.borderColor = 'var(--accent-orange)';
        feedbackText.style.color = 'var(--accent-orange)';
        feedbackText.innerHTML = `⚠️ <b>Weekend Drain:</b> <b>${weekendPct}%</b> of this week's expenses occurred on Sat & Sun.`;
    } else {
        feedbackBox.style.background = 'var(--primary-green-light)';
        feedbackBox.style.borderColor = 'var(--primary-green)';
        feedbackText.style.color = 'var(--primary-green-dark)';
        feedbackText.innerHTML = `👏 <b>Balanced Pacing:</b> Spending is evenly distributed across the week.`;
    }
},
    openChartZoomModal() {
    this.openModal('modal-chart-zoom');
    setTimeout(() => {
        this.renderZoomBurndownChart();
    }, 100);
},

renderZoomBurndownChart() {
    const canvas = document.getElementById('zoomBurndownChart');
    if (!canvas) return;

    this.destroyChart('zoomBurndown', 'zoomBurndownChart');
    const ctx = canvas.getContext('2d');

    const originalChart = this.charts.burndown;
    if (!originalChart) return;

    this.charts.zoomBurndown = new Chart(ctx, {
        type: 'line',
        data: JSON.parse(JSON.stringify(originalChart.data)),
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 12, right: 10, left: 4, bottom: 4 } },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    align: 'center',
                    labels: {
                        boxWidth: 10,
                        usePointStyle: true,
                        font: { family: 'Nunito', size: 12, weight: '800' },
                        color: this.state.darkMode ? '#f8fafc' : '#1e293b'
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#0f172a',
                    titleColor: '#38bdf8',
                    bodyColor: '#ffffff',
                    titleFont: { family: 'Nunito', size: 13, weight: '800' },
                    bodyFont: { family: 'Nunito', size: 12, weight: '700' },
                    padding: 12,
                    cornerRadius: 10,
                    borderColor: '#334155',
                    borderWidth: 1,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: this.state.darkMode ? '#94a3b8' : '#64748b',
                        font: { family: 'Nunito', size: 11, weight: '700' },
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: { color: 'rgba(226, 232, 240, 0.6)', borderDash: [4, 4] },
                    ticks: {
                        color: this.state.darkMode ? '#94a3b8' : '#64748b',
                        font: { family: 'Nunito', size: 11, weight: '700' },
                        callback: val => (val >= 1000 ? '₱' + (val / 1000) + 'k' : '₱' + val)
                    }
                }
            }
        }
    });
},
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

    updateInsightsHeroSummary() {
        const statusEl = document.getElementById('insights-pace-status');
        const endBalEl = document.getElementById('projected-end-bal');
        if (!statusEl && !endBalEl) return;

        const spentToday = this.getTodayTotal();
        const dailyLimit = this.state.dailyLimit || 0;

        // 1. Dynamic Daily Pace Status
        if (dailyLimit === 0 && spentToday === 0) {
            if (statusEl) {
                statusEl.textContent = "No Budget ⚪";
                statusEl.style.color = "var(--text-gray)";
            }
        } else if (spentToday <= dailyLimit) {
            if (statusEl) {
                statusEl.textContent = "On Track 🟢";
                statusEl.style.color = "var(--primary-green-dark)";
            }
        } else {
            if (statusEl) {
                statusEl.textContent = "Over Pace 🚨";
                statusEl.style.color = "var(--danger-red)";
            }
        }

        // 2. Dynamic Projected End Balance
        const daysLeft = Math.max(1, this.state.remainingDays || 1);
        const curBal = this.state.balance || 0;
        
        const todayKey = formatLocalDateKey(new Date());
        const startDateStr = this.state.allowanceStartDate || todayKey;
        const startDate = parseLocalDate(startDateStr);
        const today = parseLocalDate(todayKey);
        const daysElapsed = Math.max(1, Math.round((today - startDate) / (1000 * 60 * 60 * 24)) + 1);

        const totalCycleSpent = (this.state.recentExpenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
        const avgDailyBurn = totalCycleSpent / daysElapsed;
        
        const projectedEnd = Math.max(0, Math.round(curBal - (avgDailyBurn * daysLeft)));

        if (endBalEl) {
            endBalEl.textContent = this.formatPeso(projectedEnd);
            endBalEl.style.color = projectedEnd > 0 ? "var(--primary-green-dark)" : "var(--danger-red)";
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

        const idealVal = Math.max(0, initialAllowance - ((i + 1) * (initialAllowance / totalCycleDays)));
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
    this.updateBurndownTrendFeedback(idealData, actualData, totalCycleDays);
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
    this.updateDailyVsSpentTrendFeedback(spentData, dailyLimitVal);
},

renderInsightsCharts() {
    this.destroyChart('burndown', 'burndownChart');
    this.destroyChart('dailyVsSpent', 'dailyVsSpentChart');
    this.destroyChart('donut', 'categoryDonutChart');
    this.updateInsightsHeroSummary();
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