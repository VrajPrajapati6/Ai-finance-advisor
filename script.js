// AI Finance Advisor - Main JavaScript File

// Global state management
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let goals = JSON.parse(localStorage.getItem('goals')) || [];
let monthlyData = JSON.parse(localStorage.getItem('monthlyData')) || {};
let currentSection = 'dashboard';

// Chart instances for Dashboard
let dashboardCharts = {
    expenseChart: null,
    trendChart: null,
    yearlyChart: null
};

// Chart instances for Analytics
let analyticsCharts = {
    categoryChart: null,
    trendChart: null,
    incomeExpenseChart: null,
    topCategoriesChart: null
};

// Analytics Data
let analysisData = {};
let csvAnalysisData = [];
let csvFileName = '';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded! Please check the CDN link.');
        return;
    }
    
    console.log('Chart.js loaded successfully');
    initializeApp();
    setupEventListeners();
    updateDashboard();
    updateBudgetView();
    updateGoalsView();
    // No need to call updateAnalyticsView here, as it's triggered on section change
});

// Initialize application
function initializeApp() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            showSection(section);
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }

    const goalForm = document.getElementById('goalForm');
    if (goalForm) {
        goalForm.addEventListener('submit', handleGoalSubmit);
    }

    const chatForm = document.getElementById('chatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', handleChatSubmit);
    }

    setupCSVUpload();
    setupAnalyticsCSVUpload();
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionName) {
            link.classList.add('active');
        }
    });

    currentSection = sectionName;

    // Update section-specific content
    if (sectionName === 'dashboard') {
        updateDashboard();
    } else if (sectionName === 'budget') {
        updateBudgetView();
    } else if (sectionName === 'goals') {
        updateGoalsView();
    } else if (sectionName === 'analytics') {
        updateAnalyticsView();
    } else if (sectionName === 'settings') {
        updateSettingsView();
    }
}

// Transaction management
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('transactionType').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    const category = document.getElementById('transactionCategory').value;
    const description = document.getElementById('transactionDescription').value;

    const transaction = {
        id: Date.now(),
        type: type,
        amount: amount,
        category: category,
        description: description,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now()
    };

    transactions.push(transaction);
    saveData();
    
    e.target.reset();
    
    updateDashboard();
    updateBudgetView();
    
    showNotification('Transaction added successfully!', 'success');
}

// Goal management
function handleGoalSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('goalTitle').value;
    const targetAmount = parseFloat(document.getElementById('goalAmount').value);
    const currentAmount = parseFloat(document.getElementById('goalCurrent').value) || 0;
    const deadline = document.getElementById('goalDeadline').value;
    const category = document.getElementById('goalCategory').value;

    const goal = {
        id: Date.now(),
        title: title,
        targetAmount: targetAmount,
        currentAmount: currentAmount,
        deadline: deadline,
        category: category,
        createdAt: new Date().toISOString(),
        progress: (currentAmount / targetAmount) * 100
    };

    goals.push(goal);
    saveData();
    
    e.target.reset();
    
    updateDashboard();
    updateGoalsView();
    
    showNotification('Goal created successfully!', 'success');
}

// AI Chat functionality
function handleChatSubmit(e) {
    e.preventDefault();
    
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    addMessageToChat(message, 'user');
    input.value = '';
    
    showLoading();
    
    setTimeout(() => {
        const aiResponse = generateAIResponse(message);
        addMessageToChat(aiResponse, 'ai');
        hideLoading();
    }, 800);
}

function askQuickQuestion(question) {
    document.getElementById('chatInput').value = question;
    handleChatSubmit({ preventDefault: () => {} });
}

async function getAIResponse(userMessage) {
    const financialContext = getFinancialContext();
    
    const systemPrompt = `You are an expert financial advisor AI assistant. You help users with personal finance, budgeting, investing, debt management, and financial planning. 
User's Financial Context:
${financialContext}
Provide helpful, accurate, and actionable financial advice. Be conversational, supportive, and professional. If the user asks about something not related to finance, politely redirect them to financial topics.`;

    const userPrompt = `User Question: ${userMessage}
Please provide a helpful financial advice response. Keep it concise but informative.`;

    try {
        const response = await callOpenAI(systemPrompt, userPrompt);
        return response;
    } catch (error) {
        console.log('OpenAI failed, trying Gemini...');
        try {
            const response = await callGemini(systemPrompt, userPrompt);
            return response;
        } catch (error2) {
            console.log('Gemini failed, trying Hugging Face...');
            try {
                const response = await callHuggingFace(userPrompt);
                return response;
            } catch (error3) {
                console.log('All AI APIs failed');
                return generateFallbackResponse(userMessage);
            }
        }
    }
}

async function callOpenAI(systemPrompt, userPrompt) {
    const apiKey = getAPIKey('openai');
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            max_tokens: 500,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(systemPrompt, userPrompt) {
    const apiKey = getAPIKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemPrompt}\n\n${userPrompt}`
                }]
            }],
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callHuggingFace(userPrompt) {
    const response = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer hf_your_token_here'
        },
        body: JSON.stringify({
            inputs: `Financial Advisor: ${userPrompt}`,
            parameters: {
                max_length: 200,
                temperature: 0.7
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const data = await response.json();
    return data[0].generated_text;
}

function getFinancialContext() {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netWorth = totalIncome - totalExpenses;
    const transactionCount = transactions.length;
    
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    
    const topCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
        .join(', ');

    return `
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Worth: $${netWorth.toFixed(2)}
- Number of Transactions: ${transactionCount}
- Top Spending Categories: ${topCategories || 'No data available'}
- Active Goals: ${goals.length}
    `.trim();
}

function getAPIKey(provider) {
    const apiKeys = {
        openai: localStorage.getItem('openai_api_key') || '',
        gemini: localStorage.getItem('gemini_api_key') || ''
    };
    return apiKeys[provider];
}

function generateFallbackResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('budget') || message.includes('budgeting')) {
        return `I'd love to help you with budgeting! Here are some key strategies:<br><br>
        <strong>1. 50/30/20 Rule:</strong> Allocate 50% to needs, 30% to wants, 20% to savings.<br>
        <strong>2. Track Everything:</strong> Use this app to monitor all your expenses.<br>
        <strong>3. Set Limits:</strong> Create category-specific budgets.<br><br>
        <em>Note: For more detailed advice, please configure an AI API key in settings.</em>`;
    }
    
    if (message.includes('invest') || message.includes('investment')) {
        return `Great question about investing! Here are some basics:<br><br>
        <strong>Start with:</strong> Emergency fund (3-6 months expenses)<br>
        <strong>Then consider:</strong> Low-cost index funds, 401(k), IRA<br>
        <strong>Diversify:</strong> Don't put all eggs in one basket<br><br>
        <em>Note: For personalized investment advice, please configure an AI API key.</em>`;
    }
    
    if (message.includes('debt') || message.includes('pay off')) {
        return `Debt management is crucial! Here are proven strategies:<br><br>
        <strong>Debt Snowball:</strong> Pay smallest debts first for motivation<br>
        <strong>Debt Avalanche:</strong> Pay highest interest rates first<br>
        <strong>Key:</strong> Stop using credit cards while paying off debt<br><br>
        <em>Note: For detailed debt strategies, please configure an AI API key.</em>`;
    }
    
    return `I'm here to help with your financial questions! I can assist with:<br><br>
    • Budget planning and optimization<br>
    • Investment strategies<br>
    • Debt management<br>
    • Savings goals<br>
    • Financial planning<br><br>
    <em>For more detailed, personalized advice, please configure an AI API key in the settings.</em>`;
}

function addMessageToChat(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<p>${message}</p>`;
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function generateAIResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    if (message.includes('save') || message.includes('saving')) {
        return `Great question about saving! Here are some effective strategies:<br><br>
        <strong>1. 50/30/20 Rule:</strong> Allocate 50% to needs, 30% to wants, and 20% to savings.<br>
        <strong>2. Automate Savings:</strong> Set up automatic transfers to your savings account.<br>
        <strong>3. Emergency Fund:</strong> Aim for 3-6 months of expenses in an emergency fund.<br>
        <strong>4. High-Yield Savings:</strong> Use high-yield savings accounts for better returns.<br><br>
        Based on your current financial data, I recommend starting with 20% of your income for savings. Would you like me to help you set up a specific savings goal?`;
    }
    
    if (message.includes('invest') || message.includes('investment')) {
        return `Investment advice depends on your risk tolerance and timeline. Here's a general approach:<br><br>
        <strong>For Beginners:</strong><br>
        • Start with low-cost index funds (S&P 500)<br>
        • Consider target-date funds for retirement<br>
        • Use dollar-cost averaging<br><br>
        <strong>Portfolio Allocation:</strong><br>
        • 60% Stocks (domestic and international)<br>
        • 30% Bonds<br>
        • 10% Alternative investments<br><br>
        <strong>Important:</strong> Only invest money you won't need for 5+ years. Would you like me to help you create an investment plan based on your goals?`;
    }
    
    if (message.includes('budget') || message.includes('budgeting')) {
        return `Creating a budget is the foundation of good financial health! Here's how to get started:<br><br>
        <strong>Step 1:</strong> Track all your income sources<br>
        <strong>Step 2:</strong> List all your expenses (fixed and variable)<br>
        <strong>Step 3:</strong> Use the 50/30/20 rule or zero-based budgeting<br>
        <strong>Step 4:</strong> Review and adjust monthly<br><br>
        I can see you've already started tracking transactions in this app! Based on your current spending patterns, I can help you optimize your budget. Would you like me to analyze your spending categories?`;
    }
    
    if (message.includes('emergency') || message.includes('fund')) {
        return `An emergency fund is crucial for financial security! Here's what you need to know:<br><br>
        <strong>How much:</strong> 3-6 months of essential expenses<br>
        <strong>Where to keep it:</strong> High-yield savings account or money market account<br>
        <strong>What counts as emergency:</strong> Job loss, medical bills, major car repairs, home repairs<br><br>
        <strong>Quick tip:</strong> Start small - even $500 can help with minor emergencies. Build it gradually by setting aside a small amount each month. Would you like me to help you calculate how much you need for your emergency fund?`;
    }
    
    if (message.includes('debt') || message.includes('pay off')) {
        return `Debt management is key to financial freedom! Here are proven strategies:<br><br>
        <strong>Debt Snowball:</strong> Pay minimums on all debts, then put extra money toward the smallest debt first.<br>
        <strong>Debt Avalanche:</strong> Pay minimums on all debts, then put extra money toward the highest interest rate debt first.<br><br>
        <strong>General Tips:</strong><br>
        • Stop using credit cards while paying off debt<br>
        • Consider balance transfers for high-interest debt<br>
        • Look for ways to increase income or reduce expenses<br><br>
        Which debt strategy interests you most? I can help you create a personalized debt payoff plan.`;
    }
    
    return `I understand you're asking about "${userMessage}". As your AI financial advisor, I'm here to help with:<br><br>
    • Budget planning and optimization<br>
    • Investment strategies and portfolio allocation<br>
    • Debt management and payoff strategies<br>
    • Savings goals and emergency fund planning<br>
    • Retirement planning<br>
    • Tax optimization strategies<br><br>
    Could you be more specific about what financial topic you'd like help with? I can provide personalized advice based on your financial data!`;
}

