class CompetitiveTrack {
    constructor() {
        this.apiBase = '/api';
        this.scores = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        this.setupLoginListeners();
    }

    setupLoginListeners() {
        // User selection
        document.querySelectorAll('.user-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.user-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
            });
        });

        // Start game button
        document.getElementById('startGame').addEventListener('click', () => {
            this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && document.getElementById('loginPage').style.display !== 'none') {
                this.handleLogin();
            }
        });
    }

    handleLogin() {
        const selectedUser = document.querySelector('.user-option.selected');
        if (!selectedUser) {
            alert('Please select your profile!');
            return;
        }

        this.currentUser = selectedUser.dataset.user;
        
        // Hide login, show app
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';

        // Update current user display
        document.getElementById('currentUser').textContent = 
            this.currentUser === 'nish' ? 'Nish' : 'Jess';

        // Initialize the app
        this.initializeApp();
    }

    logout() {
        // Show login, hide app
        document.getElementById('app').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        
        // Reset selection
        document.querySelectorAll('.user-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        this.currentUser = null;
    }

    async initializeApp() {
        await this.loadScores();
        this.setupEventListeners();
        this.render();
    }

    async loadScores() {
        try {
            const response = await fetch(`${this.apiBase}/scores`);
            this.scores = await response.json();
            
            // Ensure player names are fixed
            this.scores.player1 = 'Nish';
            this.scores.player2 = 'Jess';
            
        } catch (error) {
            console.error('Error loading scores:', error);
            // Initialize with default scores if API fails
            this.scores = {
                player1: 'Nish',
                player2: 'Jess',
                player1Score: 0,
                player2Score: 0,
                categories: []
            };
        }
    }

    async saveScores() {
        try {
            // Ensure names remain fixed
            this.scores.player1 = 'Nish';
            this.scores.player2 = 'Jess';
            
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

    async addTask(name, points) {
        try {
            const response = await fetch(`${this.apiBase}/scores/category`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    name: name,
                    points: parseInt(points) || 1
                })
            });
            this.scores = await response.json();
            this.render();
        } catch (error) {
            console.error('Error adding task:', error);
        }
    }

    setupEventListeners() {
        // Control buttons
        document.getElementById('addCategory').addEventListener('click', () => {
            this.showTaskModal();
        });

        document.getElementById('resetScores').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all scores and tasks?')) {
                this.resetAllScores();
            }
        });

        // Modal events
        const modal = document.getElementById('taskModal');
        document.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('saveTask').addEventListener('click', () => {
            this.saveNewTask();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    showTaskModal() {
        document.getElementById('taskModal').style.display = 'block';
        document.getElementById('newTaskName').value = '';
        document.getElementById('newTaskPoints').value = '1';
        document.getElementById('newTaskName').focus();
    }

    async saveNewTask() {
        const name = document.getElementById('newTaskName').value.trim();
        const points = document.getElementById('newTaskPoints').value;
        
        if (name) {
            await this.addTask(name, points);
            document.getElementById('taskModal').style.display = 'none';
        }
    }

    async toggleTaskCompletion(taskIndex, player) {
        const task = this.scores.categories[taskIndex];
        const playerKey = player === 1 ? 'player1Score' : 'player2Score';
        const totalKey = player === 1 ? 'player1Score' : 'player2Score';
        const points = task.points || 1;

        // Toggle completion
        if (task.completedBy === player) {
            // Undo completion
            task.completedBy = null;
            this.scores[totalKey] = Math.max(0, this.scores[totalKey] - points);
        } else {
            // Complete task
            task.completedBy = player;
            this.scores[totalKey] += points;
        }

        await this.saveScores();
    }

    async resetAllScores() {
        this.scores.player1Score = 0;
        this.scores.player2Score = 0;
        this.scores.categories.forEach(task => {
            task.completedBy = null;
        });
        await this.saveScores();
    }

    render() {
        if (!this.scores) return;

        // Update scores
        document.getElementById('nishScore').textContent = this.scores.player1Score;
        document.getElementById('jessScore').textContent = this.scores.player2Score;

        // Render tasks
        const container = document.getElementById('tasksContainer');
        container.innerHTML = '';

        this.scores.categories.forEach((task, index) => {
            const taskEl = document.createElement('div');
            taskEl.className = 'task';
            
            const isCompletedByNish = task.completedBy === 1;
            const isCompletedByJess = task.completedBy === 2;
            const points = task.points || 1;

            taskEl.innerHTML = `
                <div class="task-header">
                    <div class="task-name">${task.name}</div>
                    <div class="task-points">${points} pt${points !== 1 ? 's' : ''}</div>
                </div>
                <div class="task-controls">
                    <div class="task-player">
                        <div class="task-player-label">Nish</div>
                        <div class="checkbox-container">
                            <div class="checkbox-btn nish ${isCompletedByNish ? 'checked' : ''} ${this.currentUser !== 'nish' ? 'disabled' : ''}" 
                                 onclick="${this.currentUser === 'nish' ? `tracker.toggleTaskCompletion(${index}, 1)` : ''}">
                                <i class="fas ${isCompletedByNish ? 'fa-check' : 'fa-plus'}"></i>
                            </div>
                        </div>
                    </div>
                    <div class="task-player">
                        <div class="task-player-label">Jess</div>
                        <div class="checkbox-container">
                            <div class="checkbox-btn jess ${isCompletedByJess ? 'checked' : ''} ${this.currentUser !== 'jess' ? 'disabled' : ''}" 
                                 onclick="${this.currentUser === 'jess' ? `tracker.toggleTaskCompletion(${index}, 2)` : ''}">
                                <i class="fas ${isCompletedByJess ? 'fa-check' : 'fa-plus'}"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(taskEl);
        });

        // Show winner if there's a significant difference
        this.showWinner();
    }

    showWinner() {
        const winnerSection = document.getElementById('winnerSection');
        const winnerText = document.getElementById('winnerText');
        const diff = Math.abs(this.scores.player1Score - this.scores.player2Score);

        if (diff >= 10) {
            const winner = this.scores.player1Score > this.scores.player2Score ? 'Nish' : 'Jess';
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
    tracker = new CompetitiveTrack();
});