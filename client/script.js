class CompetitiveTrack {
    constructor() {
        this.apiBase = '/api';
        this.scores = null;
        this.currentUser = null;
        this.countdownInterval = null;
        
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

    // ... (keep existing setup methods the same)

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

        // Water modal listeners
        const waterModal = document.getElementById('waterModal');
        document.querySelector('#waterModal .close').addEventListener('click', () => {
            waterModal.style.display = 'none';
        });

        document.getElementById('saveWater').addEventListener('click', () => {
            this.saveWaterInput();
        });

        document.getElementById('waterAmount').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveWaterInput();
            }
        });

        // Workout modal listeners
        const workoutModal = document.getElementById('workoutModal');
        document.querySelector('#workoutModal .close').addEventListener('click', () => {
            workoutModal.style.display = 'none';
        });

        document.getElementById('saveWorkout').addEventListener('click', () => {
            this.saveWorkoutInput();
        });

        document.getElementById('workoutMinutes').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.saveWorkoutInput();
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
            if (e.target === waterModal) {
                waterModal.style.display = 'none';
            }
            if (e.target === workoutModal) {
                workoutModal.style.display = 'none';
            }
        });
    }

    // Add methods for water and workout input
    showWaterInput(player) {
        this.currentWaterPlayer = player;
        const modal = document.getElementById('waterModal');
        const playerName = player === 1 ? 'Nish' : 'Jess';
        document.getElementById('waterModalTitle').textContent = `Water Intake - ${playerName}`;
        document.getElementById('waterAmount').value = '';
        document.getElementById('waterPointsPreview').textContent = '0 points';
        modal.style.display = 'block';
        document.getElementById('waterAmount').focus();
    }

    showWorkoutInput(player) {
        this.currentWorkoutPlayer = player;
        const modal = document.getElementById('workoutModal');
        const playerName = player === 1 ? 'Nish' : 'Jess';
        document.getElementById('workoutModalTitle').textContent = `Workout Time - ${playerName}`;
        document.getElementById('workoutMinutes').value = '';
        document.getElementById('workoutPointsPreview').textContent = '0 points';
        modal.style.display = 'block';
        document.getElementById('workoutMinutes').focus();
    }

    async saveWaterInput() {
        const amount = parseInt(document.getElementById('waterAmount').value);
        
        if (!amount || amount < 0) {
            alert('Please enter a valid amount of water in mL');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task/water/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    player: this.currentWaterPlayer, 
                    amount: amount 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update water intake');
            }
            
            this.scores = await response.json();
            this.render();
            document.getElementById('waterModal').style.display = 'none';
        } catch (error) {
            console.error('Error updating water:', error);
            alert('Error updating water: ' + error.message);
        }
    }

    async saveWorkoutInput() {
        const minutes = parseInt(document.getElementById('workoutMinutes').value);
        
        if (!minutes || minutes < 0) {
            alert('Please enter a valid number of minutes');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/scores/task/workout/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    player: this.currentWorkoutPlayer, 
                    minutes: minutes 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update workout time');
            }
            
            this.scores = await response.json();
            this.render();
            document.getElementById('workoutModal').style.display = 'none';
        } catch (error) {
            console.error('Error updating workout:', error);
            alert('Error updating workout: ' + error.message);
        }
    }

    // Update water and workout display in renderNumberTask
    renderNumberTask(task, index, canEditNish, canEditJess, isWaterTask, isWorkoutTask) {
        const nishValue = task.player1Value;
        const jessValue = task.player2Value;
        const nishPercent = (nishValue / task.maxValue) * 100;
        const jessPercent = (jessValue / task.maxValue) * 100;

        let valueSuffix = '';
        let maxLabel = `max: ${task.maxValue}`;
        let nishDisplayValue = nishValue;
        let jessDisplayValue = jessValue;
        let customInput = '';

        if (isWaterTask) {
            valueSuffix = 'mL';
            maxLabel = `max: ${task.maxValue}mL`;
            nishDisplayValue = Math.round(nishValue);
            jessDisplayValue = Math.round(jessValue);
            customInput = `
                <div style="text-align: center; margin-top: 10px;">
                    <button onclick="tracker.showWaterInput(1)" class="btn btn-outline" style="font-size: 0.8em; padding: 5px 10px;" ${!canEditNish ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i> Custom Input
                    </button>
                    <button onclick="tracker.showWaterInput(2)" class="btn btn-outline" style="font-size: 0.8em; padding: 5px 10px; margin-left: 5px;" ${!canEditJess ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i> Custom Input
                    </button>
                </div>
                <div style="font-size: 0.8em; color: #666; text-align: center; margin-top: 5px;">
                    750mL = 1 point
                </div>
            `;
        } else if (isWorkoutTask) {
            valueSuffix = ' hours';
            nishDisplayValue = nishValue.toFixed(1);
            jessDisplayValue = jessValue.toFixed(1);
            customInput = `
                <div style="text-align: center; margin-top: 10px;">
                    <button onclick="tracker.showWorkoutInput(1)" class="btn btn-outline" style="font-size: 0.8em; padding: 5px 10px;" ${!canEditNish ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i> Custom Input
                    </button>
                    <button onclick="tracker.showWorkoutInput(2)" class="btn btn-outline" style="font-size: 0.8em; padding: 5px 10px; margin-left: 5px;" ${!canEditJess ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i> Custom Input
                    </button>
                </div>
                <div style="font-size: 0.8em; color: #666; text-align: center; margin-top: 5px;">
                    30 minutes = 1 point
                </div>
            `;
        } else {
            // Study task - keep existing +/- buttons
            return this.renderStudyTask(task, index, canEditNish, canEditJess);
        }

        return `
            <div class="task-controls">
                <div class="task-player">
                    <div class="task-player-label">Nish</div>
                    <div class="current-value" style="text-align: center; font-size: 1.2em; font-weight: bold; margin: 10px 0;">
                        ${nishDisplayValue}${valueSuffix}
                    </div>
                    <div class="points-info" style="text-align: center; font-size: 0.8em; color: #666;">
                        ${Math.floor(isWaterTask ? nishValue / 750 : nishValue * 2)} points
                    </div>
                </div>
                <div class="task-player">
                    <div class="task-player-label">Jess</div>
                    <div class="current-value" style="text-align: center; font-size: 1.2em; font-weight: bold; margin: 10px 0;">
                        ${jessDisplayValue}${valueSuffix}
                    </div>
                    <div class="points-info" style="text-align: center; font-size: 0.8em; color: #666;">
                        ${Math.floor(isWaterTask ? jessValue / 750 : jessValue * 2)} points
                    </div>
                </div>
            </div>
            ${customInput}
            <div class="progress-container" style="margin-top: 15px;">
                <div class="progress-bar">
                    <div class="progress-fill nish" style="width: ${nishPercent}%"></div>
                    <div class="progress-fill jess" style="width: ${jessPercent}%; margin-left: -${nishPercent}%"></div>
                </div>
            </div>
        `;
    }

    // Keep study task with +/- buttons
    renderStudyTask(task, index, canEditNish, canEditJess) {
        const nishValue = task.player1Value;
        const jessValue = task.player2Value;
        const nishPercent = (nishValue / task.maxValue) * 100;
        const jessPercent = (jessValue / task.maxValue) * 100;

        return `
            <div class="task-controls">
                <div class="task-player">
                    <div class="task-player-label">Nish</div>
                    <div class="number-controls">
                        <button class="number-btn ${!canEditNish || nishValue <= 0 ? 'disabled' : ''}" 
                                onclick="${canEditNish && nishValue > 0 ? `tracker.updateNumberTask(${index}, 1, -1)` : ''}">
                            <i class="fas fa-minus"></i>
                        </button>
                        <div class="number-value">${nishValue}</div>
                        <button class="number-btn ${!canEditNish || nishValue >= task.maxValue ? 'disabled' : ''}" 
                                onclick="${canEditNish && nishValue < task.maxValue ? `tracker.updateNumberTask(${index}, 1, 1)` : ''}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="number-max">max: ${task.maxValue} hours</div>
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
                        <div class="number-value">${jessValue}</div>
                        <button class="number-btn ${!canEditJess || jessValue >= task.maxValue ? 'disabled' : ''}" 
                                onclick="${canEditJess && jessValue < task.maxValue ? `tracker.updateNumberTask(${index}, 2, 1)` : ''}">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <div class="number-max">max: ${task.maxValue} hours</div>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill jess" style="width: ${jessPercent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Update renderTasks to pass correct parameters
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
            const isWorkoutTask = task.name === 'Workout Done (hours)';
            const isStudyTask = task.name === 'Studied (hours)';

            let taskContent = '';
            
            if (task.type === 'checkbox') {
                taskContent = this.renderCheckboxTask(task, index, canEditNish, canEditJess);
            } else {
                taskContent = this.renderNumberTask(task, index, canEditNish, canEditJess, isWaterTask, isWorkoutTask);
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
}

// Initialize the tracker when the page loads
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new CompetitiveTrack();
});