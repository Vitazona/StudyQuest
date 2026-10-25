// =====================================
// STUDY QUEST - FRONTEND FUNCTIONALITY
// =====================================

// NOTE:
// This is a frontend prototype only.
// Do not use browser localStorage for real passwords.
// Replace local account storage with a secure backend later.

const STORAGE = {
  accounts: "studyQuestAccounts",
  session: "studyQuestCurrentUser"
};

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getAccounts() {
  return readJSON(STORAGE.accounts, []);
}

function getCurrentUser() {
  return localStorage.getItem(STORAGE.session);
}

function setMessage(id, message, success = false) {
  const element = document.getElementById(id);
  if (!element) return;

  element.textContent = message;
  element.style.color = success ? "#18723a" : "#a32121";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function todayString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "No due date";

  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );
}


// =====================================
// REGISTER
// =====================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", event => {
    event.preventDefault();

    const username = document.getElementById("regUsername")
      .value.trim();

    const email = document.getElementById("regEmail")
      .value.trim().toLowerCase();

    const password = document.getElementById("regPassword").value;
    const confirmPassword =
      document.getElementById("confirmPassword").value;

    const accounts = getAccounts();

    if (username.length < 3) {
      setMessage("registerMessage",
        "Username must contain at least 3 characters.");
      return;
    }

    if (password.length < 8) {
      setMessage("registerMessage",
        "Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("registerMessage",
        "Passwords do not match.");
      return;
    }

    const usernameExists = accounts.some(account =>
      account.username.toLowerCase() === username.toLowerCase()
    );

    if (usernameExists) {
      setMessage("registerMessage",
        "That username is already registered.");
      return;
    }

    const emailExists = accounts.some(account =>
      account.email.toLowerCase() === email
    );

    if (emailExists) {
      setMessage("registerMessage",
        "That email is already registered.");
      return;
    }

    // Demo only: passwords are not encrypted here.
    accounts.push({
      id: makeId(),
      username,
      email,
      password
    });

    writeJSON(STORAGE.accounts, accounts);

    setMessage("registerMessage",
      "Registration successful! Redirecting to login...",
      true
    );

    registerForm.reset();

    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  });
}


// =====================================
// LOGIN
// =====================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", event => {
    event.preventDefault();

    const username = document.getElementById("loginUsername")
      .value.trim();

    const password = document.getElementById("loginPassword").value;

    const accounts = getAccounts();

    const account = accounts.find(item =>
      item.username.toLowerCase() === username.toLowerCase() &&
      item.password === password
    );

    if (!account) {
      setMessage("loginMessage",
        "Incorrect username or password.");
      return;
    }

    localStorage.setItem(STORAGE.session, account.id);

    setMessage("loginMessage", "Login successful!", true);

    setTimeout(() => {
      window.location.href = "home.html";
    }, 300);
  });
}


// =====================================
// FORGOT PASSWORD - DEMO
// =====================================

const forgotButton = document.getElementById("forgotButton");

if (forgotButton) {
  forgotButton.addEventListener("click", () => {
    const username = document.getElementById("loginUsername")
      .value.trim();

    if (!username) {
      setMessage("loginMessage",
        "Enter your username first to check your account.");
      return;
    }

    const account = getAccounts().find(item =>
      item.username.toLowerCase() === username.toLowerCase()
    );

    if (!account) {
      setMessage("loginMessage",
        "No account found. Check the username.");
      return;
    }

    // This is a local prototype, not a secure recovery system.
    const newPassword = prompt(
      "DEMO PASSWORD RESET\n\n" +
      "Enter a new password (at least 8 characters):"
    );

    if (newPassword === null) return;

    if (newPassword.length < 8) {
      setMessage("loginMessage",
        "The new password must contain at least 8 characters.");
      return;
    }

    const confirmation = prompt("Confirm your new password:");

    if (confirmation !== newPassword) {
      setMessage("loginMessage",
        "Passwords do not match. Please try again.");
      return;
    }

    const accounts = getAccounts();
    const index = accounts.findIndex(item =>
      item.id === account.id
    );

    accounts[index].password = newPassword;
    writeJSON(STORAGE.accounts, accounts);

    setMessage("loginMessage",
      "Demo password updated. You can now log in.",
      true
    );
  });
}


// =====================================
// DASHBOARD INITIALIZATION
// =====================================

const onDashboard = document.querySelector(".dashboard-page");

let currentAccount = null;
let tasks = [];
let subjects = [];

function accountStorageKey(type) {
  return `studyQuest_${type}_${currentAccount.id}`;
}

function loadDashboardData() {
  tasks = readJSON(accountStorageKey("tasks"), []);
  subjects = readJSON(accountStorageKey("subjects"), []);
}

function saveTasks() {
  writeJSON(accountStorageKey("tasks"), tasks);
}

function saveSubjects() {
  writeJSON(accountStorageKey("subjects"), subjects);
}

