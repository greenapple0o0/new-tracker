class CompetitiveTrack {
    constructor() {
        this.apiBase = '/api';
        this.scores = null;
        this.currentUser = null;
        this.countdownInterval = null;
        
        // Updated default tasks - Only Water (3000mL), Study, and Workout
        this.defaultTasks = [
            'Water Drank (mL)',
            'Studied (hours)', 
            'Workout Done (hours)'
        ];
        
        this.init();
    }

    async init() {
        this.setupLoginListeners();
        this.setupModalListeners();
        this.setupControlListeners();
    }

    setupLoginListeners() {
        document.querySelectorAll('.user-option').forEach(option => {
            option.addEventListener('click', (e) => {
                document.querySelectorAll('.user-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.currentTarget.classList.add('selected');
            });
        });

        document.getElementById('startGame').addEventListener('click', () => {
            this.handleLogin();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && document.getElementById('loginPage').style.display !== 'none') {
                this.handleLogin();
            }
        });
    }

    setupModalListeners() {
        const modal = document.getElementById('taskModal');
        document.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('saveTask').addEventListener('click', () => {
            this.saveNewTask();
        });

        document.getElementById('newTaskType').addEventListener('change', (e) => {
            const maxValueContainer = document.getElementById('maxValueContainer');
            maxValueContainer.style.display = e.target.value === 'checkbox' ? 'none' : 'block';
        });

        document.getElementById('newTaskName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveNewTask();
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    setupControlListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'addTask' || e.target.closest('#addTask')) {
                this.showTaskModal();
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
        
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('app').style.display = 'block';

        document.getElementById('currentUser').textContent = 
            this.currentUser === 'nish' ? 'Nish' : 'Jess';

        this.initializeApp();
    }

    logout() {
        document.getElementById('app').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        
        document.querySelectorAll('.user-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        this.currentUser = null;
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
    }

    async initializeApp() {
        await this.loadScores();
        this.startCountdownTimer();
        this.render();
    }

    async loadScores() {
        try {
            const response = await fetch(`${this.apiBase}/scores`);
            this.scores = await response.json();
        } catch (error) {
            console.error('Error loading scores:', error);
            this.scores = {
                player1: 'Nish',
                player2: 'Jess',
                player1Score: 0,
                player2Score: 0,
                dailyTasks: [],
                dailyHistory: [],
                timeUntilReset: 24 * 60 * 60 * 1000
            };
        }
    }

    startCountdownTimer() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            if (this.scores && this.scores.timeUntilReset > 0) {
                this.scores.timeUntilReset -= 1000;
                this.updateCountdownDisplay();
                
                if (this.scores.timeUntilReset <= 0) {
                    this.loadScores().then(() => this.render());
                }
            }
        }, 1000);

        this.updateCountdownDisplay();
    }

    updateCountdownDisplay() {
        const timerElement = document.getElementById('countdownTimer');
        if (!timerElement || !this.scores) return;

        const totalSeconds = Math.floor(this.scores.timeUntilReset / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        timerElement.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    showTaskModal() {
        document.getElementById('taskModal').style.display = 'block';
        document.getElementById('newTaskName').value = '';
        document.getElementById('newTaskType').value = 'checkbox';
        document.getElementById('maxValueContainer').style.display = 'none';
        document.getElementById('newTaskName').focus();
    }

    async saveNewTask() {
        const name = document.getElementById('newTaskName').value.trim();
        const type = document.getElementById('newTaskType').value;
        const maxValue = type !== 'checkbox' ? parseInt(document.getElementById('newTaskMaxValue').value) : 1;

        if (!name) {
            alert('Please enter a task name!');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, type, maxValue })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add task');
            }
            
            this.scores = await response.json();
            this.render();
            document.getElementById('taskModal').style.display = 'none';
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Error adding task: ' + error.message);
        }
    }

    async toggleCheckbox(taskIndex, player) {
        if (this.currentUser !== (player === 1 ? 'nish' : 'jess')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task/${taskIndex}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player })
            });
            this.scores = await response.json();
            this.render();
        } catch (error) {
            console.error('Error toggling task:', error);
        }
    }

    async updateNumberTask(taskIndex, player, change) {
        if (this.currentUser !== (player === 1 ? 'nish' : 'jess')) {
            return;
        }

        try {
            const task = this.scores.dailyTasks[taskIndex];
            let effectiveChange = change;
            
            // Special handling for water task - each click = 500mL
            if (task.name === 'Water Drank (mL)') {
                effectiveChange = change; // Server handles the 500mL conversion
            }

            const response = await fetch(`${this.apiBase}/scores/task/${taskIndex}/increment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player, change: effectiveChange })
            });
            this.scores = await response.json();
            this.render();
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }

    async deleteTask(taskIndex) {
        const task = this.scores.dailyTasks[taskIndex];
        
        if (this.isDefaultTask(task.name)) {
            alert('Default tasks cannot be deleted.');
            return;
        }

        if (confirm('Are you sure you want to delete this task?')) {
            try {
                const response = await fetch(`${this.apiBase}/scores/task/${taskIndex}`, {
                    method: 'DELETE'
                });
                this.scores = await response.json();
                this.render();
            } catch (error) {
                console.error('Error deleting task:', error);
                alert('Error deleting task: ' + error.message);
            }
        }
    }

    isDefaultTask(taskName) {
        return this.defaultTasks.includes(taskName);
    }

    render() {
        if (!this.scores) return;

        document.getElementById('nishScore').textContent = this.scores.player1Score;
        document.getElementById('jessScore').textContent = this.scores.player2Score;

        this.renderCalendar();
        this.renderTasks();
    }

    renderCalendar() {
        const calendarElement = document.getElementById('calendar');
        calendarElement.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day empty';
            
            if (this.scores.dailyHistory[i]) {
                const dayData = this.scores.dailyHistory[i];
                const date = new Date(dayData.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                dayElement.className = `calendar-day ${dayData.winner}`;
                dayElement.innerHTML = `
                    <div class="calendar-date">${monthDay}</div>
                    <div class="calendar-score">${dayData.player1Score}-${dayData.player2Score}</div>
                    <div>${dayName}</div>
                `;
            } else {
                dayElement.textContent = '--';
            }
            
            calendarElement.appendChild(dayElement);
        }
    }

    renderTasks() {
        const container = document.getElementById('tasksContainer');
        container.innerHTML = '';

        this.scores.dailyTasks.forEach((task, index) => {
            const taskEl = document.createElement('div');
            taskEl.className = 'task';
            
            const canEditNish = this.currentUser === 'nish';
            const canEditJess = this.currentUser === 'jess';
            const isDefault = this.isDefaultTask(task.name);
            const isWaterTask = task.name === 'Water Drank (mL)';

            let taskContent = '';
            
            if (task.type === 'checkbox') {
                taskContent = this.renderCheckboxTask(task, index, canEditNish, canEditJess);
            } else {
                taskContent = this.renderNumberTask(task, index, canEditNish, canEditJess, isWaterTask);
            }
            
            const deleteButton = isDefault ? '' : `
                <div style="text-align: center; margin-top: 15px;">
                    <button onclick="tracker.deleteTask(${index})" class="btn btn-outline" style="font-size: 0.8em; padding: 5px 10px;">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;

            taskEl.innerHTML = `
                <div class="task-header">
                    <div class="task-name">${task.name} ${isDefault ? '<span style="font-size: 0.7em; color: #666;">(Default)</span>' : ''}</div>
                    <div class="task-type">${task.type}</div>
                </div>
                ${taskContent}
                ${deleteButton}
            `;
            container.appendChild(taskEl);
        });

        // Add task button at the bottom
        const addTaskEl = document.createElement('div');
        addTaskEl.className = 'task';
        addTaskEl.style.textAlign = 'center';
        addTaskEl.style.padding = '40px';
        addTaskEl.style.cursor = 'pointer';
        addTaskEl.innerHTML = `
            <div id="addTaskBtn" class="btn btn-outline" style="font-size: 1.1em; display: inline-flex; align-items: center; gap: 8px;">
                <i class="fas fa-plus"></i> Add Custom Task
            </div>
        `;
        container.appendChild(addTaskEl);

        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.showTaskModal();
        });
    }

    renderCheckboxTask(task, index, canEditNish, canEditJess) {
        const nishChecked = task.player1Value > 0;
        const jessChecked = task.player2Value > 0;

        return `
            <div class="task-controls">
                <div class="task-player">
                    <div class="task-player-label">Nish</div>
                    <div class="checkbox-container">
                        <div class="checkbox-btn nish ${nishChecked ? 'checked' : ''} ${!canEditNish ? 'disabled' : ''}" 
                             onclick="${canEditNish ? `tracker.toggleCheckbox(${index}, 1)` : ''}">
                            <i class="fas ${nishChecked ? 'fa-check' : 'fa-plus'}"></i>
                        </div>
                    </div>
                </div>
                <div class="task-player">
                    <div class="task-player-label">Jess</div>
                    <div class="checkbox-container">
                        <div class="checkbox-btn jess ${jessChecked ? 'checked' : ''} ${!canEditJess ? 'disabled' : ''}" 
                             onclick="${canEditJess ? `tracker.toggleCheckbox(${index}, 2)` : ''}">
                            <i class="fas ${jessChecked ? 'fa-check' : 'fa-plus'}"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderNumberTask(task, index, canEditNish, canEditJess, isWaterTask) {
        const nishValue = task.player1Value;
        const jessValue = task.player2Value;
        const nishPercent = (nishValue / task.maxValue) * 100;
        const jessPercent = (jessValue / task.maxValue) * 100;

        // For water task, show mL and indicate 500mL increments
        const valueSuffix = isWaterTask ? 'mL' : '';
        const maxLabel = isWaterTask ? `max: ${task.maxValue}mL` : `max: ${task.maxValue}`;
        const incrementInfo = isWaterTask ? '<div style="font-size: 0.8em; color: #666; margin-top: 5px;">+500mL = 1 point</div>' : '';

        return `
            <div class="task-controls">
                <div class="task-player">
                    <div class="task-player-label">Nish</div>
                    <div class="number-controls">
                        <button class="number-btn ${!canEditNish || nishValue <= 0 ? 'disabled' : ''}" 
                                onclick="${canEditNish && nishValue > 0 ? `tracker.updateNumberTask(${index}, 1, -1)` : ''}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <div class="number-value">${nishValue}${valueSuffix}</div>
                        <button class="number-btn ${!canEditNish || nishValue >= task.maxValue ? 'disabled' : ''}" 
                                onclick="${canEditNish && nishValue < task.maxValue ? `tracker.updateNumberTask(${index}, 1, 1)` : ''}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="number-max">${maxLabel}</div>
                    ${incrementInfo}
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill nish" style="width: ${nishPercent}%"></div>
                        </div>
                    </div>
                </div>
                <div class="task-player">
                    <div class="task-player-label">Jess</div>
                    <div class="number-controls">
                        <button class="number-btn ${!canEditJess || jessValue <= 0 ? 'disabled' : ''}" 
                                onclick="${canEditJess && jessValue > 0 ? `tracker.updateNumberTask(${index}, 2, -1)` : ''}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <div class="number-value">${jessValue}${valueSuffix}</div>
                        <button class="number-btn ${!canEditJess || jessValue >= task.maxValue ? 'disabled' : ''}" 
                                onclick="${canEditJess && jessValue < task.maxValue ? `tracker.updateNumberTask(${index}, 2, 1)` : ''}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="number-max">${maxLabel}</div>
                    ${incrementInfo}
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill jess" style="width: ${jessPercent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize the tracker when the page loads
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new CompetitiveTrack();
});