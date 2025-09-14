class BudgetTracker {
    constructor() {
        this.transactions = [];
        this.jsonBinId = null;
        this.apiKey = '$2a$10$Kt6x/YxTouo13nyZzfobMuMXAxNs1IonhmWaBPGyqWFFvceNMsw26'; 
        this.charts = {};
    }

    async init() {
        await this.loadData();
        this.render();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const form = document.getElementById('transaction-form');
        const filterType = document.getElementById('filter-type');
        const filterCategory = document.getElementById('filter-category');
        const navButtons = document.querySelectorAll('.nav-btn');

        form.addEventListener('submit', (e) => this.handleSubmit(e));
        filterType.addEventListener('change', () => this.render());
        filterCategory.addEventListener('change', () => this.render());
        
        // Navigation event listeners
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const description = document.getElementById('description').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const type = document.getElementById('type').value;
        const category = document.getElementById('category').value;

        if (!description || !amount) {
            alert('Please fill in all fields');
            return;
        }

        const transaction = {
            id: Date.now(),
            description,
            amount: type === 'expense' ? -amount : amount,
            type,
            category,
            date: new Date().toISOString()
        };

        this.transactions.unshift(transaction);
        await this.saveData();
        this.render();
        this.resetForm();
    }

    resetForm() {
        document.getElementById('transaction-form').reset();
    }

    render() {
        this.renderBalance();
        this.renderSummary();
        this.renderTransactions();
        this.renderDashboard();
        this.renderAnalytics();
    }

    renderBalance() {
        const balance = this.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
        document.getElementById('balance').textContent = balance.toFixed(2);
    }

    renderSummary() {
        const income = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expense = Math.abs(this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0));

        document.getElementById('total-income').textContent = income.toFixed(2);
        document.getElementById('total-expense').textContent = expense.toFixed(2);
    }

    renderTransactions() {
        const filterType = document.getElementById('filter-type').value;
        const filterCategory = document.getElementById('filter-category').value;
        
        let filteredTransactions = this.transactions;

        if (filterType !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
        }

        if (filterCategory !== 'all') {
            filteredTransactions = filteredTransactions.filter(t => t.category === filterCategory);
        }

        const transactionsList = document.getElementById('transactions-list');
        
        if (filteredTransactions.length === 0) {
            transactionsList.innerHTML = '<p class="no-transactions">No transactions found.</p>';
            return;
        }

        transactionsList.innerHTML = filteredTransactions.map(transaction => `
            <div class="transaction-item ${transaction.type}">
                <div class="transaction-info">
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-category">${transaction.category} • ${new Date(transaction.date).toLocaleDateString()}</div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.amount > 0 ? '+' : ''}$${transaction.amount.toFixed(2)}
                </div>
                <button class="delete-btn" onclick="budgetTracker.deleteTransaction(${transaction.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    async deleteTransaction(id) {
        if (confirm('Are you sure you want to delete this transaction?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            await this.saveData();
            this.render();
        }
    }

    async saveData() {
        this.showLoading();
        
        try {
            const data = {
                transactions: this.transactions,
                lastUpdated: new Date().toISOString()
            };

            if (this.jsonBinId) {
                // Update existing bin
                await this.updateJsonBin(this.jsonBinId, data);
            } else {
                // Create new bin
                this.jsonBinId = await this.createJsonBin(data);
            }
        } catch (error) {
            console.error('Error saving data:', error);
            // Fallback to localStorage
            localStorage.setItem('budgetTracker', JSON.stringify(this.transactions));
            alert('Error syncing with cloud. Data saved locally.');
        } finally {
            this.hideLoading();
        }
    }

    async loadData() {
        this.showLoading();
        
        try {
            // Try to load from cloud first
            const cloudData = await this.loadFromCloud();
            if (cloudData && cloudData.transactions) {
                this.transactions = cloudData.transactions;
                return;
            }
        } catch (error) {
            console.error('Error loading from cloud:', error);
        }

        // Fallback to localStorage
        const localData = localStorage.getItem('budgetTracker');
        if (localData) {
            this.transactions = JSON.parse(localData);
        }
        
        this.hideLoading();
    }

    async createJsonBin(data) {
        const response = await fetch('https://api.jsonbin.io/v3/b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to create cloud storage');
        }

        const result = await response.json();
        return result.metadata.id;
    }

    async updateJsonBin(binId, data) {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to update cloud storage');
        }
    }

    async loadFromCloud() {
        if (!this.jsonBinId) {
            throw new Error('No cloud storage ID');
        }

        const response = await fetch(`https://api.jsonbin.io/v3/b/${this.jsonBinId}/latest`, {
            headers: {
                'X-Master-Key': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load from cloud storage');
        }

        const result = await response.json();
        return result.record;
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    // Export data as JSON
    exportData() {
        const dataStr = JSON.stringify(this.transactions, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'budget-data.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    // Import data from JSON file
    importData(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    this.transactions = importedData;
                    await this.saveData();
                    this.render();
                    alert('Data imported successfully!');
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                alert('Error importing data');
            }
        };
        reader.readAsText(file);
    }

    // Navigation methods
    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Add active class to clicked button
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Render charts if switching to dashboard or analytics
        if (tabName === 'dashboard' || tabName === 'analytics') {
            setTimeout(() => {
                this.renderDashboard();
                this.renderAnalytics();
            }, 100);
        }
    }

    // Dashboard rendering methods
    renderDashboard() {
        this.renderExpenseChart();
        this.renderMonthlyChart();
        this.renderBalanceChart();
        this.renderQuickStats();
    }

    renderExpenseChart() {
        const ctx = document.getElementById('expenseChart');
        if (!ctx) return;

        if (this.charts.expenseChart) {
            this.charts.expenseChart.destroy();
        }

        const expenseData = this.getExpenseByCategory();
        const labels = Object.keys(expenseData);
        const data = Object.values(expenseData);

        this.charts.expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    renderMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;

        if (this.charts.monthlyChart) {
            this.charts.monthlyChart.destroy();
        }

        const monthlyData = this.getMonthlyData();
        const labels = monthlyData.labels;
        const incomeData = monthlyData.income;
        const expenseData = monthlyData.expenses;

        this.charts.monthlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: '#4CAF50'
                }, {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: '#f44336'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderBalanceChart() {
        const ctx = document.getElementById('balanceChart');
        if (!ctx) return;

        if (this.charts.balanceChart) {
            this.charts.balanceChart.destroy();
        }

        const balanceData = this.getBalanceTrend();
        const labels = balanceData.labels;
        const data = balanceData.balances;

        this.charts.balanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Balance',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderQuickStats() {
        const today = new Date().toDateString();
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const todaySpending = this.transactions
            .filter(t => t.type === 'expense' && new Date(t.date).toDateString() === today)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const weekSpending = this.transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= weekAgo)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const monthSpending = this.transactions
            .filter(t => t.type === 'expense' && new Date(t.date) >= monthAgo)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const biggestExpense = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((max, t) => Math.abs(t.amount) > Math.abs(max.amount) ? t : max, {amount: 0});

        document.getElementById('today-spending').textContent = todaySpending.toFixed(2);
        document.getElementById('week-spending').textContent = weekSpending.toFixed(2);
        document.getElementById('month-spending').textContent = monthSpending.toFixed(2);
        document.getElementById('biggest-expense').textContent = Math.abs(biggestExpense.amount).toFixed(2);
    }

    // Analytics rendering methods
    renderAnalytics() {
        this.renderIncomeExpenseChart();
        this.renderWeeklyChart();
        this.renderCategoryBreakdown();
    }

    renderIncomeExpenseChart() {
        const ctx = document.getElementById('incomeExpenseChart');
        if (!ctx) return;

        if (this.charts.incomeExpenseChart) {
            this.charts.incomeExpenseChart.destroy();
        }

        const data = this.getWeeklyIncomeExpense();
        const labels = data.labels;
        const incomeData = data.income;
        const expenseData = data.expenses;

        this.charts.incomeExpenseChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Income',
                    data: incomeData,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    fill: true
                }, {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderWeeklyChart() {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;

        if (this.charts.weeklyChart) {
            this.charts.weeklyChart.destroy();
        }

        const data = this.getWeeklySpending();
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const spendingData = data;

        this.charts.weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Spending',
                    data: spendingData,
                    backgroundColor: '#667eea',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderCategoryBreakdown() {
        const container = document.getElementById('category-breakdown');
        if (!container) return;

        const expenseData = this.getExpenseByCategory();
        const totalExpenses = Object.values(expenseData).reduce((sum, val) => sum + val, 0);

        container.innerHTML = Object.entries(expenseData)
            .map(([category, amount]) => {
                const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0;
                return `
                    <div class="category-item">
                        <span class="category-name">${category}</span>
                        <span class="category-amount">$${amount.toFixed(2)} (${percentage}%)</span>
                    </div>
                `;
            })
            .join('');
    }

    // Data processing methods
    getExpenseByCategory() {
        const expenses = this.transactions.filter(t => t.type === 'expense');
        const categories = {};
        
        expenses.forEach(expense => {
            const category = expense.category;
            categories[category] = (categories[category] || 0) + Math.abs(expense.amount);
        });
        
        return categories;
    }

    getMonthlyData() {
        const monthlyData = {};
        
        this.transactions.forEach(transaction => {
            const month = new Date(transaction.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            if (!monthlyData[month]) {
                monthlyData[month] = { income: 0, expenses: 0 };
            }
            
            if (transaction.type === 'income') {
                monthlyData[month].income += transaction.amount;
            } else {
                monthlyData[month].expenses += Math.abs(transaction.amount);
            }
        });
        
        const labels = Object.keys(monthlyData).slice(-6); // Last 6 months
        const income = labels.map(label => monthlyData[label]?.income || 0);
        const expenses = labels.map(label => monthlyData[label]?.expenses || 0);
        
        return { labels, income, expenses };
    }

    getBalanceTrend() {
        const sortedTransactions = [...this.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        const balances = [];
        const labels = [];
        
        sortedTransactions.forEach(transaction => {
            runningBalance += transaction.amount;
            balances.push(runningBalance);
            labels.push(new Date(transaction.date).toLocaleDateString());
        });
        
        return { labels: labels.slice(-10), balances: balances.slice(-10) }; // Last 10 transactions
    }

    getWeeklyIncomeExpense() {
        const weeklyData = {};
        
        this.transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
            const weekKey = weekStart.toLocaleDateString();
            
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { income: 0, expenses: 0 };
            }
            
            if (transaction.type === 'income') {
                weeklyData[weekKey].income += transaction.amount;
            } else {
                weeklyData[weekKey].expenses += Math.abs(transaction.amount);
            }
        });
        
        const labels = Object.keys(weeklyData).slice(-4); // Last 4 weeks
        const income = labels.map(label => weeklyData[label]?.income || 0);
        const expenses = labels.map(label => weeklyData[label]?.expenses || 0);
        
        return { labels, income, expenses };
    }

    getWeeklySpending() {
        const weekDays = [0, 1, 2, 3, 4, 5, 6]; // Sunday = 0
        const spending = weekDays.map(() => 0);
        
        this.transactions.forEach(transaction => {
            if (transaction.type === 'expense') {
                const dayOfWeek = new Date(transaction.date).getDay();
                spending[dayOfWeek] += Math.abs(transaction.amount);
            }
        });
        
        // Rearrange to start with Monday
        return [spending[1], spending[2], spending[3], spending[4], spending[5], spending[6], spending[0]];
    }
}

// Initialize the budget tracker when the page loads
let budgetTracker;
document.addEventListener('DOMContentLoaded', () => {
    budgetTracker = new BudgetTracker();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            budgetTracker.saveData();
        }
    });
});

// Service Worker for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
