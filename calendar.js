
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const dashboard = $("calendarDashboard");

    // =========================================
    // NOTIFICATIONS
    // =========================================

    let toastTimeout;

    function showToast(message) {
        const toast = $("toast");

        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.hidden = false;

        toastTimeout = setTimeout(() => {
            toast.hidden = true;
        }, 3000);
    }

    // =========================================
    // SIDEBAR
    // =========================================

    $("menuButton").addEventListener("click", () => {
        const collapsed = dashboard.classList.toggle(
            "sidebar-collapsed"
        );

        $("menuButton").setAttribute(
            "aria-expanded",
            String(!collapsed)
        );
    });

    // =========================================
    // USER PROFILE
    // =========================================

    async function loadUsername() {
        let username = "";

        try {
            const response = await fetch("/api/auth/me", {
                credentials: "same-origin"
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.user || data;

                username = user.username || user.name || "";
            }
        } catch {
            // Fall back to locally saved username if necessary.
        }

        if (!username) {
            try {
                username =
                    localStorage.getItem("username") ||
                    localStorage.getItem("userName") ||
                    localStorage.getItem("currentUsername") ||
                    "";

                if (!username) {
                    const savedUser = localStorage.getItem("currentUser");

                    if (savedUser) {
                        const user = JSON.parse(savedUser);
                        username = user.username || user.name || "";
                    }
                }
            } catch {
                // Use the default username.
            }
        }

        const displayName = username.trim() || "username";

        $("profileUsername").textContent = displayName;
        $("profileDialogName").textContent = displayName;
    }

    loadUsername();

    $("profileButton").addEventListener("click", () => {
        $("profileDialog").showModal();
    });

    $("closeProfileButton").addEventListener("click", () => {
        $("profileDialog").close();
    });

    $("profileDialog").addEventListener("click", event => {
        if (event.target === $("profileDialog")) {
            $("profileDialog").close();
        }
    });

    // =========================================
    // TIMER
    // =========================================

    let timerInterval = null;
    let timerRunning = false;
    let startedAt = null;

    let elapsedMs = 0;
    let remainingMs = 0;
    let initialDurationMs = 0;
    let alarmTarget = null;

    let audioContext = null;
    let alarmInterval = null;
    let alarmSoundActive = false;

    function mode() {
        return $("timerMode").value;
    }

    function formatTime(milliseconds) {
        const totalSeconds = Math.max(
            0,
            Math.floor(milliseconds / 1000)
        );

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return [
            String(hours).padStart(2, "0"),
            String(minutes).padStart(2, "0"),
            String(seconds).padStart(2, "0")
        ].join(":");
    }

    function stopTimerInterval() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function getCurrentValue() {
        if (!timerRunning || startedAt === null) {
            return mode() === "stopwatch"
                ? elapsedMs
                : remainingMs;
        }

        const difference = Date.now() - startedAt;

        if (mode() === "stopwatch") {
            return elapsedMs + difference;
        }

        return Math.max(0, remainingMs - difference);
    }

    function updateTimerDisplay() {
        $("timerDisplay").textContent = formatTime(
            getCurrentValue()
        );

        const progress = mode() === "stopwatch"
            ? 0
            : initialDurationMs > 0
                ? 100 * (
                    1 - getCurrentValue() / initialDurationMs
                )
                : 0;

        $("timerProgress").style.width =
            `${Math.max(0, Math.min(100, progress))}%`;
    }

    function updateTimerButtons() {
        $("startTimer").disabled = timerRunning;
        $("pauseTimer").disabled = !timerRunning;
    }

    function stopAlarmSound() {
        alarmSoundActive = false;

        if (alarmInterval !== null) {
            clearInterval(alarmInterval);
            alarmInterval = null;
        }

        $("dismissAlarm").hidden = true;
    }

    async function playAlarmSound() {
        stopAlarmSound();
        alarmSoundActive = true;
        $("dismissAlarm").hidden = false;

        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            showToast(
                "Time is up! Your browser does not support alarm audio."
            );
            return;
        }

        try {
            audioContext = audioContext || new AudioContextClass();
            await audioContext.resume();

            function beep() {
                if (
                    !alarmSoundActive ||
                    audioContext.state !== "running"
                ) {
                    return;
                }

                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const now = audioContext.currentTime;

                oscillator.type = "sine";
                oscillator.frequency.value = 880;

                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(
                    0.2, now + 0.02
                );
                gain.gain.exponentialRampToValueAtTime(
                    0.0001, now + 0.23
                );

                oscillator.connect(gain);
                gain.connect(audioContext.destination);

                oscillator.start(now);
                oscillator.stop(now + 0.24);
            }

            beep();

            alarmInterval = setInterval(beep, 800);
        } catch {
            showToast(
                "Time is up! Tap STOP ALARM SOUND to dismiss."
            );
        }
    }

    function finishTimer() {
        const finishedMode = mode();

        timerRunning = false;
        startedAt = null;
        stopTimerInterval();

        if (finishedMode !== "stopwatch") {
            remainingMs = 0;
        }

        $("timerStatus").textContent =
            finishedMode === "stopwatch"
                ? "Study session stopped."
                : finishedMode === "countdown"
                    ? "Countdown complete!"
                    : "Alarm is ringing!";

        updateTimerButtons();
        updateTimerDisplay();

        if (finishedMode !== "stopwatch") {
            showToast(
                finishedMode === "countdown"
                    ? "Time is up! Great work on your study session."
                    : "Your alarm is ringing!"
            );

            playAlarmSound();
        }
    }

    function tickTimer() {
        if (
            mode() !== "stopwatch" &&
            getCurrentValue() <= 0
        ) {
            finishTimer();
            return;
        }

        updateTimerDisplay();
    }

    function getCountdownDuration() {
        const minutesText = $("countdownMinutes").value.trim();
        const secondsText = $("countdownSeconds").value.trim();

        const minutes = Number(minutesText);
        const seconds = Number(secondsText);

        if (
            minutesText === "" ||
            secondsText === "" ||
            !Number.isInteger(minutes) ||
            !Number.isInteger(seconds) ||
            minutes < 0 ||
            minutes > 999 ||
            seconds < 0 ||
            seconds > 59
        ) {
            showToast("Enter valid countdown minutes and seconds.");
            return null;
        }

        const duration = (minutes * 60 + seconds) * 1000;

        if (duration <= 0) {
            showToast("Set a countdown greater than zero.");
            return null;
        }

        return duration;
    }

    function getAlarmDuration() {
        const value = $("alarmTime").value;

        if (!value) {
            showToast("Please select an alarm time first.");
            return null;
        }

        const [hours, minutes] = value.split(":").map(Number);
        const now = new Date();
        const target = new Date(now);

        target.setHours(hours, minutes, 0, 0);

        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }

        alarmTarget = target;

        return target.getTime() - now.getTime();
    }

    function startTimer() {
        if (timerRunning) return;

        const selectedMode = mode();

        if (selectedMode === "countdown" && remainingMs <= 0) {
            const duration = getCountdownDuration();

            if (duration === null) return;

            remainingMs = duration;
            initialDurationMs = duration;
        }

        if (selectedMode === "alarm" && remainingMs <= 0) {
            const duration = getAlarmDuration();

            if (duration === null) return;

            remainingMs = duration;
            initialDurationMs = duration;
        }

        // Initialize audio from the user's click when possible.
        if (selectedMode !== "stopwatch") {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;

            if (AudioContextClass && !audioContext) {
                try {
                    audioContext = new AudioContextClass();
                    audioContext.resume().catch(() => {});
                } catch {
                    // Timer remains functional without audio.
                }
            }
        }

        timerRunning = true;
        startedAt = Date.now();

        const status = {
            stopwatch: "Study session in progress!",
            countdown: "Countdown is running...",
            alarm: alarmTarget
                ? `Alarm set for ${alarmTarget.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                })}`
                : "Alarm is running..."
        };

        $("timerStatus").textContent = status[selectedMode];

        stopTimerInterval();
        timerInterval = setInterval(tickTimer, 200);

        updateTimerButtons();
        updateTimerDisplay();
    }

    function pauseTimer() {
        if (!timerRunning) return;

        const currentValue = getCurrentValue();

        if (mode() === "stopwatch") {
            elapsedMs = currentValue;
        } else {
            remainingMs = currentValue;
        }

        timerRunning = false;
        startedAt = null;

        stopTimerInterval();

        $("timerStatus").textContent = "Timer paused.";

        updateTimerButtons();
        updateTimerDisplay();
    }

    function resetTimer() {
        timerRunning = false;
        startedAt = null;

        stopTimerInterval();
        stopAlarmSound();

        elapsedMs = 0;
        remainingMs = 0;
        initialDurationMs = 0;
        alarmTarget = null;

        $("timerStatus").textContent = "Ready to study?";

        updateTimerButtons();
        updateTimerDisplay();
    }

    function changeTimerMode() {
        resetTimer();

        const selectedMode = mode();

        $("countdownSettings").hidden =
            selectedMode !== "countdown";

        $("alarmSettings").hidden =
            selectedMode !== "alarm";

        const headings = {
            stopwatch: "STOPWATCH",
            countdown: "COUNTDOWN",
            alarm: "ALARM CLOCK"
        };

        const hints = {
            stopwatch: "Track how long you spend on a task.",
            countdown: "Set a duration and receive an alert at zero.",
            alarm: "Choose a time for your alarm to ring."
        };

        $("timerHeading").textContent = headings[selectedMode];
        $("timerHint").textContent = hints[selectedMode];

        updateTimerDisplay();
    }

    $("timerMode").addEventListener("change", changeTimerMode);
    $("startTimer").addEventListener("click", startTimer);
    $("pauseTimer").addEventListener("click", pauseTimer);
    $("resetTimer").addEventListener("click", resetTimer);

    $("dismissAlarm").addEventListener("click", () => {
        stopAlarmSound();
        showToast("Alarm dismissed.");
    });

    changeTimerMode();

    // =========================================
    // CALENDAR TASK STORAGE
    // =========================================

    const STORAGE_KEY = "studyQuestTasks";

    function dateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function parseDateKey(key) {
        const [year, month, day] = key.split("-").map(Number);
        return new Date(year, month - 1, day);
    }

    function formatDate(date) {
        return date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    }

    function loadTasks() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );
            const result = Array.isArray(saved)
                ? saved.filter(task =>
                    task &&
                    typeof task.id === "string" &&
                    typeof task.title === "string" &&
                    typeof task.completed === "boolean" &&
                    ["today", "daily", "weekly"].includes(task.category)
                ).map(task => ({
                    ...task,
                    dueDate:
                        typeof task.dueDate === "string"
                            ? task.dueDate
                            : ""
                }))
                : [];

            const savedCalendarTasks = JSON.parse(
                localStorage.getItem("studyQuestCalendarTasks") || "{}"
            );

            if (
                savedCalendarTasks &&
                typeof savedCalendarTasks === "object" &&
                !Array.isArray(savedCalendarTasks)
            ) {
                Object.entries(savedCalendarTasks).forEach(([key, entries]) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) ||
                        !Array.isArray(entries)) {
                        return;
                    }

                    entries.forEach(task => {
                        if (
                            task &&
                            typeof task.id === "string" &&
                            typeof task.text === "string" &&
                            !result.some(savedTask =>
                                savedTask.id === task.id
                            )
                        ) {
                            result.push({
                                id: task.id,
                                title: task.text,
                                category: "today",
                                completed: Boolean(task.completed),
                                dueDate: key,
                                notes: ""
                            });
                        }
                    });
                });
            }

            return result;
        } catch {
            return [];
        }
    }

    let tasks = loadTasks();

    function tasksForDate(key) {
        return tasks.filter(task => task.dueDate === key);
    }

    function saveTasks() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(tasks)
            );
        } catch {
            showToast("Unable to save tasks in this browser.");
        }
    }

    // =========================================
    // CALENDAR RENDERING
    // =========================================

    const now = new Date();

    let displayedYear = now.getFullYear();
    let displayedMonth = now.getMonth();
    let selectedDate = dateKey(now);

    function renderCalendar() {
        const firstDay = new Date(
            displayedYear,
            displayedMonth,
            1
        );

        $("monthYear").textContent =
            firstDay.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric"
            });

        const calendarDays = $("calendarDays");
        calendarDays.replaceChildren();

        const startingWeekday = firstDay.getDay();
        const todayKey = dateKey(new Date());

        for (let index = 0; index < 42; index++) {
            const dayNumber = index - startingWeekday + 1;

            const date = new Date(
                displayedYear,
                displayedMonth,
                dayNumber
            );

            const key = dateKey(date);

            const button = document.createElement("button");
            button.type = "button";
            button.className = "calendar-day";
            button.textContent = date.getDate();

            const isCurrentMonth =
                date.getMonth() === displayedMonth;
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const hasTasks = tasksForDate(key).length > 0;

            button.setAttribute(
                "aria-label",
                `${formatDate(date)}${hasTasks ? ", has tasks" : ""}`
            );

            button.setAttribute(
                "aria-pressed",
                String(isSelected)
            );

            if (!isCurrentMonth) {
                button.classList.add("other-month");
            }

            if (isToday) button.classList.add("today");
            if (isSelected) button.classList.add("selected");
            if (hasTasks) button.classList.add("has-tasks");

            button.addEventListener("click", () => {
                selectedDate = key;
                displayedYear = date.getFullYear();
                displayedMonth = date.getMonth();

                renderCalendar();
                renderSelectedDateTasks();
            });

            calendarDays.appendChild(button);
        }
    }

    // =========================================
    // TASK LIST FOR SELECTED DATE
    // =========================================

    function renderSelectedDateTasks() {
        $("selectedDate").textContent =
            formatDate(parseDateKey(selectedDate));

        const list = $("calendarTaskList");
        const emptyMessage = $("emptyMessage");
        const dayTasks = tasksForDate(selectedDate);

        list.replaceChildren();
        emptyMessage.hidden = dayTasks.length > 0;

        dayTasks.forEach(task => {
            const item = document.createElement("div");
            item.className = "calendar-task-item";

            if (task.completed) {
                item.classList.add("completed");
            }

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "calendar-task-checkbox";
            checkbox.checked = task.completed;
            checkbox.setAttribute(
                "aria-label",
                `Mark ${task.title} as completed`
            );

            checkbox.addEventListener("change", () => {
                task.completed = checkbox.checked;

                saveTasks();
                renderCalendar();
                renderSelectedDateTasks();

                showToast(
                    task.completed
                        ? "Quest completed! Great job!"
                        : "Task marked as incomplete."
                );
            });

            const name = document.createElement("span");
            name.className = "calendar-task-text";
            name.textContent = task.title;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-calendar-task";
            deleteButton.textContent = "×";
            deleteButton.setAttribute("aria-label", "Delete task");

            deleteButton.addEventListener("click", () => {
                tasks = tasks.filter(
                    savedTask => savedTask.id !== task.id
                );

                saveTasks();
                renderCalendar();
                renderSelectedDateTasks();
                showToast("Calendar task deleted.");
            });

            item.append(checkbox, name, deleteButton);
            list.appendChild(item);
        });
    }

    // =========================================
    // ADD TASK DIALOG
    // =========================================

    const taskDialog = $("taskDialog");
    const taskForm = $("calendarTaskForm");
    const taskTitle = $("calendarTaskTitle");

    $("addCalendarTask").addEventListener("click", () => {
        taskForm.reset();

        $("taskDialogTitle").textContent = "Add a calendar task";
        $("taskDialogDate").textContent =
            formatDate(parseDateKey(selectedDate));

        taskDialog.showModal();
        taskTitle.focus();
    });

    taskForm.addEventListener("submit", event => {
        event.preventDefault();

        const title = taskTitle.value.trim();

        if (!title) {
            showToast("Please enter a task name.");
            taskTitle.focus();
            return;
        }

        tasks.push({
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
            title,
            category: "today",
            completed: false,
            dueDate: selectedDate,
            notes: ""
        });

        saveTasks();
        renderCalendar();
        renderSelectedDateTasks();

        taskDialog.close();
        showToast("New calendar task added!");
    });

    $("cancelTaskButton").addEventListener("click", () => {
        taskDialog.close();
    });

    taskDialog.addEventListener("click", event => {
        if (event.target === taskDialog) {
            taskDialog.close();
        }
    });

    // =========================================
    // CALENDAR NAVIGATION
    // =========================================

    $("prevMonth").addEventListener("click", () => {
        const date = new Date(
            displayedYear,
            displayedMonth - 1,
            1
        );

        displayedYear = date.getFullYear();
        displayedMonth = date.getMonth();

        renderCalendar();
    });

    $("nextMonth").addEventListener("click", () => {
        const date = new Date(
            displayedYear,
            displayedMonth + 1,
            1
        );

        displayedYear = date.getFullYear();
        displayedMonth = date.getMonth();

        renderCalendar();
    });

    $("todayButton").addEventListener("click", () => {
        const today = new Date();

        displayedYear = today.getFullYear();
        displayedMonth = today.getMonth();
        selectedDate = dateKey(today);

        renderCalendar();
        renderSelectedDateTasks();

        showToast("Showing today's schedule.");
    });

    // =========================================
    // INITIALIZE
    // =========================================

    renderCalendar();
    renderSelectedDateTasks();
});
