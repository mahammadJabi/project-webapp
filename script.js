class BudgetTracker {
    constructor() {
        this.transactions = [];
        this.jsonBinId = null;
        this.apiKey = 'YOUR_JSONBIN_API_KEY'; // Replace with your JSONBin.io API key
        this.init();
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

        form.addEventListener('submit', (e) => this.handleSubmit(e));
        filterType.addEventListener('change', () => this.render());
        filterCategory.addEventListener('change', () => this.render());
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
