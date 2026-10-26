
document.addEventListener("DOMContentLoaded", () => {
    const dashboard = document.getElementById("protectedHome");

    // Stop if the protected dashboard is not present.
    if (!dashboard) return;

    const $ = (id) => document.getElementById(id);

    const toast = $("toast");
    const taskDialog = $("taskDialog");
    const taskForm = $("taskForm");
    const taskTitle = $("taskTitle");
    const taskCategory = $("taskCategory");

    const TASKS_KEY = "studyQuestTasks";
    const TIMER_KEY = "studyQuestStudySeconds";

    const categories = {
        today: {
            list: "todayTaskList",
            count: "todayCount"
        },
        daily: {
            list: "dailyTaskList",
            count: "dailyCount"
        },
        weekly: {
            list: "weeklyTaskList",
            count: "weeklyCount"
        }
    };

    let tasks = loadTasks();
    let studySeconds = loadStudySeconds();
    let timerRunning = false;
    let toastTimeout;

    // Safely load tasks saved in this browser.
    function loadTasks() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(TASKS_KEY) ||
                localStorage.getItem("studyQuestHomeTasks")
            );

            if (!Array.isArray(saved)) return [];

            return saved.filter(task =>
                task &&
                typeof task.id === "string" &&
                typeof task.title === "string" &&
                ["today", "daily", "weekly"].includes(task.category) &&
                typeof task.completed === "boolean"
            );
        } catch {
            return [];
        }
    }

    function saveTasks() {
        try {
            localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        } catch {
            showToast("Unable to save tasks in this browser.");
        }
    }

    function loadStudySeconds() {
        try {
            const saved = Number(localStorage.getItem(TIMER_KEY));
            return Number.isFinite(saved) && saved >= 0
                ? Math.floor(saved)
                : 0;
        } catch {
            return 0;
        }
    }

    function saveStudySeconds() {
        try {
            localStorage.setItem(TIMER_KEY, String(studySeconds));
        } catch {
            // The timer still works while this page remains open.
        }
    }

    // Display a temporary notification.
    function showToast(message) {
        if (!toast) return;

        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.hidden = false;

        toastTimeout = setTimeout(() => {
            toast.hidden = true;
        }, 3000);
    }

    // Current date.
    function updateDate() {
        const now = new Date();

        $("dateDay").textContent = String(now.getDate()).padStart(2, "0");

        $("dateMonth").textContent = now.toLocaleDateString("en-US", {
            month: "long"
        });

        $("dateYear").textContent = now.getFullYear();

        $("dateWeekday").textContent = now.toLocaleDateString("en-US", {
            weekday: "long"
        });
    }

    updateDate();

    // Check again periodically in case the date changes at midnight.
    setInterval(updateDate, 60_000);

    // Display the signed-in username when it is available.
    function updateUsername() {
        let username = "";

        try {
            username =
                localStorage.getItem("username") ||
                localStorage.getItem("userName") ||
                localStorage.getItem("currentUsername") ||
                "";

            if (!username) {
                const currentUser = localStorage.getItem("currentUser");

                if (currentUser) {
                    const user = JSON.parse(currentUser);

                    if (typeof user === "object" && user !== null) {
                        username =
                            user.username ||
                            user.userName ||
                            user.name ||
                            user.email ||
                            "";
                    }
                }
            }
        } catch {
            // Use the default label if the saved value is unavailable.
        }

        const displayName = username.trim() || "username";

        $("profileUsername").textContent = displayName;
        $("welcomeText").textContent =
            displayName === "username"
                ? "Your journey starts here."
                : `Welcome back, ${displayName}! Ready for today's quest?`;
    }

    updateUsername();

    // Render the tasks in their respective widgets.
    function renderTasks() {
        Object.entries(categories).forEach(([category, elements]) => {
            const list = $(elements.list);
            const categoryTasks = tasks.filter(
                task => task.category === category
            );

            $(elements.count).textContent = categoryTasks.length;
            list.replaceChildren();

            if (categoryTasks.length === 0) {
                const empty = document.createElement("p");
                empty.className = "empty-state";

                const emptyMessages = {
                    today: "No tasks yet. Add your first task!",
                    daily: "Your daily checklist is empty.",
                    weekly: "No weekly goals added yet."
                };

                empty.textContent = emptyMessages[category];
                list.appendChild(empty);
                return;
            }

            categoryTasks.forEach(task => {
                const item = document.createElement("div");
                item.className = "task-item";

                if (task.completed) {
                    item.classList.add("completed");
                }

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "task-checkbox";
                checkbox.checked = task.completed;
                checkbox.setAttribute(
                    "aria-label",
                    `Mark ${task.title} as ${
                        task.completed ? "incomplete" : "completed"
                    }`
                );

                checkbox.addEventListener("change", () => {
                    task.completed = checkbox.checked;
                    saveTasks();
                    renderTasks();

                    showToast(
                        task.completed
                            ? "Quest completed! Great job!"
                            : "Task marked as incomplete."
                    );
                });

                const name = document.createElement("span");
                name.className = "task-name";
                name.textContent = task.title;

                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-task-button";
                deleteButton.textContent = "×";
                deleteButton.setAttribute(
                    "aria-label",
                    `Delete ${task.title}`
                );

                deleteButton.addEventListener("click", () => {
                    tasks = tasks.filter(item => item.id !== task.id);
                    saveTasks();
                    renderTasks();
                    showToast("Task deleted.");
                });

                item.append(checkbox, name, deleteButton);
                list.appendChild(item);
            });
        });

        const completed = tasks.filter(task => task.completed).length;
        const incomplete = tasks.length - completed;

        $("completedCount").textContent = completed;
        $("incompleteCount").textContent = incomplete;
    }

    renderTasks();

    // Open the task creation dialog.
    function openTaskDialog(category = "today") {
        taskForm.reset();
        taskCategory.value = category;

        const titles = {
            today: "Add Today's Focus",
            daily: "Add a Daily Task",
            weekly: "Add a Weekly Goal"
        };

        $("taskDialogTitle").textContent = titles[category];

        if (typeof taskDialog.showModal === "function") {
            taskDialog.showModal();
            taskTitle.focus();
        } else {
            showToast("Your browser does not support the task dialog.");
        }
    }

    document.querySelectorAll("[data-add-task]").forEach(button => {
        button.addEventListener("click", () => {
            openTaskDialog(button.dataset.addTask);
        });
    });

    // Save a new task.
    taskForm.addEventListener("submit", event => {
        event.preventDefault();

        const title = taskTitle.value.trim();
        const category = taskCategory.value;

        if (!title) {
            showToast("Please enter a task name.");
            taskTitle.focus();
            return;
        }

        if (!categories[category]) {
            showToast("Please select a valid task category.");
            return;
        }

        tasks.push({
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            title,
            category,
            completed: false
        });

        saveTasks();
        renderTasks();
        taskDialog.close();
        showToast("New quest added successfully!");
    });

    $("cancelTaskButton").addEventListener("click", () => {
        taskDialog.close();
    });

    // Close the dialog when clicking its backdrop.
    taskDialog.addEventListener("click", event => {
        if (event.target === taskDialog) {
            taskDialog.close();
        }
    });

    // Study timer.
    function formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            hours,
            minutes,
            seconds
        ].map(value => String(value).padStart(2, "0")).join(":");
    }

    function renderTimer() {
        $("studyTime").textContent = formatTime(studySeconds);

        $("timerStatus").textContent = timerRunning
            ? "TAP TO PAUSE"
            : "TAP TO START";

        $("studyTimerButton").setAttribute(
            "aria-label",
            timerRunning
                ? "Pause study timer"
                : "Start study timer"
        );
    }

    $("studyTimerButton").addEventListener("click", () => {
        timerRunning = !timerRunning;
        renderTimer();

        showToast(
            timerRunning
                ? "Study timer started. Stay focused!"
                : "Study timer paused."
        );
    });

    setInterval(() => {
        if (!timerRunning) return;

        studySeconds++;
        saveStudySeconds();
        renderTimer();
    }, 1000);

    renderTimer();

    // Save the timer when the user leaves or reloads the page.
    window.addEventListener("pagehide", saveStudySeconds);

    // Respect the current authentication script's logout button.
    // Logout behavior remains managed by auth.js.
});