// Dashboard updates
function updateDashboard() {
    updateSummaryCards();
    updateRecentTransactions();
    updateBudgetComparison();
    updateGoalsSummary();
    
    // Force clear all charts first
    clearAllDashboardCharts();
    
    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
        updateExpenseChart();
        updateTrendChart();
        updateYearlyChart();
    }, 100);
    
    updateExpenseInsights();
    updateTrendAnalysis();
    updateYearlyInsights();
    updateMonthlyBreakdown();
}

function clearAllDashboardCharts() {
    if (dashboardCharts.expenseChart) {
        dashboardCharts.expenseChart.destroy();
        dashboardCharts.expenseChart = null;
    }
    if (dashboardCharts.trendChart) {
        dashboardCharts.trendChart.destroy();
        dashboardCharts.trendChart = null;
    }
    if (dashboardCharts.yearlyChart) {
        dashboardCharts.yearlyChart.destroy();
        dashboardCharts.yearlyChart = null;
    }
    console.log('All dashboard charts cleared');
}

function updateSummaryCards() {
    const totalBalance = calculateTotalBalance();
    const monthlyIncome = calculateMonthlyIncome();
    const monthlyExpenses = calculateMonthlyExpenses();
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100) : 0;

    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
    document.getElementById('monthlyIncome').textContent = formatCurrency(monthlyIncome);
    document.getElementById('monthlyExpenses').textContent = formatCurrency(monthlyExpenses);
    document.getElementById('savingsRate').textContent = savingsRate.toFixed(1) + '%';
}

