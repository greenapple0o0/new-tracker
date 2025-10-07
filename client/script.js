class CoupleTracker {
    constructor() {
        this.apiBase = window.location.hostname === 'localhost' ? 
            'http://localhost:3000/api' : '/api';
        this.scores = null;
        this.init();
    }

    async init() {
        await this.loadScores();
        this.setupEventListeners();
        this.render();
    }

    async loadScores() {
        try {
            const response = await fetch(`${this.apiBase}/scores`);
            this.scores = await response.json();
        } catch (error) {
            console.error('Error loading scores:', error);
            // Initialize with default scores if API fails
            this.scores = {
                player1: 'You',
                player2: 'Girlfriend',
                player1Score: 0,
                player2Score: 0,
                categories: []
            };
        }
    }

    async saveScores() {
        try {
            const response = await fetch(`${this.apiBase}/scores`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.scores)
            });
            this.scores = await response.json();
            this.render();
        } catch (error) {
            console.error('Error saving scores:', error);
        }
    }

    async addCategory(name) {
        try {
            const response = await fetch(`${this.apiBase}/scores/category`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name })
            });
            this.scores = await response.json();
            this.render();
        } catch (error) {
            console.error('Error adding category:', error);
        }
    }

    setupEventListeners() {
        // Player name changes
        document.getElementById('player1Name').addEventListener('change', (e) => {
            this.scores.player1 = e.target.value;
            this.saveScores();
        });

        document.getElementById('player2Name').addEventListener('change', (e) => {
            this.scores.player2 = e.target.value;
            this.saveScores();
        });

        // Control buttons
        document.getElementById('addCategory').addEventListener('click', () => {
            this.showCategoryModal();
        });

        document.getElementById('resetScores').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all scores?')) {
                this.resetAllScores();
            }
        });

        // Modal events
        const modal = document.getElementById('categoryModal');
        document.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('saveCategory').addEventListener('click', () => {
            this.saveNewCategory();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    showCategoryModal() {
        document.getElementById('categoryModal').style.display = 'block';
        document.getElementById('newCategoryName').value = '';
        document.getElementById('newCategoryName').focus();
    }

    async saveNewCategory() {
        const name = document.getElementById('newCategoryName').value.trim();
        if (name) {
            await this.addCategory(name);
            document.getElementById('categoryModal').style.display = 'none';
        }
    }

    async updateCategoryScore(categoryIndex, player, change) {
        const category = this.scores.categories[categoryIndex];
        const playerKey = player === 1 ? 'player1Score' : 'player2Score';
        const totalKey = player === 1 ? 'player1Score' : 'player2Score';

        category[playerKey] = Math.max(0, category[playerKey] + change);
        this.scores[totalKey] = Math.max(0, this.scores[totalKey] + change);

        await this.saveScores();
    }

    async resetAllScores() {
        this.scores.player1Score = 0;
        this.scores.player2Score = 0;
        this.scores.categories.forEach(category => {
            category.player1Score = 0;
            category.player2Score = 0;
        });
        await this.saveScores();
    }

    render() {
        if (!this.scores) return;

        // Update player names and total scores
        document.getElementById('player1Name').value = this.scores.player1;
        document.getElementById('player2Name').value = this.scores.player2;
        document.getElementById('player1Score').textContent = this.scores.player1Score;
        document.getElementById('player2Score').textContent = this.scores.player2Score;

        // Render categories
        const container = document.getElementById('categoriesContainer');
        container.innerHTML = '';

        this.scores.categories.forEach((category, index) => {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'category';
            categoryEl.innerHTML = `
                <div class="category-header">
                    <div class="category-name">${category.name}</div>
                </div>
                <div class="category-scores">
                    <div class="score-control">
                        <button class="score-btn btn-player1" onclick="tracker.updateCategoryScore(${index}, 1, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                        <div class="category-score" style="color: var(--player1)">
                            ${category.player1Score}
                        </div>
                        <button class="score-btn btn-player1" onclick="tracker.updateCategoryScore(${index}, 1, -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                    </div>
                    <div class="score-control">
                        <button class="score-btn btn-player2" onclick="tracker.updateCategoryScore(${index}, 2, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                        <div class="category-score" style="color: var(--player2)">
                            ${category.player2Score}
                        </div>
                        <button class="score-btn btn-player2" onclick="tracker.updateCategoryScore(${index}, 2, -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(categoryEl);
        });

        // Show winner if there's a significant difference
        this.showWinner();
    }

    showWinner() {
        const winnerSection = document.getElementById('winnerSection');
        const winnerText = document.getElementById('winnerText');
        const diff = Math.abs(this.scores.player1Score - this.scores.player2Score);

        if (diff >= 10) {
            const winner = this.scores.player1Score > this.scores.player2Score ? 
                this.scores.player1 : this.scores.player2;
            winnerText.textContent = `🏆 ${winner} is winning by ${diff} points! 🏆`;
            winnerSection.classList.add('show');
        } else {
            winnerSection.classList.remove('show');
        }
    }
}

// Initialize the tracker when the page loads
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new CoupleTracker();
});