if (onDashboard) {
  const accountId = getCurrentUser();

  currentAccount = getAccounts().find(account =>
    account.id === accountId
  );

  // Return to login if there is no valid local session.
  if (!currentAccount) {
    window.location.replace("index.html");
  } else {
    loadDashboardData();
    initializeDashboard();
  }
}

function initializeDashboard() {
  const welcome = document.getElementById("welcomeText");

  if (welcome) {
    welcome.textContent =
      `Welcome back, ${currentAccount.username}!`;
  }

  const dateElement = document.getElementById("currentDate");

  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString(
      undefined,
      {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      }
    );
  }

  document.getElementById("profileUsername").textContent =
    currentAccount.username;

  document.getElementById("profileEmail").textContent =
    currentAccount.email;

  renderTasks();
  renderSummaries();
  renderSubjects();
  initializeCalendar();
  initializeNavigation();
}


// =====================================
// NAVIGATION
// =====================================

function showSection(sectionName) {
  document.querySelectorAll(".app-section").forEach(section => {
    section.classList.toggle(
      "active",
      section.id === `section-${sectionName}`
    );
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.section === sectionName
    );
  });

  if (sectionName === "calendar") renderCalendar();
  if (sectionName === "tasks") renderTasks();
  if (sectionName === "home") renderSummaries();
  if (sectionName === "curriculum") renderSubjects();
}

function initializeNavigation() {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      showSection(button.dataset.section);
    });
  });

  document.querySelectorAll("[data-open-section]").forEach(button => {
    button.addEventListener("click", () => {
      showSection(button.dataset.openSection);
    });
  });

  document.getElementById("menuButton").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("collapsed");
  });

  document.getElementById("profileButton").addEventListener("click", () => {
    showSection("profile");
  });

  document.getElementById("logoutButton").addEventListener("click", () => {
    if (confirm("Are you sure you want to log out?")) {
      localStorage.removeItem(STORAGE.session);
      window.location.href = "index.html";
    }
  });

  document.getElementById("deleteAccountButton")
    .addEventListener("click", () => {
      const confirmed = confirm(
        "Delete this demo account and all its saved tasks and subjects? " +
        "This cannot be undone."
      );

      if (!confirmed) return;

      const accountId = currentAccount.id;

      writeJSON(
        STORAGE.accounts,
        getAccounts().filter(account => account.id !== accountId)
      );

      localStorage.removeItem(`studyQuest_tasks_${accountId}`);
      localStorage.removeItem(`studyQuest_subjects_${accountId}`);
      localStorage.removeItem(STORAGE.session);

      window.location.href = "index.html";
    });
}


// =====================================
// TASK MANAGER
// =====================================

const taskForm = document.getElementById("taskForm");

if (taskForm) {
  document.getElementById("taskDue").value = todayString();

  taskForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = document.getElementById("taskTitle").value.trim();
    const type = document.getElementById("taskType").value;
    const due = document.getElementById("taskDue").value;
    const notes = document.getElementById("taskNotes").value.trim();

    if (!title || !due) {
      setMessage("taskMessage",
        "Please enter a task name and due date.");
      return;
    }

    tasks.push({
      id: makeId(),
      title,
      type,
      due,
      notes,
      completed: false,
      createdAt: new Date().toISOString()
    });

    saveTasks();
    taskForm.reset();
    document.getElementById("taskDue").value = todayString();

    setMessage("taskMessage", "Task added successfully!", true);

    renderTasks();
    renderSummaries();
    renderCalendar();
  });
}

const taskFilter = document.getElementById("taskFilter");

if (taskFilter) {
  taskFilter.addEventListener("change", renderTasks);
}

function renderTasks() {
  const container = document.getElementById("taskList");
  if (!container) return;

  const filter = taskFilter ? taskFilter.value : "all";

  const filteredTasks = tasks.filter(task => {
    if (filter === "completed") return task.completed;
    if (filter === "pending") return !task.completed;
    if (filter === "all") return true;
    return task.type === filter;
  });

  filteredTasks.sort((a, b) => a.due.localeCompare(b.due));

  if (filteredTasks.length === 0) {
    container.innerHTML =
      '<div class="task-card">No tasks found. Add a task to get started!</div>';
    return;
  }

  container.innerHTML = filteredTasks.map(task => `
    <article class="task-card ${task.completed ? "completed" : ""}">
      <div class="task-card-header">
        <input type="checkbox"
          aria-label="Mark ${escapeHTML(task.title)} complete"
          data-complete="${task.id}"
          ${task.completed ? "checked" : ""}>

        <div class="task-card-title">
          ${escapeHTML(task.title)}
          <div class="task-meta">
            ${escapeHTML(task.type.toUpperCase())}
            · Due ${escapeHTML(formatDate(task.due))}
          </div>
        </div>

        <button class="delete-button"
          data-delete-task="${task.id}">DELETE</button>
      </div>

      ${task.notes ? `
        <p class="task-notes">${escapeHTML(task.notes)}</p>
      ` : ""}
    </article>
  `).join("");

  container.querySelectorAll("[data-complete]").forEach(input => {
    input.addEventListener("change", () => {
      const task = tasks.find(item =>
        item.id === input.dataset.complete
      );

      if (!task) return;

      task.completed = input.checked;
      saveTasks();
      renderTasks();
      renderSummaries();
      renderCalendar();
    });
  });

  container.querySelectorAll("[data-delete-task]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Delete this task?")) return;

      tasks = tasks.filter(task =>
        task.id !== button.dataset.deleteTask
      );

      saveTasks();
      renderTasks();
      renderSummaries();
      renderCalendar();
    });
  });
}