function updateRecentTransactions() {
    const recentTransactions = document.getElementById('recentTransactions');
    const recent = transactions.slice(-5).reverse();
    
    if (recent.length === 0) {
        recentTransactions.innerHTML = '<div class="no-data">No transactions yet. Add some to get started!</div>';
        return;
    }
    
    recentTransactions.innerHTML = recent.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-category">${formatCategory(transaction.category)}</div>
                <div class="transaction-description">${transaction.description}</div>
            </div>
            <div class="transaction-amount ${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </div>
        </div>
    `).join('');
}

function updateBudgetComparison() {
    const budgetComparison = document.getElementById('budgetComparison');
    const budgetCategories = document.getElementById('budgetCategories');
    
    if (!budgetComparison || !budgetCategories) return;
    
    const categories = getCategoryTotals();
    const monthlyExpenses = calculateMonthlyExpenses();
    const monthlyIncome = calculateMonthlyIncome();
    
    if (Object.keys(categories).length === 0) {
        budgetComparison.innerHTML = '<div class="no-data">Add transactions to see budget comparison</div>';
        budgetCategories.innerHTML = '';
        return;
    }
    
    const budgetLimit = monthlyIncome * 0.8;
    const budgetStatus = monthlyExpenses <= budgetLimit ? 'under' : 'over';
    const budgetDifference = Math.abs(monthlyExpenses - budgetLimit);
    const budgetPercentage = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0;
    
    budgetComparison.innerHTML = `
        <div class="budget-status ${budgetStatus}">
            <div class="budget-status-header">
                <span class="status-label">Budget Status</span>
                <span class="status-value ${budgetStatus}">${budgetStatus.toUpperCase()}</span>
            </div>
            <div class="budget-details">
                <div class="budget-detail">
                    <span class="detail-label">Spent</span>
                    <span class="detail-value">${formatCurrency(monthlyExpenses)}</span>
                </div>
                <div class="budget-detail">
                    <span class="detail-label">Budget</span>
                    <span class="detail-value">${formatCurrency(budgetLimit)}</span>
                </div>
                <div class="budget-detail">
                    <span class="detail-label">Difference</span>
                    <span class="detail-value ${budgetStatus}">${budgetStatus === 'over' ? '+' : '-'}${formatCurrency(budgetDifference)}</span>
                </div>
                <div class="budget-detail">
                    <span class="detail-label">Percentage</span>
                    <span class="detail-value">${budgetPercentage.toFixed(1)}%</span>
                </div>
            </div>
            <div class="budget-progress-bar">
                <div class="progress-bar">
                    <div class="progress-fill ${budgetStatus}" style="width: ${Math.min(budgetPercentage, 100)}%"></div>
                </div>
            </div>
        </div>
    `;
    
    const topCategories = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    budgetCategories.innerHTML = topCategories.map(([category, amount]) => {
        const percentage = monthlyExpenses > 0 ? (amount / monthlyExpenses) * 100 : 0;
        const categoryBudget = budgetLimit * 0.2;
        const categoryStatus = amount <= categoryBudget ? 'good' : 'over';
        
        return `
            <div class="budget-category-item ${categoryStatus}">
                <div class="category-header">
                    <span class="category-name">${formatCategory(category)}</span>
                    <span class="category-amount">${formatCurrency(amount)}</span>
                </div>
                <div class="category-progress">
                    <div class="progress-bar">
                        <div class="progress-fill ${categoryStatus}" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <span class="category-percentage">${percentage.toFixed(1)}%</span>
                </div>
                <div class="category-status">
                    <span class="status-indicator ${categoryStatus}"></span>
                    <span class="status-text">${categoryStatus === 'good' ? 'On Track' : 'Over Budget'}</span>
                </div>
            </div>
        `;
    }).join('');
}

function updateGoalsSummary() {
    const goalsSummary = document.getElementById('goalsSummary');
    const goalsProgress = document.getElementById('goalsProgress');
    
    if (!goalsSummary || !goalsProgress) return;
    
    if (goals.length === 0) {
        goalsSummary.innerHTML = '<div class="no-data">No goals set yet. Create your first financial goal!</div>';
        goalsProgress.innerHTML = '';
        return;
    }
    
    const totalGoals = goals.length;
    const completedGoals = goals.filter(goal => goal.currentAmount >= goal.targetAmount).length;
    const inProgressGoals = totalGoals - completedGoals;
    const totalTargetAmount = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const totalCurrentAmount = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
    const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;
    
    goalsSummary.innerHTML = `
        <div class="goals-stats">
            <div class="goals-stat">
                <span class="stat-label">Total Goals</span>
                <span class="stat-value">${totalGoals}</span>
            </div>
            <div class="goals-stat">
                <span class="stat-label">Completed</span>
                <span class="stat-value">${completedGoals}</span>
            </div>
            <div class="goals-stat">
                <span class="stat-label">In Progress</span>
                <span class="stat-value">${inProgressGoals}</span>
            </div>
            <div class="goals-stat">
                <span class="stat-label">Overall Progress</span>
                <span class="stat-value">${overallProgress.toFixed(1)}%</span>
            </div>
        </div>
    `;
    
    const topGoals = goals
        .sort((a, b) => b.targetAmount - a.targetAmount)
        .slice(0, 3);
    
    goalsProgress.innerHTML = topGoals.map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;
        
        return `
            <div class="goal-progress-item">
                <div class="goal-header">
                    <span class="goal-title">${goal.title}</span>
                    <span class="goal-category">${formatCategory(goal.category)}</span>
                </div>
                <div class="goal-progress-bar">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                    <span class="progress-text">${progress.toFixed(1)}%</span>
                </div>
                <div class="goal-details">
                    <span>${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}</span>
                    <span class="${isOverdue ? 'overdue' : ''}">${isOverdue ? 'Overdue' : daysLeft + ' days left'}</span>
                </div>
                <div class="goal-actions">
                    <button class="btn-small btn-edit" onclick="editGoal(${goal.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-small btn-delete" onclick="deleteGoal(${goal.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Chart initialization and updates
function updateExpenseChart() {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) {
        console.log('Expense chart canvas not found');
        return;
    }
    
    if (dashboardCharts.expenseChart) {
        dashboardCharts.expenseChart.destroy();
    }
    
    const recentMonthData = getMostRecentMonthData();
    
    if (!recentMonthData) {
        ctx.parentElement.innerHTML = `
            <div class="no-data" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; text-align: center;">
                <i class="fas fa-chart-pie" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <h4>No Monthly Data</h4>
                <p>Upload a CSV file for any month to see expense analysis</p>
            </div>
        `;
        return;
    }
    
    const expenseCategories = Object.entries(recentMonthData.categories)
        .filter(([category, amount]) => amount > 0)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 6);
    
    if (expenseCategories.length === 0) {
        ctx.parentElement.innerHTML = `
            <div class="no-data" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; text-align: center;">
                <i class="fas fa-chart-pie" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <h4>No Expense Data</h4>
                <p>No expenses found for this month</p>
            </div>
        `;
        return;
    }
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    
    try {
        dashboardCharts.expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: expenseCategories.map(([category]) => formatCategory(category)),
                datasets: [{
                    data: expenseCategories.map(([, amount]) => amount),
                    backgroundColor: colors.slice(0, expenseCategories.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${formatCurrency(context.parsed)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating expense chart:', error);
        ctx.parentElement.innerHTML = '<div class="no-data">Error creating chart. Please refresh the page.</div>';
    }
}

function getMostRecentMonthData() {
    const allMonthlyData = getAllMonthlyData();
    const monthKeys = Object.keys(allMonthlyData).sort();
    
    if (monthKeys.length === 0) return null;
    
    const mostRecentKey = monthKeys[monthKeys.length - 1];
    return allMonthlyData[mostRecentKey];
}

function updateTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) {
        console.log('Trend chart canvas not found');
        return;
    }
    
    if (dashboardCharts.trendChart) {
        dashboardCharts.trendChart.destroy();
    }
    
    const monthlyTrendData = getMonthlyTrendData();
    
    if (monthlyTrendData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div class="no-data" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; text-align: center;">
                <i class="fas fa-chart-line" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <h4>No Trend Data</h4>
                <p>Add transactions or upload monthly CSV files to see trends</p>
            </div>
        `;
        return;
    }
    
    try {
        dashboardCharts.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyTrendData.map(item => item.month),
                datasets: [{
                    label: 'Income',
                    data: monthlyTrendData.map(item => item.income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Expenses',
                    data: monthlyTrendData.map(item => item.expenses),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating trend chart:', error);
        ctx.parentElement.innerHTML = '<div class="no-data">Error creating chart. Please refresh the page.</div>';
    }
}

function getMonthlyTrendData() {
    const monthlyTotals = {};
    const tempTransactions = [...transactions, ...Object.values(monthlyData).flatMap(m => m.transactions)];
    
    tempTransactions.forEach(transaction => {
        const month = new Date(transaction.date).toISOString().substring(0, 7);
        if (!monthlyTotals[month]) {
            monthlyTotals[month] = { income: 0, expenses: 0 };
        }
        
        if (transaction.type === 'income') {
            monthlyTotals[month].income += transaction.amount;
        } else {
            monthlyTotals[month].expenses += transaction.amount;
        }
    });
    
    return Object.entries(monthlyTotals)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({
            month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            income: data.income,
            expenses: data.expenses
        }));
}

function updateExpenseInsights() {
    const container = document.getElementById('expenseInsights');
    if (!container) return;
    
    const recentMonthData = getMostRecentMonthData();
    
    if (!recentMonthData) {
        container.innerHTML = '<div class="no-data">No monthly data to analyze. Upload CSV data for a month.</div>';
        return;
    }
    
    const categories = recentMonthData.categories;
    const monthlyExpenses = recentMonthData.totalExpenses;
    
    if (Object.keys(categories).length === 0) {
        container.innerHTML = '<div class="no-data">No expense data for this month</div>';
        return;
    }
    
    const topCategory = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)[0];
    
    const insights = generateExpenseInsights(categories, monthlyExpenses);
    
    const allMonthlyData = getAllMonthlyData();
    const monthKeys = Object.keys(allMonthlyData).sort();
    const mostRecentKey = monthKeys[monthKeys.length - 1];
    const monthNumber = parseInt(mostRecentKey.split('-')[1]) - 1;
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    container.innerHTML = `
        <div class="insights-container">
            <div class="insight-item">
                <i class="fas fa-calendar"></i>
                <div class="insight-content">
                    <h4>Current Month Analysis</h4>
                    <p>${monthNames[monthNumber]} ${new Date().getFullYear()}</p>
                </div>
            </div>
            <div class="insight-item">
                <i class="fas fa-chart-pie"></i>
                <div class="insight-content">
                    <h4>Top Spending Category</h4>
                    <p>${formatCategory(topCategory[0])} - ${formatCurrency(topCategory[1])}</p>
                </div>
            </div>
            <div class="insight-item">
                <i class="fas fa-lightbulb"></i>
                <div class="insight-content">
                    <h4>AI Insight</h4>
                    <p>${insights}</p>
                </div>
            </div>
        </div>
    `;
}

function updateTrendAnalysis() {
    const container = document.getElementById('trendAnalysis');
    if (!container) return;
    
    const monthlyData = getMonthlyTrendData();
    
    if (monthlyData.length < 2) {
        container.innerHTML = '<div class="no-data">Need at least 2 months of data for trend analysis</div>';
        return;
    }
    
    const latestMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    
    const incomeChange = previousMonth ?
        ((latestMonth.income - previousMonth.income) / previousMonth.income * 100) : 0;
    const expenseChange = previousMonth ?
        ((latestMonth.expenses - previousMonth.expenses) / previousMonth.expenses * 100) : 0;
    
    container.innerHTML = `
        <div class="trend-analysis-container">
            <div class="trend-item">
                <span class="trend-label">Income Change</span>
                <span class="trend-value ${incomeChange >= 0 ? 'positive' : 'negative'}">
                    ${incomeChange >= 0 ? '+' : ''}${incomeChange.toFixed(1)}%
                </span>
            </div>
            <div class="trend-item">
                <span class="trend-label">Expense Change</span>
                <span class="trend-value ${expenseChange <= 0 ? 'positive' : 'negative'}">
                    ${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}%
                </span>
            </div>
        </div>
    `;
}

function generateExpenseInsights(categories, totalExpenses) {
    const topCategory = Object.entries(categories)
        .sort(([,a], [,b]) => b - a)[0];
    
    const topCategoryPercentage = (topCategory[1] / totalExpenses) * 100;
    
    if (topCategoryPercentage > 40) {
        return `You're spending ${topCategoryPercentage.toFixed(1)}% of your budget on ${formatCategory(topCategory[0])}. Consider diversifying your spending.`;
    } else if (topCategoryPercentage > 25) {
        return `Your spending on ${formatCategory(topCategory[0])} is well-balanced at ${topCategoryPercentage.toFixed(1)}% of total expenses.`;
    } else {
        return `Great job! Your spending is well-distributed across categories. Your top category is only ${topCategoryPercentage.toFixed(1)}% of total expenses.`;
    }
}

// Yearly Analysis Functions
function updateYearlyChart() {
    const ctx = document.getElementById('yearlyChart');
    if (!ctx) {
        console.log('Yearly chart canvas not found');
        return;
    }
    
    if (dashboardCharts.yearlyChart) {
        dashboardCharts.yearlyChart.destroy();
    }
    
    const yearlyData = getYearlyData();
    
    if (yearlyData.length === 0) {
        ctx.parentElement.innerHTML = `
            <div class="no-data" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; text-align: center;">
                <i class="fas fa-chart-pie" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                <h4>No Yearly Data</h4>
                <p>Upload monthly CSV files to see yearly analysis</p>
            </div>
        `;
        return;
    }
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fbbf24', '#f59e0b', '#ef4444', '#10b981'];
    
    try {
        dashboardCharts.yearlyChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: yearlyData.map(item => item.month),
                datasets: [{
                    data: yearlyData.map(item => item.percentage),
                    backgroundColor: colors.slice(0, yearlyData.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const month = context.label;
                                const percentage = context.parsed;
                                const amount = yearlyData[context.dataIndex].amount;
                                return `${month}: ${formatCurrency(amount)} (${percentage.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating yearly chart:', error);
        ctx.parentElement.innerHTML = '<div class="no-data">Error creating chart. Please refresh the page.</div>';
    }
}

function getYearlyData() {
    const currentYear = new Date().getFullYear();
    const allMonthlyData = getAllMonthlyData();
    
    const yearlyData = {};
    Object.keys(allMonthlyData).forEach(monthKey => {
        if (monthKey.startsWith(currentYear)) {
            yearlyData[monthKey] = allMonthlyData[monthKey];
        }
    });
    
    if (Object.keys(yearlyData).length === 0) {
        return [];
    }
    
    const totalYearlyExpenses = Object.values(yearlyData)
        .reduce((sum, data) => sum + data.totalExpenses, 0);
    
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return Object.entries(yearlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, data]) => {
            const monthNumber = parseInt(monthKey.split('-')[1]) - 1;
            const percentage = totalYearlyExpenses > 0 ?
                (data.totalExpenses / totalYearlyExpenses) * 100 : 0;
            
            return {
                month: monthNames[monthNumber],
                amount: data.totalExpenses,
                percentage: percentage
            };
        })
        .filter(item => item.amount > 0);
}

function updateYearlyInsights() {
    const container = document.getElementById('yearlyInsights');
    if (!container) return;
    
    const yearlyData = getYearlyData();
    
    if (yearlyData.length === 0) {
        container.innerHTML = '<div class="no-data">No yearly expense data to analyze</div>';
        return;
    }
    
    const totalYearlyExpenses = yearlyData.reduce((sum, item) => sum + item.amount, 0);
    const highestSpendingMonth = yearlyData.reduce((max, item) =>
        item.amount > max.amount ? item : max, yearlyData[0]);
    const lowestSpendingMonth = yearlyData.reduce((min, item) =>
        item.amount < min.amount ? item : min, yearlyData[0]);
    
    container.innerHTML = `
        <div class="yearly-insights-container">
            <div class="yearly-stat">
                <i class="fas fa-dollar-sign"></i>
                <div class="stat-content">
                    <h4>Total Yearly Expenses</h4>
                    <p>${formatCurrency(totalYearlyExpenses)}</p>
                </div>
            </div>
            <div class="yearly-stat">
                <i class="fas fa-arrow-up"></i>
                <div class="stat-content">
                    <h4>Highest Spending Month</h4>
                    <p>${highestSpendingMonth.month} - ${formatCurrency(highestSpendingMonth.amount)}</p>
                </div>
            </div>
            <div class="yearly-stat">
                <i class="fas fa-arrow-down"></i>
                <div class="stat-content">
                    <h4>Lowest Spending Month</h4>
                    <p>${lowestSpendingMonth.month} - ${formatCurrency(lowestSpendingMonth.amount)}</p>
                </div>
            </div>
        </div>
    `;
}

function updateMonthlyBreakdown() {
    const container = document.getElementById('monthlyBreakdown');
    if (!container) return;
    
    const yearlyData = getYearlyData();
    
    if (yearlyData.length === 0) {
        container.innerHTML = '<div class="no-data">No monthly data to display</div>';
        return;
    }
    
    const sortedData = [...yearlyData].sort((a, b) => b.percentage - a.percentage);
    
    container.innerHTML = `
        <div class="monthly-breakdown-list">
            ${sortedData.map(item => `
                <div class="monthly-item">
                    <div class="month-info">
                        <span class="month-name">${item.month}</span>
                        <span class="month-amount">${formatCurrency(item.amount)}</span>
                    </div>
                    <div class="month-percentage">
                        <div class="percentage-bar">
                            <div class="percentage-fill" style="width: ${item.percentage}%"></div>
                        </div>
                        <span class="percentage-text">${item.percentage.toFixed(1)}%</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Budget view updates
function updateBudgetView() {
    updateBudgetCategories();
    updateTransactionsTable();
}

function updateBudgetCategories() {
    const budgetCategories = document.getElementById('budgetTabCategories');
    const categories = getCategoryTotals();
    
    if (Object.keys(categories).length === 0) {
        budgetCategories.innerHTML = '<div class="no-data">Add transactions to see budget breakdown</div>';
        return;
    }
    
    budgetCategories.innerHTML = Object.entries(categories).map(([category, amount]) => `
        <div class="category-item">
            <span class="category-name">${formatCategory(category)}</span>
            <span class="category-amount">${formatCurrency(amount)}</span>
        </div>
    `).join('');
}

function updateTransactionsTable() {
    const tableBody = document.getElementById('transactionsTableBody');
    
    if (transactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">No transactions yet</td></tr>';
        return;
    }
    
    const sortedTransactions = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    
    tableBody.innerHTML = sortedTransactions.map(transaction => `
        <tr>
            <td>${formatDate(transaction.date)}</td>
            <td><span class="transaction-type ${transaction.type}">${transaction.type}</span></td>
            <td>${formatCategory(transaction.category)}</td>
            <td>${transaction.description}</td>
            <td class="${transaction.type === 'income' ? 'income' : 'expense'}">
                ${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
            </td>
            <td>
                <button class="btn-small btn-delete" onclick="deleteTransaction(${transaction.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Goals view updates
function updateGoalsView() {
    const goalsList = document.getElementById('goalsList');
    
    if (goals.length === 0) {
        goalsList.innerHTML = '<div class="no-data">No goals set yet. Create your first financial goal!</div>';
        return;
    }
    
    goalsList.innerHTML = goals.map(goal => {
        const progress = (goal.currentAmount / goal.targetAmount) * 100;
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="goal-item">
                <div class="goal-header">
                    <span class="goal-title">${goal.title}</span>
                    <span class="goal-category">${formatCategory(goal.category)}</span>
                </div>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                </div>
                <div class="goal-details">
                    <span>${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}</span>
                    <span>${daysLeft > 0 ? daysLeft + ' days left' : 'Deadline passed'}</span>
                </div>
                <div class="goal-actions">
                    <button class="btn-small btn-edit" onclick="editGoal(${goal.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-small btn-delete" onclick="deleteGoal(${goal.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Utility functions
function calculateTotalBalance() {
    return transactions.reduce((total, transaction) => {
        return total + (transaction.type === 'income' ? transaction.amount : -transaction.amount);
    }, 0);
}

function calculateMonthlyIncome() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return transactions
        .filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transaction.type === 'income' &&
                   transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        })
        .reduce((total, transaction) => total + transaction.amount, 0);
}

function calculateMonthlyExpenses() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return transactions
        .filter(transaction => {
            const transactionDate = new Date(transaction.date);
            return transaction.type === 'expense' &&
                   transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        })
        .reduce((total, transaction) => total + transaction.amount, 0);
}

function getCategoryTotals() {
    const categories = {};
    
    transactions.forEach(transaction => {
        if (!categories[transaction.category]) {
            categories[transaction.category] = 0;
        }
        categories[transaction.category] += transaction.amount;
    });
    
    return categories;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatCategory(category) {
    if (!category) return 'Uncategorized';
    return category.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Data management
function saveData() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('goals', JSON.stringify(goals));
    localStorage.setItem('monthlyData', JSON.stringify(monthlyData));
}

function addMonthlyData(month, year, csvTransactions) {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
            transactions: [],
            totalIncome: 0,
            totalExpenses: 0,
            categories: {},
            uploadDate: new Date().toISOString()
        };
    }
    
    monthlyData[monthKey].transactions.push(...csvTransactions);
    
    recalculateMonthlyTotals(monthKey);
    
    transactions.push(...csvTransactions);
    
    saveData();
}

function recalculateMonthlyTotals(monthKey) {
    const monthData = monthlyData[monthKey];
    monthData.totalIncome = 0;
    monthData.totalExpenses = 0;
    monthData.categories = {};
    
    monthData.transactions.forEach(transaction => {
        if (transaction.type === 'income') {
            monthData.totalIncome += transaction.amount;
        } else {
            monthData.totalExpenses += transaction.amount;
            monthData.categories[transaction.category] =
                (monthData.categories[transaction.category] || 0) + transaction.amount;
        }
    });
}

function getMonthlyData(month, year) {
    const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
    return monthlyData[monthKey] || null;
}

function getAllMonthlyData() {
    return monthlyData;
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        transactions = [];
        goals = [];
        monthlyData = {};
        
        localStorage.removeItem('transactions');
        localStorage.removeItem('goals');
        localStorage.removeItem('monthlyData');
        
        clearAllDashboardCharts();
        clearAllAnalyticsCharts();
        
        updateDashboard();
        updateBudgetView();
        updateGoalsView();
        updateAnalyticsView();
        
        showNotification('All data cleared successfully!', 'success');
        console.log('All data cleared and charts reset');
    }
}

function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        transactions = transactions.filter(transaction => transaction.id !== id);
        saveData();
        updateDashboard();
        updateBudgetView();
        showNotification('Transaction deleted successfully!', 'success');
    }
}

function deleteGoal(id) {
    if (confirm('Are you sure you want to delete this goal?')) {
        goals = goals.filter(goal => goal.id !== id);
        saveData();
        updateDashboard();
        updateGoalsView();
        showNotification('Goal deleted successfully!', 'success');
    }
}

function editGoal(id) {
    const goal = goals.find(g => g.id === id);
    if (goal) {
        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalAmount').value = goal.targetAmount;
        document.getElementById('goalCurrent').value = goal.currentAmount;
        document.getElementById('goalDeadline').value = goal.deadline;
        document.getElementById('goalCategory').value = goal.category;
        
        goals = goals.filter(g => g.id !== id);
        saveData();
        
        showSection('goals');
        document.getElementById('goalTitle').focus();
    }
}

// UI helpers
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    let backgroundColor = '#3b82f6';
    if (type === 'success') backgroundColor = '#10b981';
    else if (type === 'error') backgroundColor = '#ef4444';
    else if (type === 'warning') backgroundColor = '#f59e0b';
    
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1500;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// CSV Upload Functionality
function setupCSVUpload() {
    const csvFileInput = document.getElementById('csvFileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    if (!csvFileInput || !uploadArea) return;

    csvFileInput.addEventListener('change', handleCSVFileSelect);
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
            handleCSVFile(files[0]);
        } else {
            showNotification('Please select a valid CSV file.', 'error');
        }
    });

    uploadArea.addEventListener('click', () => {
        csvFileInput.click();
    });
}

function handleCSVFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleCSVFile(file);
    }
}

