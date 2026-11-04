Object.assign(app, {
calculateFinancialHealthScore() {
                // 1. Budget Adherence (40%)
                const initialAllowance = this.state.initialAllowance || this.state.balance || 1;
                const totalSpent = (this.state.recentExpenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
                let adherencePct = 100;
                if (initialAllowance > 0) {
                    const remainingRatio = Math.max(0, (initialAllowance - totalSpent) / initialAllowance);
                    adherencePct = Math.min(100, Math.round(remainingRatio * 100));
                }
                const adherenceWeighted = Math.round((adherencePct / 100) * 40);

                // 2. Savings Rate (30%)
                let totalGoalSavings = 0;
                let totalGoalTargets = 0;
                (this.state.goals || []).forEach(g => {
                    totalGoalSavings += (g.current || 0);
                    totalGoalTargets += (g.target || 0);
                });
                let savingsPct = 50;
                if (totalGoalTargets > 0) {
                    savingsPct = Math.min(100, Math.round((totalGoalSavings / totalGoalTargets) * 100));
                } else if (initialAllowance > 0) {
                    savingsPct = Math.min(100, Math.round((this.state.balance / initialAllowance) * 100));
                }
                const savingsWeighted = Math.round((savingsPct / 100) * 30);

                // 3. Bill Coverage (30%)
                const pendingBills = (this.state.upcomingExpenses || []).filter(e => e.status === 'pending');
                const totalPendingBillAmount = pendingBills.reduce((sum, e) => sum + (e.amount || 0), 0);
                let billCoveragePct = 100;
                if (totalPendingBillAmount > 0) {
                    billCoveragePct = this.state.balance >= totalPendingBillAmount 
                        ? 100 
                        : Math.round((this.state.balance / totalPendingBillAmount) * 100);
                }
                const coverageWeighted = Math.round((billCoveragePct / 100) * 30);

                // 4. Streak Bonus & Overdue Penalty Modifiers
                let streakBonus = 0;
                if (this.state.streakDays >= 7) streakBonus = 10;
                else if (this.state.streakDays >= 3) streakBonus = 5;

                const todayStr = new Date().toISOString().split('T')[0];
                const hasOverdue = pendingBills.some(e => e.date < todayStr);
                const overduePenalty = hasOverdue ? -10 : 0;
                const netModifier = streakBonus + overduePenalty;

                // Weighted Total
                const finalScore = Math.max(0, Math.min(100, adherenceWeighted + savingsWeighted + coverageWeighted + netModifier));

                let status = "Needs Attention";
                let color = "var(--danger-red)";
                let bg = "var(--danger-red-light)";

                if (finalScore >= 80) {
                    status = "Strong";
                    color = "var(--primary-green)";
                    bg = "var(--primary-green-light)";
                } else if (finalScore >= 60) {
                    status = "Good";
                    color = "var(--accent-blue)";
                    bg = "var(--accent-blue-light)";
                } else if (finalScore >= 40) {
                    status = "Fair";
                    color = "var(--accent-orange)";
                    bg = "var(--accent-orange-light)";
                }

                return {
                    score: finalScore,
                    status,
                    color,
                    bg,
                    factors: {
                        adherencePct, adherencePts: adherenceWeighted,
                        savingsPct, savingsPts: savingsWeighted,
                        billCoveragePct, coveragePts: coverageWeighted,
                        streakBonus, overduePenalty, netModifier,
                        totalPendingBillAmount, hasOverdue
                    }
                };
            },
updateHealthScoreUI() {
    const data = this.calculateFinancialHealthScore();

    // Floating Widget Elements
    const floatWidget = document.getElementById('floating-health-widget');
    const floatScoreEl = document.getElementById('floating-health-score');
    const floatIconEl = document.getElementById('floating-health-icon');
    
    if (floatScoreEl) floatScoreEl.textContent = data.score;
    if (floatIconEl) floatIconEl.style.color = data.color;
    if (floatWidget) floatWidget.style.borderColor = data.color;

    // Optional Home Dashboard Health Status elements (if present)
    const scoreEl = document.getElementById('home-health-score');
    const statusEl = document.getElementById('home-health-status');
    const gaugeTextEl = document.getElementById('home-health-gauge-text');
    const gaugeCircle = document.getElementById('home-health-gauge-circle');

    if (scoreEl) scoreEl.textContent = data.score;
    if (gaugeTextEl) gaugeTextEl.textContent = data.score;

    if (statusEl) {
        statusEl.textContent = data.status;
        statusEl.style.color = data.color;
        statusEl.style.background = data.bg;
    }

    if (gaugeCircle) {
        const circumference = 188.4;
        const offset = circumference - (circumference * data.score / 100);
        gaugeCircle.style.strokeDashoffset = offset;
        gaugeCircle.style.stroke = data.color;
    }
},

            openHealthScoreModal() {
                const data = this.calculateFinancialHealthScore();

                const bigScoreEl = document.getElementById('modal-health-score-big');
                const statusTextEl = document.getElementById('modal-health-status-text');
                
                if (bigScoreEl) {
                    bigScoreEl.textContent = data.score;
                    bigScoreEl.style.color = data.color;
                }
                if (statusTextEl) {
                    statusTextEl.textContent = `${data.status} Financial Momentum`;
                    statusTextEl.style.color = data.color;
                }

                document.getElementById('breakdown-adherence-sub').textContent = `${data.factors.adherencePct}% remaining allowance ratio`;
                document.getElementById('breakdown-adherence-pts').textContent = `+${data.factors.adherencePts} pts`;

                document.getElementById('breakdown-savings-sub').textContent = `${data.factors.savingsPct}% overall savings/goals ratio`;
                document.getElementById('breakdown-savings-pts').textContent = `+${data.factors.savingsPts} pts`;

                document.getElementById('breakdown-coverage-sub').textContent = `${data.factors.billCoveragePct}% bill coverage capacity`;
                document.getElementById('breakdown-coverage-pts').textContent = `+${data.factors.coveragePts} pts`;

                const modSub = document.getElementById('breakdown-modifiers-sub');
                const modPts = document.getElementById('breakdown-modifiers-pts');
                if (modSub && modPts) {
                    modSub.textContent = `Streak (+${data.factors.streakBonus}) ${data.factors.hasOverdue ? '• Overdue Bill (-10)' : ''}`;
                    modPts.textContent = `${data.factors.netModifier >= 0 ? '+' : ''}${data.factors.netModifier} pts`;
                    modPts.style.color = data.factors.netModifier >= 0 ? 'var(--primary-green)' : 'var(--danger-red)';
                }

                const adviceContainer = document.getElementById('health-advice-container');
                if (adviceContainer) {
                    adviceContainer.innerHTML = '';
                    const tips = [];

                    if (data.factors.hasOverdue) {
                        tips.push(`<b>Urgent Action:</b> Confirm or clear your overdue bill to eliminate the -10 point health penalty!`);
                    } else if (data.factors.billCoveragePct < 100) {
                        tips.push(`<b>Boost Coverage:</b> Reserve <b>${this.formatPeso(data.factors.totalPendingBillAmount)}</b> in balance to gain up to +15 pts.`);
                    }

                    if (this.state.streakDays < 3) {
                        tips.push(`<b>Build a Streak:</b> Log expenses daily to hit a 3-day streak and earn a <b>+5 pt bonus</b>.`);
                    }

                    if (data.factors.savingsPct < 70) {
                        tips.push(`<b>Boost Savings:</b> Deposit ₱100–₱200 into a goal to increase your Savings Rate score by +5 pts.`);
                    }

                    if (tips.length === 0) {
                        tips.push(`🎉 <b>Great job!</b> You are maintaining peak financial momentum this week.`);
                    }

                    tips.slice(0, 2).forEach(tipText => {
                        adviceContainer.insertAdjacentHTML('beforeend', `
                            <div class="health-advice-card">
                                <i class="fa-solid fa-lightbulb text-green" style="font-size: 1rem; color: var(--primary-green);"></i>
                                <div>${tipText}</div>
                            </div>
                        `);
                    });
                }

                this.openModal('modal-health-score');
            }
            });