// =====================================
// HOME DASHBOARD SUMMARIES
// =====================================

function summaryHTML(taskList) {
  if (taskList.length === 0) return "No tasks yet.";

  return taskList.map(task => `
    <div class="summary-item ${task.completed ? "done" : ""}">
      ${task.completed ? "✓ " : "○ "}
      ${escapeHTML(task.title)}
      <div class="task-meta">${escapeHTML(formatDate(task.due))}</div>
    </div>
  `).join("");
}

function renderSummaries() {
  const today = todayString();

  const todayTasks = tasks.filter(task =>
    task.due === today && !task.completed
  );

  const dailyTasks = tasks.filter(task =>
    task.type === "daily" && !task.completed
  );

  const weeklyTasks = tasks.filter(task =>
    task.type === "weekly" && !task.completed
  );

  const todayElement = document.getElementById("todaySummary");
  const dailyElement = document.getElementById("dailySummary");
  const weeklyElement = document.getElementById("weeklySummary");

  if (todayElement) {
    todayElement.innerHTML = summaryHTML(todayTasks);
  }

  if (dailyElement) {
    dailyElement.innerHTML = summaryHTML(dailyTasks);
  }

  if (weeklyElement) {
    weeklyElement.innerHTML = summaryHTML(weeklyTasks);
  }
}


// =====================================
// CALENDAR
// =====================================

let calendarDate = new Date();
let selectedDate = todayString();

function initializeCalendar() {
  document.getElementById("prevMonth").addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });

  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  document.getElementById("calendarMonth").textContent =
    calendarDate.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric"
    });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let html = dayNames.map(day =>
    `<div class="calendar-day-name">${day}</div>`
  ).join("");

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    html += '<div></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = [
      year,
      String(month + 1).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");

    const hasTasks = tasks.some(task => task.due === dateKey);
    const isToday = dateKey === todayString();
    const isSelected = dateKey === selectedDate;

    const classes = [
      "calendar-day",
      hasTasks ? "has-tasks" : "",
      isToday ? "today" : "",
      isSelected ? "selected" : ""
    ].filter(Boolean).join(" ");

    html += `
      <button class="${classes}" data-calendar-date="${dateKey}">
        ${day}${hasTasks ? " •" : ""}
      </button>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll("[data-calendar-date]").forEach(button => {
    button.addEventListener("click", () => {
      selectedDate = button.dataset.calendarDate;
      renderCalendar();
    });
  });

  document.getElementById("selectedDateTitle").textContent =
    `Tasks for ${formatDate(selectedDate)}`;

  const selectedTasks = tasks.filter(task => task.due === selectedDate);
  const taskContainer = document.getElementById("calendarTasks");

  if (selectedTasks.length === 0) {
    taskContainer.innerHTML =
      '<p class="muted">No tasks scheduled for this date.</p>';
  } else {
    taskContainer.innerHTML = selectedTasks.map(task => `
      <div class="calendar-task">
        ${task.completed ? "✓" : "○"}
        ${escapeHTML(task.title)}
        <span class="task-meta">(${escapeHTML(task.type)})</span>
      </div>
    `).join("");
  }
}


// =====================================
// CURRICULUM / SUBJECTS
// =====================================

const subjectForm = document.getElementById("subjectForm");

if (subjectForm) {
  subjectForm.addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("subjectName")
      .value.trim();

    const details = document.getElementById("subjectDetails")
      .value.trim();

    if (!name) return;

    subjects.push({
      id: makeId(),
      name,
      details
    });

    saveSubjects();
    subjectForm.reset();
    renderSubjects();
  });
}

function renderSubjects() {
  const container = document.getElementById("subjectList");
  if (!container) return;

  if (subjects.length === 0) {
    container.innerHTML =
      '<div class="subject-card">No subjects added yet.</div>';
    return;
  }

  container.innerHTML = subjects.map(subject => `
    <article class="subject-card">
      <h3>${escapeHTML(subject.name)}</h3>
      <p>${escapeHTML(subject.details || "No notes added.")}</p>
      <button class="delete-button"
        data-delete-subject="${subject.id}">DELETE SUBJECT</button>
    </article>
  `).join("");

  container.querySelectorAll("[data-delete-subject]").forEach(button => {
    button.addEventListener("click", () => {
      if (!confirm("Delete this subject?")) return;

      subjects = subjects.filter(subject =>
        subject.id !== button.dataset.deleteSubject
      );

      saveSubjects();
      renderSubjects();
    });
  });
}