function handleCSVFile(file) {
    if (file.type !== 'text/csv') {
        showNotification('Please select a valid CSV file.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const csvText = e.target.result;
        parseAndPreviewCSV(csvText);
    };
    reader.readAsText(file);
}

function parseAndPreviewCSV(csvText) {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            showNotification('CSV file is empty.', 'error');
            return;
        }

        const csvData = [];
        const errors = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = parseCSVLine(line);
            
            if (columns.length !== 5) {
                errors.push(`Row ${i + 1}: Expected 5 columns, found ${columns.length}`);
                continue;
            }

            const [date, type, amount, category, description] = columns;
            
            const validation = validateCSVRow(date, type, amount, category, description, i + 1);
            if (validation.isValid) {
                csvData.push({
                    date: date.trim(),
                    type: type.trim().toLowerCase(),
                    amount: parseFloat(amount.trim()),
                    category: category.trim().toLowerCase(),
                    description: description.trim()
                });
            } else {
                errors.push(validation.error);
            }
        }

        if (csvData.length === 0) {
            showNotification('No valid transactions found in CSV file.', 'error');
            return;
        }

        showCSVPreview(csvData, errors);

    } catch (error) {
        showNotification('Error parsing CSV file: ' + error.message, 'error');
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

function validateCSVRow(date, type, amount, category, description, rowNumber) {
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(date.trim())) {
        return {
            isValid: false,
            error: `Row ${rowNumber}: Invalid date format. Use DD-MM-YYYY`
        };
    }

    const validTypes = ['income', 'expense'];
    if (!validTypes.includes(type.trim().toLowerCase())) {
        return {
            isValid: false,
            error: `Row ${rowNumber}: Type must be 'income' or 'expense'`
        };
    }

    const amountNum = parseFloat(amount.trim());
    if (isNaN(amountNum) || amountNum <= 0) {
        return {
            isValid: false,
            error: `Row ${rowNumber}: Amount must be a positive number`
        };
    }

    if (!category.trim()) {
        return {
            isValid: false,
            error: `Row ${rowNumber}: Category cannot be empty`
        };
    }

    if (!description.trim()) {
        return {
            isValid: false,
            error: `Row ${rowNumber}: Description cannot be empty`
        };
    }

    return { isValid: true };
}

