class CompetitiveTrack {
    constructor() {
        this.apiBase = '/api';
        this.scores = null;
        this.currentUser = null;
        this.countdownInterval = null;
        this.currentQuickAddTask = null;
        
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
        // Task modal
        const taskModal = document.getElementById('taskModal');
        document.querySelector('#taskModal .close').addEventListener('click', () => {
            taskModal.style.display = 'none';
        });

        document.getElementById('saveTask').addEventListener('click', () => {
            this.saveNewTask();
        });

        document.getElementById('newTaskType').addEventListener('change', (e) => {
            const numberConfig = document.getElementById('numberTaskConfig');
            numberConfig.style.display = e.target.value === 'number' ? 'block' : 'none';
        });

        document.getElementById('newTaskName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveNewTask();
            }
        });

        // Quick add modal
        const quickAddModal = document.getElementById('quickAddModal');
        document.querySelector('#quickAddModal .close').addEventListener('click', () => {
            quickAddModal.style.display = 'none';
        });

        document.getElementById('saveQuickAdd').addEventListener('click', () => {
            this.saveQuickAdd();
        });

        // Rename modal
        const renameModal = document.getElementById('renameModal');
        document.querySelector('#renameModal .close').addEventListener('click', () => {
            renameModal.style.display = 'none';
        });

        document.getElementById('saveRename').addEventListener('click', () => {
            this.saveTaskRename();
        });

        document.getElementById('newTaskNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveTaskRename();
            }
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === taskModal) taskModal.style.display = 'none';
            if (e.target === quickAddModal) quickAddModal.style.display = 'none';
            if (e.target === renameModal) renameModal.style.display = 'none';
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
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.scores = await response.json();
        } catch (error) {
            console.error('Error loading scores:', error);
            // Initialize with default structure if server is down
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
        document.getElementById('numberTaskConfig').style.display = 'none';
        document.getElementById('newTaskName').focus();
    }

    async saveNewTask() {
        const name = document.getElementById('newTaskName').value.trim();
        const type = document.getElementById('newTaskType').value;

        if (!name) {
            alert('Please enter a task name!');
            return;
        }

        let taskData = { name, type };

        if (type === 'number') {
            const pointsPerUnit = parseInt(document.getElementById('pointsPerUnit').value) || 1;
            const unitsPerClick = parseInt(document.getElementById('unitsPerClick').value) || 1;
            const maxUnits = parseInt(document.getElementById('maxUnits').value) || 8;
            const unitLabel = document.getElementById('unitLabel').value.trim() || 'units';

            taskData = {
                ...taskData,
                pointsPerUnit,
                unitsPerClick,
                maxValue: maxUnits,
                unitLabel
            };
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(taskData)
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

    showQuickAddModal(taskIndex, player) {
        this.currentQuickAddTask = { taskIndex, player };
        const task = this.scores.dailyTasks[taskIndex];
        const playerName = player === 1 ? 'Nish' : 'Jess';
        
        document.getElementById('quickAddTitle').textContent = `Add ${task.name} - ${playerName}`;
        
        let content = '';
        if (task.type === 'water') {
            content = `
                <p>How much water did you drink?</p>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="250">250mL</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="500">500mL</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="750">750mL</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="1000">1L</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="1500">1.5L</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="2000">2L</button>
                </div>
                <div style="margin-top: 15px;">
                    <label>Custom amount (mL):</label>
                    <input type="number" id="customWaterAmount" placeholder="Enter custom amount" min="0" max="5000">
                </div>
            `;
        } else if (task.type === 'workout') {
            content = `
                <p>How long did you workout?</p>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="0.5">30 min</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="1">1 hour</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="1.5">1.5 hours</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="2">2 hours</button>
                </div>
                <div style="margin-top: 15px;">
                    <label>Custom duration (hours):</label>
                    <input type="number" id="customWorkoutAmount" placeholder="Enter custom hours" min="0" max="24" step="0.5">
                </div>
            `;
        } else if (task.type === 'study') {
            content = `
                <p>How long did you study?</p>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0;">
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="1">1 hour</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="2">2 hours</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="3">3 hours</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="4">4 hours</button>
                </div>
                <div style="margin-top: 15px;">
                    <label>Custom duration (hours):</label>
                    <input type="number" id="customStudyAmount" placeholder="Enter custom hours" min="0" max="24" step="0.5">
                </div>
            `;
        } else if (task.config && task.config.unitsPerClick) {
            content = `
                <p>Add ${task.name}</p>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="${task.config.unitsPerClick}">+${task.config.unitsPerClick}</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="${task.config.unitsPerClick * 2}">+${task.config.unitsPerClick * 2}</button>
                    <button type="button" class="btn btn-outline quick-add-amount" data-amount="${task.config.unitsPerClick * 5}">+${task.config.unitsPerClick * 5}</button>
                </div>
                <div style="margin-top: 15px;">
                    <label>Custom amount:</label>
                    <input type="number" id="customNumberAmount" placeholder="Enter custom amount" min="0" max="${task.maxValue}">
                </div>
            `;
        }

        document.getElementById('quickAddContent').innerHTML = content;
        
        // Add event listeners to quick add buttons
        setTimeout(() => {
            document.querySelectorAll('.quick-add-amount').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const amount = parseFloat(e.target.dataset.amount);
                    this.performQuickAdd(amount);
                });
            });
        }, 100);

        document.getElementById('quickAddModal').style.display = 'block';
    }

    async performQuickAdd(amount) {
        if (!this.currentQuickAddTask) return;
        
        const { taskIndex, player } = this.currentQuickAddTask;
        const task = this.scores.dailyTasks[taskIndex];
        
        try {
            if (task.type === 'water') {
                await this.updateWaterTask(taskIndex, player, amount);
            } else if (task.type === 'workout') {
                await this.updateWorkoutTask(taskIndex, player, amount);
            } else if (task.type === 'study') {
                await this.updateNumberTask(taskIndex, player, amount);
            } else if (task.config) {
                await this.updateNumberTask(taskIndex, player, amount);
            }
            
            document.getElementById('quickAddModal').style.display = 'none';
            await this.loadScores(); // Reload scores to get updated data
            this.render();
        } catch (error) {
            console.error('Error in quick add:', error);
            alert('Error adding: ' + error.message);
        }
    }

    async saveQuickAdd() {
        if (!this.currentQuickAddTask) return;
        
        const { taskIndex, player } = this.currentQuickAddTask;
        const task = this.scores.dailyTasks[taskIndex];
        let amount = 0;

        try {
            if (task.type === 'water') {
                amount = parseInt(document.getElementById('customWaterAmount').value) || 0;
                if (amount > 0) {
                    await this.updateWaterTask(taskIndex, player, amount);
                }
            } else if (task.type === 'workout') {
                amount = parseFloat(document.getElementById('customWorkoutAmount').value) || 0;
                if (amount > 0) {
                    await this.updateWorkoutTask(taskIndex, player, amount);
                }
            } else if (task.type === 'study') {
                amount = parseFloat(document.getElementById('customStudyAmount').value) || 0;
                if (amount > 0) {
                    await this.updateNumberTask(taskIndex, player, amount);
                }
            } else if (task.config) {
                amount = parseInt(document.getElementById('customNumberAmount').value) || 0;
                if (amount > 0) {
                    await this.updateNumberTask(taskIndex, player, amount);
                }
            }

            document.getElementById('quickAddModal').style.display = 'none';
            await this.loadScores(); // Reload scores to get updated data
            this.render();
        } catch (error) {
            console.error('Error in quick add:', error);
            alert('Error adding: ' + error.message);
        }
    }

    // Task management methods
    showRenameModal(taskIndex) {
        this.currentRenameTaskIndex = taskIndex;
        const task = this.scores.dailyTasks[taskIndex];
        const modal = document.getElementById('renameModal');
        document.getElementById('newTaskNameInput').value = task.name;
        modal.style.display = 'block';
        document.getElementById('newTaskNameInput').focus();
    }

    async saveTaskRename() {
        const newName = document.getElementById('newTaskNameInput').value.trim();
        
        if (!newName) {
            alert('Please enter a new task name');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task/${this.currentRenameTaskIndex}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    newName: newName
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to rename task');
            }
            
            this.scores = await response.json();
            this.render();
            document.getElementById('renameModal').style.display = 'none';
        } catch (error) {
            console.error('Error renaming task:', error);
            alert('Error renaming task: ' + error.message);
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
            const response = await fetch(`${this.apiBase}/scores/task/${taskIndex}/increment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player, change })
            });
            this.scores = await response.json();
            this.render();
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }

    async updateWaterTask(taskIndex, player, amount) {
        if (this.currentUser !== (player === 1 ? 'nish' : 'jess')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task/water/increment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player, amount })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update water');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating water:', error);
            throw error;
        }
    }

    async updateWorkoutTask(taskIndex, player, hours) {
        if (this.currentUser !== (player === 1 ? 'nish' : 'jess')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task/workout/increment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ player, hours })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update workout');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error updating workout:', error);
            throw error;
        }
    }

    async deleteTask(taskIndex) {
        const task = this.scores.dailyTasks[taskIndex];
        
        // Check if this is a default task
        const defaultTasks = ['Water Drank', 'Studied', 'Workout Done'];
        if (defaultTasks.some(defaultTask => task.name.includes(defaultTask))) {
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
            const isDefault = ['Water Drank', 'Studied', 'Workout Done'].some(defaultTask => task.name.includes(defaultTask));

            let taskContent = '';
            
            if (task.type === 'checkbox') {
                taskContent = this.renderCheckboxTask(task, index, canEditNish, canEditJess);
            } else {
                taskContent = this.renderNumberTask(task, index, canEditNish, canEditJess);
            }
            
            // Edit button for custom tasks, delete button for all non-default tasks
            const editButton = isDefault ? '' : `
                <button onclick="tracker.showRenameModal(${index})" class="btn btn-outline btn-sm">
                    <i class="fas fa-edit"></i> Rename
                </button>
            `;
            
            const deleteButton = isDefault ? '' : `
                <button onclick="tracker.deleteTask(${index})" class="btn btn-outline btn-sm">
                    <i class="fas fa-trash"></i> Delete
                </button>
            `;

            const actionButtons = isDefault ? '' : `
                <div style="text-align: center; margin-top: 15px; display: flex; gap: 10px; justify-content: center;">
                    ${editButton}
                    ${deleteButton}
                </div>
            `;

            taskEl.innerHTML = `
                <div class="task-header">
                    <div class="task-name">${task.name} ${isDefault ? '<span style="font-size: 0.7em; color: #666;">(Default)</span>' : ''}</div>
                    <div class="task-type">${task.type}</div>
                </div>
                ${taskContent}
                ${actionButtons}
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

    renderNumberTask(task, index, canEditNish, canEditJess) {
        const nishValue = task.player1Value;
        const jessValue = task.player2Value;
        const nishPercent = (nishValue / task.maxValue) * 100;
        const jessPercent = (jessValue / task.maxValue) * 100;

        let valueSuffix = '';
        let maxLabel = '';
        let pointsInfo = '';
        let showQuickAdd = false;
        let incrementAmount = 1;
        let decrementAmount = 1;

        if (task.type === 'water') {
            valueSuffix = 'mL';
            maxLabel = `max: ${task.maxValue}mL`;
            pointsInfo = '500mL = 1 point';
            showQuickAdd = true;
            incrementAmount = 750; // 750mL per click
            decrementAmount = 750; // 750mL per click
        } else if (task.type === 'workout') {
            valueSuffix = ' hours';
            maxLabel = `max: ${task.maxValue} hours`;
            pointsInfo = '30 minutes = 1 point';
            showQuickAdd = true;
            incrementAmount = 0.5; // 30 minutes per click
            decrementAmount = 0.5; // 30 minutes per click
        } else if (task.type === 'study') {
            valueSuffix = ' hours';
            maxLabel = `max: ${task.maxValue} hours`;
            pointsInfo = '1 hour = 1 point';
            showQuickAdd = true;
            incrementAmount = 1;
            decrementAmount = 1;
        } else if (task.config) {
            valueSuffix = ` ${task.config.unitLabel || 'units'}`;
            maxLabel = `max: ${task.maxValue} ${task.config.unitLabel || 'units'}`;
            pointsInfo = `${task.config.unitsPerClick || 1} ${task.config.unitLabel || 'unit'} = ${task.config.pointsPerUnit || 1} point${task.config.pointsPerUnit > 1 ? 's' : ''}`;
            showQuickAdd = true;
            incrementAmount = task.config.unitsPerClick || 1;
            decrementAmount = task.config.unitsPerClick || 1;
        }

        // Calculate display values
        const nishDisplayValue = task.type === 'water' ? Math.round(nishValue) : 
                               task.type === 'workout' ? nishValue.toFixed(1) : nishValue;
        const jessDisplayValue = task.type === 'water' ? Math.round(jessValue) : 
                                task.type === 'workout' ? jessValue.toFixed(1) : jessValue;

        const quickAddButtons = showQuickAdd ? `
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="btn btn-outline quick-add-btn" onclick="tracker.showQuickAddModal(${index}, 1)" ${!canEditNish ? 'disabled' : ''}>
                    <i class="fas fa-bolt"></i> Quick Add
                </button>
                <button class="btn btn-outline quick-add-btn" onclick="tracker.showQuickAddModal(${index}, 2)" ${!canEditJess ? 'disabled' : ''}>
                    <i class="fas fa-bolt"></i> Quick Add
                </button>
            </div>
        ` : '';

        return `
            <div class="task-controls">
                <div class="task-player">
                    <div class="task-player-label">Nish</div>
                    <div class="number-controls">
                        <button class="number-btn ${!canEditNish || nishValue < decrementAmount ? 'disabled' : ''}" 
                                onclick="${canEditNish && nishValue >= decrementAmount ? `tracker.updateNumberTask(${index}, 1, -${decrementAmount})` : ''}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <div class="number-value">${nishDisplayValue}${valueSuffix}</div>
                        <button class="number-btn ${!canEditNish || nishValue >= task.maxValue ? 'disabled' : ''}" 
                                onclick="${canEditNish && nishValue < task.maxValue ? `tracker.updateNumberTask(${index}, 1, ${incrementAmount})` : ''}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="number-max">${maxLabel}</div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill nish" style="width: ${nishPercent}%"></div>
                        </div>
                    </div>
                </div>
                <div class="task-player">
                    <div class="task-player-label">Jess</div>
                    <div class="number-controls">
                        <button class="number-btn ${!canEditJess || jessValue < decrementAmount ? 'disabled' : ''}" 
                                onclick="${canEditJess && jessValue >= decrementAmount ? `tracker.updateNumberTask(${index}, 2, -${decrementAmount})` : ''}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <div class="number-value">${jessDisplayValue}${valueSuffix}</div>
                        <button class="number-btn ${!canEditJess || jessValue >= task.maxValue ? 'disabled' : ''}" 
                                onclick="${canEditJess && jessValue < task.maxValue ? `tracker.updateNumberTask(${index}, 2, ${incrementAmount})` : ''}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="number-max">${maxLabel}</div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill jess" style="width: ${jessPercent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="font-size: 0.8em; color: #666; text-align: center; margin-top: 10px;">
                ${pointsInfo}
            </div>
            ${quickAddButtons}
        `;
    }
}

// Initialize the tracker when the page loads
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new CompetitiveTrack();
});