function showCSVPreview(csvData, errors) {
    const modal = document.getElementById('csvPreviewModal');
    const content = document.getElementById('csvPreviewContent');
    
    let html = '';
    
    if (errors.length > 0) {
        html += '<div class="csv-error">';
        html += '<h4>Validation Errors:</h4>';
        html += '<ul>';
        errors.forEach(error => {
            html += `<li>${error}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    html += `<div class="csv-success">`;
    html += `<strong>Found ${csvData.length} valid transactions</strong>`;
    if (errors.length > 0) {
        html += ` (${errors.length} rows had errors and were skipped)`;
    }
    html += `</div>`;
    
    html += '<div class="csv-preview-table">';
    html += '<table>';
    html += '<thead>';
    html += '<tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th><th>Description</th></tr>';
    html += '</thead>';
    html += '<tbody>';
    
    csvData.slice(0, 10).forEach(row => {
        html += '<tr>';
        html += `<td>${row.date}</td>`;
        html += `<td><span class="transaction-type ${row.type}">${row.type}</span></td>`;
        html += `<td>${formatCurrency(row.amount)}</td>`;
        html += `<td>${formatCategory(row.category)}</td>`;
        html += `<td>${row.description}</td>`;
        html += '</tr>';
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (csvData.length > 10) {
        html += `<p style="text-align: center; color: #666; margin-top: 10px;">... and ${csvData.length - 10} more transactions</p>`;
    }
    
    html += '</div>';
    
    html += '<div class="csv-preview-actions">';
    html += '<button class="btn-cancel" onclick="closeCSVPreview()">Cancel</button>';
    html += `<button class="btn-import" onclick="importCSVData(${JSON.stringify(csvData).replace(/"/g, '&quot;')})">Import ${csvData.length} Transactions</button>`;
    html += '</div>';
    
    content.innerHTML = html;
    modal.classList.add('show');
}

function closeCSVPreview() {
    const modal = document.getElementById('csvPreviewModal');
    modal.classList.remove('show');
}

function importCSVData(csvData) {
    try {
        const newTransactions = csvData.map(row => {
            const [day, month, year] = row.date.split('-');
            const isoDate = `${year}-${month}-${day}`;

            return {
                id: Date.now() + Math.random(),
                type: row.type,
                amount: row.amount,
                category: row.category,
                description: row.description,
                date: isoDate,
                timestamp: new Date(isoDate).getTime()
            };
        });

        const firstTransaction = newTransactions[0];
        const transactionDate = new Date(firstTransaction.date);
        const month = transactionDate.getMonth() + 1;
        const year = transactionDate.getFullYear();
        
        addMonthlyData(month, year, newTransactions);
        
        updateDashboard();
        updateBudgetView();
        
        closeCSVPreview();
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        showNotification(`Successfully imported ${newTransactions.length} transactions for ${monthNames[month-1]} ${year}!`, 'success');
        
        document.getElementById('csvFileInput').value = '';
        
    } catch (error) {
        showNotification('Error importing data: ' + error.message, 'error');
    }
}

// AI Analytics System
function updateAnalyticsView() {
    initializeAnalyticsCharts();
    performAIAnalysis();
    document.getElementById('analysisControls').style.display = 'none';
    document.getElementById('aiAnalysisSummary').textContent = 'Upload a CSV file to get started with AI-powered financial analysis.';
}

function performAIAnalysis() {
    if (transactions.length === 0) {
        showNotification('No transaction data to analyze. Please add some transactions first.', 'error');
        return;
    }
    
    showLoading();
    
    setTimeout(() => {
        analysisData = performComprehensiveAnalysis(transactions);
        
        updateAnalyticsCharts();
        updateAIRecommendations();
        updateSpendingAlerts();
        updateDetailedAnalysis();
        
        hideLoading();
        showNotification('AI analysis completed! Check out your personalized insights below.', 'success');
    }, 1500);
}

function performComprehensiveAnalysis(data) {
    const analysis = {};

    const originalTransactions = transactions;
    transactions = data;

    analysis.spendingPatterns = analyzeSpendingPatterns();
    analysis.wasteAnalysis = analyzeWastefulSpending();
    analysis.savingsOpportunities = findSavingsOpportunities();
    analysis.trends = analyzeTrends();
    analysis.categories = analyzeCategories();
    
    analysis.recommendations = generateAIRecommendations(analysis);
    analysis.alerts = generateSpendingAlerts(analysis);
    
    transactions = originalTransactions;

    return analysis;
}

function analyzeSpendingPatterns() {
    const patterns = {
        totalSpent: 0,
        averageDaily: 0,
        peakSpendingDay: '',
        peakSpendingCategory: '',
        monthlyTrend: [],
        weeklyPattern: {},
        seasonalTrends: {}
    };
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    patterns.totalSpent = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    if (expenseTransactions.length > 0) {
        const days = Math.max(30, (Date.now() - new Date(expenseTransactions[0].date).getTime()) / (1000 * 60 * 60 * 24));
        patterns.averageDaily = patterns.totalSpent / days;
    }
    
    const dailySpending = {};
    expenseTransactions.forEach(t => {
        const day = new Date(t.date).getDay();
        dailySpending[day] = (dailySpending[day] || 0) + t.amount;
    });
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (Object.keys(dailySpending).length > 0) {
        patterns.peakSpendingDay = dayNames[Object.keys(dailySpending).reduce((a, b) =>
            dailySpending[a] > dailySpending[b] ? a : b)];
    }
    
    const categorySpending = {};
    expenseTransactions.forEach(t => {
        categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });
    
    if (Object.keys(categorySpending).length > 0) {
        patterns.peakSpendingCategory = Object.keys(categorySpending).reduce((a, b) =>
            categorySpending[a] > categorySpending[b] ? a : b);
    }
    
    return patterns;
}

function analyzeWastefulSpending() {
    const waste = {
        unnecessaryExpenses: [],
        impulsePurchases: [],
        subscriptionWaste: [],
        totalWaste: 0,
        wastePercentage: 0
    };
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    expenseTransactions.forEach(transaction => {
        const category = transaction.category.toLowerCase();
        const amount = transaction.amount;
        
        if (category === 'entertainment' && amount > 50) {
            waste.subscriptionWaste.push({
                ...transaction,
                reason: 'High entertainment spending'
            });
        } else if (category === 'shopping' && amount < 100) {
            waste.impulsePurchases.push({
                ...transaction,
                reason: 'Potential impulse purchase'
            });
        } else if (category === 'food' && amount > 30) {
            waste.unnecessaryExpenses.push({
                ...transaction,
                reason: 'High food spending'
            });
        }
    });
    
    waste.totalWaste = waste.unnecessaryExpenses.reduce((sum, item) => sum + item.amount, 0) +
                       waste.impulsePurchases.reduce((sum, item) => sum + item.amount, 0) +
                       waste.subscriptionWaste.reduce((sum, item) => sum + item.amount, 0);
    
    waste.wastePercentage = totalExpenses > 0 ? (waste.totalWaste / totalExpenses) * 100 : 0;
    
    return waste;
}

function findSavingsOpportunities() {
    const opportunities = {
        budgetOptimization: [],
        categoryReductions: [],
        subscriptionAudit: [],
        totalPotentialSavings: 0
    };
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const categoryTotals = {};
    
    expenseTransactions.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    
    Object.entries(categoryTotals).forEach(([category, amount]) => {
        if (amount > 200) {
            const potentialSavings = amount * 0.2;
            opportunities.categoryReductions.push({
                category: category,
                currentSpending: amount,
                potentialSavings: potentialSavings,
                recommendation: `Reduce ${category} spending by 20%`
            });
        }
    });
    
    const subscriptions = expenseTransactions.filter(t =>
        t.category === 'entertainment' && t.amount > 50
    );
    
    subscriptions.forEach(sub => {
        opportunities.subscriptionAudit.push({
            ...sub,
            potentialSavings: sub.amount,
            recommendation: `Review ${sub.description}`
        });
    });
    
    opportunities.totalPotentialSavings =
        opportunities.categoryReductions.reduce((sum, item) => sum + item.potentialSavings, 0) +
        opportunities.subscriptionAudit.reduce((sum, item) => sum + item.potentialSavings, 0);
    
    return opportunities;
}

function generateAIRecommendations(analysis) {
    const recommendations = [];
    
    if (!analysis) return recommendations;
    
    if (analysis.wasteAnalysis && analysis.wasteAnalysis.wastePercentage > 15) {
        recommendations.push({
            title: "Reduce Wasteful Spending",
            description: `You're spending ${analysis.wasteAnalysis.wastePercentage.toFixed(1)}% on potentially wasteful expenses. Focus on reducing unnecessary purchases.`,
            impact: "high",
            potentialSavings: analysis.wasteAnalysis.totalWaste * 0.5,
            action: "Review and eliminate unnecessary expenses"
        });
    }
    
    if (analysis.savingsOpportunities && analysis.savingsOpportunities.totalPotentialSavings > 100) {
        recommendations.push({
            title: "Optimize High-Spending Categories",
            description: `You could save ${formatCurrency(analysis.savingsOpportunities.totalPotentialSavings)} by optimizing your spending in high-cost categories.`,
            impact: "high",
            potentialSavings: analysis.savingsOpportunities.totalPotentialSavings,
            action: "Set category-specific budgets and track spending"
        });
    }
    
    if (analysis.spendingPatterns && analysis.spendingPatterns.averageDaily > 50) {
        recommendations.push({
            title: "Reduce Daily Spending",
            description: `Your average daily spending is ${formatCurrency(analysis.spendingPatterns.averageDaily)}. Try to reduce this by 20%.`,
            impact: "medium",
            potentialSavings: analysis.spendingPatterns.averageDaily * 0.2 * 30,
            action: "Set a daily spending limit and track expenses"
        });
    }
    
    recommendations.push({
        title: "Automate Savings",
        description: "Set up automatic transfers to your savings account to build wealth consistently.",
        impact: "low",
        potentialSavings: 200,
        action: "Set up automatic monthly savings transfers"
    });
    
    return recommendations;
}

function generateSpendingAlerts(analysis) {
    const alerts = [];
    
    if (!analysis) return alerts;
    
    if (analysis.spendingPatterns && analysis.spendingPatterns.averageDaily > 100) {
        alerts.push({
            title: "High Daily Spending Alert",
            description: `Your daily spending average of ${formatCurrency(analysis.spendingPatterns.averageDaily)} is above recommended levels.`,
            severity: "high",
            category: "spending"
        });
    }
    
    if (analysis.wasteAnalysis && analysis.wasteAnalysis.wastePercentage > 20) {
        alerts.push({
            title: "Excessive Wasteful Spending",
            description: `${analysis.wasteAnalysis.wastePercentage.toFixed(1)}% of your spending may be wasteful. Review your expenses.`,
            severity: "high",
            category: "waste"
        });
    }
    
    const categoryTotals = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    
    Object.entries(categoryTotals).forEach(([category, amount]) => {
        if (amount > 500) {
            alerts.push({
                title: `High ${formatCategory(category)} Spending`,
                description: `You've spent ${formatCurrency(amount)} on ${category} this period. Consider reducing this category.`,
                severity: "medium",
                category: "category"
            });
        }
    });
    
    return alerts;
}

function analyzeTrends() {
    const trends = {
        monthlyIncome: [],
        monthlyExpenses: [],
        netWorth: [],
        spendingGrowth: 0
    };
    
    const monthlyData = {};
    
    transactions.forEach(t => {
        const month = new Date(t.date).toISOString().substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, expenses: 0 };
        }
        
        if (t.type === 'income') {
            monthlyData[month].income += t.amount;
        } else {
            monthlyData[month].expenses += t.amount;
        }
    });
    
    Object.entries(monthlyData).sort().forEach(([month, data]) => {
        trends.monthlyIncome.push({ month, amount: data.income });
        trends.monthlyExpenses.push({ month, amount: data.expenses });
        trends.netWorth.push({ month, amount: data.income - data.expenses });
    });
    
    return trends;
}

function analyzeCategories() {
    const categories = {
        expenseCategories: {},
        incomeCategories: {},
        topExpenseCategories: [],
        topIncomeCategories: []
    };
    
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categories.expenseCategories[t.category] = (categories.expenseCategories[t.category] || 0) + t.amount;
    });
    
    transactions.filter(t => t.type === 'income').forEach(t => {
        categories.incomeCategories[t.category] = (categories.incomeCategories[t.category] || 0) + t.amount;
    });
    
    categories.topExpenseCategories = Object.entries(categories.expenseCategories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    categories.topIncomeCategories = Object.entries(categories.incomeCategories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    return categories;
}

// Chart Functions
function initializeAnalyticsCharts() {
    Object.values(analyticsCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    const categoryCtx = document.getElementById('categoryChart');
    if (categoryCtx) {
        analyticsCharts.categoryChart = new Chart(categoryCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    const trendCtx = document.getElementById('analyticsTrendChart');
    if (trendCtx) {
        analyticsCharts.trendChart = new Chart(trendCtx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Income', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true }, { label: 'Expenses', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', tension: 0.4, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    }
    
    const incomeExpenseCtx = document.getElementById('incomeExpenseChart');
    if (incomeExpenseCtx) {
        analyticsCharts.incomeExpenseChart = new Chart(incomeExpenseCtx, {
            type: 'bar',
            data: { labels: ['Current Period'], datasets: [{ label: 'Income', data: [], backgroundColor: '#10b981' }, { label: 'Expenses', data: [], backgroundColor: '#ef4444' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    }
    
    const topCategoriesCtx = document.getElementById('topCategoriesChart');
    if (topCategoriesCtx) {
        analyticsCharts.topCategoriesChart = new Chart(topCategoriesCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Amount Spent', data: [], backgroundColor: '#667eea' }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    }
}

function updateAnalyticsCharts() {
    if (!analysisData || Object.keys(analysisData).length === 0) return;
    
    if (analyticsCharts.categoryChart && analysisData.categories && analysisData.categories.expenseCategories) {
        const categoryData = Object.entries(analysisData.categories.expenseCategories);
        analyticsCharts.categoryChart.data.labels = categoryData.map(([category]) => formatCategory(category));
        analyticsCharts.categoryChart.data.datasets[0].data = categoryData.map(([, amount]) => amount);
        analyticsCharts.categoryChart.update();
    }
    
    if (analyticsCharts.trendChart && analysisData.trends && analysisData.trends.monthlyIncome) {
        const trendData = analysisData.trends;
        analyticsCharts.trendChart.data.labels = trendData.monthlyIncome.map(item => item.month);
        analyticsCharts.trendChart.data.datasets[0].data = trendData.monthlyIncome.map(item => item.amount);
        analyticsCharts.trendChart.data.datasets[1].data = trendData.monthlyExpenses.map(item => item.amount);
        analyticsCharts.trendChart.update();
    }
    
    if (analyticsCharts.incomeExpenseChart && analysisData.spendingPatterns) {
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        analyticsCharts.incomeExpenseChart.data.datasets[0].data = [totalIncome];
        analyticsCharts.incomeExpenseChart.data.datasets[1].data = [totalExpenses];
        analyticsCharts.incomeExpenseChart.update();
    }
    
    if (analyticsCharts.topCategoriesChart && analysisData.categories && analysisData.categories.topExpenseCategories) {
        const topCategories = analysisData.categories.topExpenseCategories.slice(0, 5).reverse();
        analyticsCharts.topCategoriesChart.data.labels = topCategories.map(([category]) => formatCategory(category));
        analyticsCharts.topCategoriesChart.data.datasets[0].data = topCategories.map(([, amount]) => amount);
        analyticsCharts.topCategoriesChart.update();
    }
}

function updateAIRecommendations() {
    const container = document.getElementById('aiRecommendations');
    if (!container || !analysisData) return;
    
    const recommendations = analysisData.recommendations;
    
    if (recommendations.length === 0) {
        container.innerHTML = '<div class="no-data">Great job! No major recommendations at this time.</div>';
        return;
    }
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <div class="recommendation-header">
                <span class="recommendation-title">${rec.title}</span>
                <span class="recommendation-impact ${rec.impact}">${rec.impact.toUpperCase()}</span>
            </div>
            <div class="recommendation-description">${rec.description}</div>
            <div class="recommendation-savings">Potential Savings: ${formatCurrency(rec.potentialSavings)}</div>
        </div>
    `).join('');
}

function updateSpendingAlerts() {
    const container = document.getElementById('spendingAlerts');
    if (!container || !analysisData) return;
    
    const alerts = analysisData.alerts;
    
    if (alerts.length === 0) {
        container.innerHTML = '<div class="no-data">No spending alerts at the moment</div>';
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-item">
            <div class="alert-header">
                <span class="alert-title">${alert.title}</span>
                <span class="alert-severity ${alert.severity}">${alert.severity.toUpperCase()}</span>
            </div>
            <div class="alert-description">${alert.description}</div>
        </div>
    `).join('');
}

function updateDetailedAnalysis() {
    updateSpendingPatterns();
    updateSavingsOpportunities();
    updateWasteAnalysis();
}

function updateSpendingPatterns() {
    const container = document.getElementById('spendingPatterns');
    if (!container || !analysisData || !analysisData.spendingPatterns) return;
    
    const patterns = analysisData.spendingPatterns;
    
    container.innerHTML = `
        <div class="analysis-item">
            <h4>Spending Overview</h4>
            <p>Your spending patterns reveal important insights about your financial habits.</p>
            <div class="analysis-stats">
                <div class="stat-item">
                    <div class="stat-value">${formatCurrency(patterns.totalSpent)}</div>
                    <div class="stat-label">Total Spent</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${formatCurrency(patterns.averageDaily)}</div>
                    <div class="stat-label">Daily Average</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${patterns.peakSpendingCategory ? formatCategory(patterns.peakSpendingCategory) : 'N/A'}</div>
                    <div class="stat-label">Top Category</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${patterns.peakSpendingDay || 'N/A'}</div>
                    <div class="stat-label">Peak Day</div>
                </div>
            </div>
        </div>
    `;
}

function updateSavingsOpportunities() {
    const container = document.getElementById('savingsOpportunities');
    if (!container || !analysisData || !analysisData.savingsOpportunities) return;
    
    const opportunities = analysisData.savingsOpportunities;
    
    let html = `
        <div class="analysis-item savings-item">
            <h4>Savings Potential</h4>
            <p>You have significant opportunities to increase your savings.</p>
            <div class="analysis-stats">
                <div class="stat-item">
                    <div class="stat-value">${formatCurrency(opportunities.totalPotentialSavings)}</div>
                    <div class="stat-label">Potential Savings</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${opportunities.categoryReductions.length}</div>
                    <div class="stat-label">Categories to Optimize</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${opportunities.subscriptionAudit.length}</div>
                    <div class="stat-label">Subscriptions to Review</div>
                </div>
            </div>
        </div>
    `;
    
    if (opportunities.categoryReductions.length > 0) {
        html += `
            <div class="analysis-item">
                <h4>Category Optimization</h4>
                <p>These categories offer the highest savings potential:</p>
                ${opportunities.categoryReductions.map(item => `
                    <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 8px;">
                        <strong>${formatCategory(item.category)}</strong>: ${formatCurrency(item.currentSpending)}
                        → Potential savings: ${formatCurrency(item.potentialSavings)}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function updateWasteAnalysis() {
    const container = document.getElementById('wasteAnalysis');
    if (!container || !analysisData || !analysisData.wasteAnalysis) return;
    
    const waste = analysisData.wasteAnalysis;
    
    container.innerHTML = `
        <div class="analysis-item waste-item">
            <h4>Waste Analysis</h4>
            <p>Analysis of potentially wasteful spending patterns.</p>
            <div class="analysis-stats">
                <div class="stat-item">
                    <div class="stat-value">${formatCurrency(waste.totalWaste)}</div>
                    <div class="stat-label">Total Waste</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${waste.wastePercentage.toFixed(1)}%</div>
                    <div class="stat-label">Waste Percentage</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${waste.unnecessaryExpenses.length + waste.impulsePurchases.length}</div>
                    <div class="stat-label">Questionable Expenses</div>
                </div>
            </div>
        </div>
        
        ${waste.unnecessaryExpenses.length > 0 ? `
            <div class="analysis-item">
                <h4>Unnecessary Expenses</h4>
                <p>These expenses might be unnecessary:</p>
                ${waste.unnecessaryExpenses.slice(0, 5).map(item => `
                    <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 8px;">
                        <strong>${formatCurrency(item.amount)}</strong> - ${item.description}
                        <br><small>${item.reason}</small>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

function updateAnalysisSummary() {
    const container = document.getElementById('aiAnalysisSummary');
    if (!container || !analysisData) return;
    
    const totalTransactions = csvAnalysisData.length;
    const totalIncome = csvAnalysisData.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = csvAnalysisData.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netWorth = totalIncome - totalExpenses;
    
    container.innerHTML = `
        <strong>CSV Analysis Complete!</strong> Based on ${totalTransactions} transactions from your uploaded file,
        you have a net worth of ${formatCurrency(netWorth)}.
        ${analysisData.recommendations.length > 0 ?
            `I've identified ${analysisData.recommendations.length} recommendations that could save you up to ${formatCurrency(analysisData.savingsOpportunities.totalPotentialSavings)}.` :
            'Your financial habits look good!'
        }
    `;
}

function showAnalysisTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    const clickedButton = event.target.closest('.tab-btn');
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

function setupAnalyticsCSVUpload() {
    const analyticsCsvInput = document.getElementById('analyticsCsvInput');
    const analyticsUploadArea = document.getElementById('analyticsUploadArea');
    
    if (!analyticsCsvInput || !analyticsUploadArea) return;

    analyticsCsvInput.addEventListener('change', handleAnalyticsCSVFileSelect);

    analyticsUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        analyticsUploadArea.classList.add('dragover');
    });

    analyticsUploadArea.addEventListener('dragleave', () => {
        analyticsUploadArea.classList.remove('dragover');
    });

    analyticsUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        analyticsUploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
            handleAnalyticsCSVFile(files[0]);
        } else {
            showNotification('Please select a valid CSV file.', 'error');
        }
    });

    analyticsUploadArea.addEventListener('click', () => {
        analyticsCsvInput.click();
    });
}

function handleAnalyticsCSVFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleAnalyticsCSVFile(file);
    }
}

function handleAnalyticsCSVFile(file) {
    if (file.type !== 'text/csv') {
        showNotification('Please select a valid CSV file.', 'error');
        return;
    }

    csvFileName = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvText = e.target.result;
        parseAnalyticsCSV(csvText);
    };
    reader.readAsText(file);
}

function parseAnalyticsCSV(csvText) {
    try {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            showNotification('CSV file is empty.', 'error');
            return;
        }

        csvAnalysisData = [];
        const errors = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = parseCSVLine(line);
            
            if (columns.length !== 5) {
                errors.push(`Row ${i + 1}: Expected 5 columns, found ${columns.length}`);
                continue;
            }

            const [date, type, amount, category, description] = columns;
            
            const validation = validateCSVRow(date, type, amount, category, description, i + 1);
            if (validation.isValid) {
                const [day, month, year] = date.trim().split('-');
                const isoDate = `${year}-${month}-${day}`;

                csvAnalysisData.push({
                    id: Date.now() + Math.random(),
                    date: isoDate,
                    type: type.trim().toLowerCase(),
                    amount: parseFloat(amount.trim()),
                    category: category.trim().toLowerCase(),
                    description: description.trim(),
                    timestamp: new Date(isoDate).getTime()
                });
            } else {
                errors.push(validation.error);
            }
        }

        if (csvAnalysisData.length === 0) {
            showNotification('No valid transactions found in CSV file.', 'error');
            return;
        }

        showAnalysisControls(csvAnalysisData.length, errors.length);
        
        if (errors.length > 0) {
            showNotification(`CSV uploaded with ${errors.length} validation errors. Analysis will use ${csvAnalysisData.length} valid transactions.`, 'warning');
        } else {
            showNotification(`CSV uploaded successfully! ${csvAnalysisData.length} transactions ready for analysis.`, 'success');
        }
    } catch (error) {
        showNotification('Error parsing CSV file: ' + error.message, 'error');
    }
}

function showAnalysisControls(validTransactions, errorCount) {
    const analysisControls = document.getElementById('analysisControls');
    const uploadedFileInfo = document.getElementById('uploadedFileInfo');
    
    uploadedFileInfo.innerHTML = `
        <strong>File:</strong> ${csvFileName}<br>
        <strong>Valid Transactions:</strong> ${validTransactions}
        ${errorCount > 0 ? `<br><strong>Errors:</strong> ${errorCount} rows skipped` : ''}
    `;
    
    analysisControls.style.display = 'block';
    
    document.getElementById('aiAnalysisSummary').textContent =
        `CSV file uploaded successfully! Click "Analyze CSV Data" to get AI-powered insights about your ${validTransactions} transactions.`;
}

function performCSVAnalysis() {
    if (csvAnalysisData.length === 0) {
        showNotification('No CSV data to analyze. Please upload a CSV file first.', 'error');
        return;
    }
    
    showLoading();
    
    analysisData = performComprehensiveAnalysis(csvAnalysisData);
    
    updateAnalyticsCharts();
    updateAIRecommendations();
    updateSpendingAlerts();
    updateDetailedAnalysis();
    updateAnalysisSummary();
    
    hideLoading();
    showNotification('AI analysis completed! Check out your personalized insights below.', 'success');
}

function clearAllAnalyticsCharts() {
    Object.values(analyticsCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
}

// Settings Functions
function updateSettingsView() {
    updateAPIStatus();
    loadSavedAPIKeys();
}

function saveAPIKey(provider) {
    const inputId = provider === 'openai' ? 'openaiKey' : 'geminiKey';
    const key = document.getElementById(inputId).value.trim();
    
    if (!key) {
        showNotification('Please enter a valid API key', 'error');
        return;
    }
    
    localStorage.setItem(`${provider}_api_key`, key);
    
    document.getElementById(inputId).value = '';
    
    updateAPIStatus();
    
    showNotification(`${provider.toUpperCase()} API key saved successfully!`, 'success');
}

function loadSavedAPIKeys() {
    const openaiKey = localStorage.getItem('openai_api_key');
    const geminiKey = localStorage.getItem('gemini_api_key');
    
    if (openaiKey) {
        document.getElementById('openaiKey').value = openaiKey;
    }
    if (geminiKey) {
        document.getElementById('geminiKey').value = geminiKey;
    }
}

function updateAPIStatus() {
    const openaiKey = localStorage.getItem('openai_api_key');
    const geminiKey = localStorage.getItem('gemini_api_key');
    
    const openaiStatus = document.getElementById('openaiStatus');
    const geminiStatus = document.getElementById('geminiStatus');
    
    if (openaiKey) {
        openaiStatus.textContent = 'Configured';
        openaiStatus.className = 'status-value configured';
    } else {
        openaiStatus.textContent = 'Not configured';
        openaiStatus.className = 'status-value not-configured';
    }
    
    if (geminiKey) {
        geminiStatus.textContent = 'Configured';
        geminiStatus.className = 'status-value configured';
    } else {
        geminiStatus.textContent = 'Not configured';
        geminiStatus.className = 'status-value not-configured';
    }
}

function exportData() {
    const data = {
        transactions: transactions,
        goals: goals,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-finance-advisor-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully!', 'success');
}

function toggleCsvUpload() {
    const csvSection = document.getElementById('csvAnalysisSection');
    if (csvSection.style.display === 'none' || csvSection.style.display === '') {
        csvSection.style.display = 'block';
    } else {
        csvSection.style.display = 'none';
    }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .transaction-type {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 500;
        text-transform: capitalize;
    }
    
    .transaction-type.income {
        background: #d1fae5;
        color: #065f46;
    }
    
    .transaction-type.expense {
        background: #fee2e2;
        color: #991b1b;
    }
`;
document.head.appendChild(style);