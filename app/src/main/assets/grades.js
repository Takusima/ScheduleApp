(function () {
    "use strict";

    const STORAGE_PREFIX = "scheduleapp.grades.v1:";
    let editingId = null;
    let showDebtsOnly = false;

    const $ = (id) => document.getElementById(id);
    const clean = (value) => String(value == null ? "" : value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    const escapeHtml = (value) => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const groupKey = () => {
        const select = $("groupSelect");
        const group = clean(select ? select.value : "");
        return group ? group.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_") : "none";
    };
    const storageKey = () => STORAGE_PREFIX + groupKey();
    const read = () => {
        try {
            const data = JSON.parse(localStorage.getItem(storageKey()) || "[]");
            return Array.isArray(data) ? data.filter(item => item && typeof item === "object") : [];
        } catch (_) { return []; }
    };
    const write = (items) => localStorage.setItem(storageKey(), JSON.stringify(items));
    const today = () => {
        const d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    };
    const average = (items) => {
        const values = items.filter(item => !item.debt && !item.done && /^[2-5]$/.test(String(item.grade))).map(item => Number(item.grade));
        return values.length ? (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2).replace(".", ",") : "—";
    };

    function injectStyles() {
        if ($("gradesStyle")) return;
        const style = document.createElement("style");
        style.id = "gradesStyle";
        style.textContent = `
            #gradesPage { padding-bottom: calc(112px + env(safe-area-inset-bottom)); }
            .grades-summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:4px 0 16px; }
            .grades-subject-card { padding:14px; border-radius:18px; background:linear-gradient(145deg,#20172d,#15101c); border:1px solid rgba(166,108,255,.17); }
            .grades-subject-card + .grades-subject-card { margin-top:12px; }
            .grades-subject-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:11px; }
            .grades-subject-title { min-width:0; font-size:14px; font-weight:850; color:#f3eef9; overflow-wrap:anywhere; }
            .grades-subject-average { flex:0 0 auto; padding:6px 9px; border-radius:11px; background:rgba(166,108,255,.15); color:#d0b3ff; font-size:14px; font-weight:900; }
            .grades-subject-meta { margin-top:4px; color:#92879f; font-size:10px; }
            .grades-subject-card .grade-row { margin-top:8px; padding:11px; background:rgba(255,255,255,.025); }
            .grades-subject-card .grade-actions { margin-top:9px; }
            .grades-stat { min-width:0; padding:13px 9px; border-radius:17px; background:linear-gradient(145deg,#241735,#17111f); border:1px solid rgba(166,108,255,.19); }
            .grades-stat b { display:block; font-size:21px; line-height:1.2; color:#c5a2ff; overflow-wrap:anywhere; }
            .grades-stat span { display:block; margin-top:5px; color:#91869e; font-size:10px; line-height:1.25; }
            .grades-toolbar { display:flex; gap:8px; margin-bottom:12px; }
            .grades-add,.grades-filter,.grades-save,.grades-cancel { min-height:43px; border-radius:13px; padding:0 12px; font-size:12px; font-weight:750; }
            .grades-add,.grades-save { color:white; background:linear-gradient(135deg,#a66cff,#7945d6); box-shadow:0 7px 18px rgba(126,70,220,.22); }
            .grades-add { flex:1; }
            .grades-filter,.grades-cancel { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); color:#c4b8d0; }
            .grades-filter.active { color:#d7bcff; border-color:rgba(166,108,255,.4); background:rgba(139,81,230,.15); }
            .grades-list { display:flex; flex-direction:column; gap:9px; }
            .grade-row { padding:14px; border-radius:17px; background:linear-gradient(145deg,#20172d,#15101c); border:1px solid rgba(166,108,255,.14); }
            .grade-row.debt { border-color:rgba(255,160,110,.28); }
            .grade-row-head { display:flex; align-items:flex-start; gap:10px; }
            .grade-mark { width:42px; height:42px; flex:0 0 42px; display:flex; align-items:center; justify-content:center; border-radius:13px; background:rgba(139,81,230,.17); color:#c8a8ff; font-size:20px; font-weight:850; }
            .grade-row.debt .grade-mark { color:#ffbd8b; background:rgba(255,151,91,.12); }
            .grade-info { min-width:0; flex:1; }
            .grade-subject { color:#f3eef9; font-size:14px; font-weight:800; overflow-wrap:anywhere; }
            .grade-meta { margin-top:4px; color:#8f849b; font-size:10px; line-height:1.4; }
            .grade-note { margin-top:8px; color:#b9adca; font-size:12px; overflow-wrap:anywhere; }
            .grade-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:12px; }
            .grade-actions button { min-height:33px; padding:0 10px; border-radius:10px; background:rgba(255,255,255,.055); color:#c4b8d0; font-size:10px; font-weight:750; }
            .grade-actions .grade-resolve { color:#c7f1d4; background:rgba(79,190,120,.1); }
            .grades-empty { padding:26px 17px; text-align:center; border-radius:17px; color:#92879f; background:rgba(255,255,255,.025); border:1px dashed rgba(166,108,255,.2); font-size:12px; line-height:1.6; }
            .grades-modal { position:fixed; inset:0; z-index:1200; display:none; align-items:flex-end; justify-content:center; padding:16px; background:rgba(0,0,0,.66); backdrop-filter:blur(8px); }
            .grades-modal.open { display:flex; }
            .grades-form { width:100%; max-width:520px; max-height:90vh; overflow:auto; padding:19px; border-radius:24px; background:linear-gradient(150deg,#251a35,#110d19); border:1px solid rgba(190,155,255,.22); box-shadow:0 24px 70px rgba(0,0,0,.55); }
            .grades-form h2 { margin:0 0 15px; font-size:20px; }
            .grades-field { display:block; margin:12px 0; color:#a99db7; font-size:11px; font-weight:700; }
            .grades-field input,.grades-field select,.grades-field textarea { display:block; width:100%; min-height:43px; margin-top:6px; padding:10px 12px; border-radius:12px; color:#f7f1ff; background:#17111f; border:1px solid rgba(190,155,255,.18); outline:none; }
            .grades-field textarea { min-height:66px; resize:vertical; }
            .grades-checkbox { display:flex; align-items:center; gap:9px; margin:14px 0; color:#e0d6ec; font-size:12px; }
            .grades-form-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:15px; }
            .grades-form-actions button { min-height:44px; border-radius:13px; font-weight:800; }
            @media (min-width:600px) { .grades-modal { align-items:center; } }
        `;
        document.head.appendChild(style);
    }

    function ensurePage() {
        if ($("gradesPage")) return;
        const settings = $("settingsPage");
        if (!settings || !settings.parentNode) return;
        const page = document.createElement("section");
        page.id = "gradesPage";
        page.className = "screen screen-page";
        page.innerHTML = `
            <div class="top-title"><h1>Оценки</h1><p>Успеваемость и задолженности по группе</p></div>
            <div class="grades-summary">
                <div class="grades-stat"><b id="gradesSubjectCount">0</b><span>Предметов</span></div>
                <div class="grades-stat"><b id="gradesCount">0</b><span>Оценок</span></div>
                <div class="grades-stat"><b id="gradesDebtCount">0</b><span>Долгов</span></div>
            </div>
            <div class="grades-toolbar"><button id="gradesAdd" class="grades-add" type="button">＋ Добавить запись</button><button id="gradesFilter" class="grades-filter" type="button">Все</button></div>
            <div id="gradesList" class="grades-list"></div>
        `;
        settings.parentNode.insertBefore(page, settings);

        const nav = document.querySelector(".bottom-nav");
        if (nav && !$("navGrades")) {
            const button = document.createElement("button");
            button.id = "navGrades";
            button.className = "nav-btn";
            button.type = "button";
            button.innerHTML = '<svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"></path><path d="M8 8h8M8 12h3M8 16h5"></path><path d="m14 12 2 2 4-5"></path></svg><span class="label">Оценки</span>';
            button.addEventListener("click", () => window.showPage("grades"));
            nav.appendChild(button);
        }
        nav && nav.classList.add("has-grades");
        const navStyle = document.createElement("style");
        navStyle.textContent = '.bottom-nav.has-grades{grid-template-columns:repeat(5,minmax(0,1fr))}.bottom-nav.has-grades .nav-btn .label{font-size:9px;white-space:nowrap}.bottom-nav.has-grades .nav-btn{min-width:0;padding:0 1px}';
        document.head.appendChild(navStyle);

        const modal = document.createElement("div");
        modal.id = "gradesModal";
        modal.className = "grades-modal";
        modal.innerHTML = `
            <form class="grades-form" id="gradesForm">
                <h2 id="gradesFormTitle">Новая запись</h2>
                <label class="grades-field">Предмет<input id="gradeSubject" list="gradeSubjectsList" maxlength="120" required placeholder="Выбери предмет или введи название"><datalist id="gradeSubjectsList"></datalist></label>
                <label class="grades-field">Оценка<select id="gradeValue"><option value="">Без оценки</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="Зачёт">Зачёт</option><option value="Н/А">Н/А</option></select></label>
                <label class="grades-field">Дата<input id="gradeDate" type="date" required></label>
                <label class="grades-field">Комментарий<textarea id="gradeNote" maxlength="500" placeholder="Тема, работа, что нужно пересдать…"></textarea></label>
                <label class="grades-checkbox"><input id="gradeDebt" type="checkbox"> Это задолженность / несданная работа</label>
                <div class="grades-form-actions"><button class="grades-cancel" id="gradesCancel" type="button">Отмена</button><button class="grades-save" type="submit">Сохранить</button></div>
            </form>`;
        document.body.appendChild(modal);

        $("gradesAdd").addEventListener("click", () => openForm(null));
        $("gradesFilter").addEventListener("click", () => { showDebtsOnly = !showDebtsOnly; $("gradesFilter").classList.toggle("active", showDebtsOnly); $("gradesFilter").textContent = showDebtsOnly ? "Все записи" : "Только долги"; render(); });
        $("gradesCancel").addEventListener("click", closeForm);
        modal.addEventListener("click", event => { if (event.target === modal) closeForm(); });
        $("gradesForm").addEventListener("submit", saveForm);
        const group = $("groupSelect");
        if (group) group.addEventListener("change", () => { updateSubjectSuggestions(); render(); });
        const originalShowPage = window.showPage;
        if (typeof originalShowPage === "function") {
            window.showPage = function (pageName) {
                if (pageName !== "grades") {
                    // The original showPage() only hides its four built-in pages.
                    // Hide the dynamically added grades page before switching away.
                    $("gradesPage").classList.remove("active");
                    return originalShowPage(pageName);
                }
                document.querySelectorAll(".screen-page").forEach(page => page.classList.remove("active"));
                $("gradesPage").classList.add("active");
                document.querySelectorAll(".nav-btn").forEach(button => button.classList.remove("active"));
                $("navGrades").classList.add("active");
                $("gradesPage").scrollTop = 0;
                render();
            };
        }
        render();
    }

    function openForm(id) {
        editingId = id;
        const item = id == null ? null : read().find(row => row.id === id);
        $("gradesFormTitle").textContent = item ? "Изменить запись" : "Новая запись";
        updateSubjectSuggestions();
        $("gradeSubject").value = item ? canonicalSubject(item.subject) : "";
        $("gradeValue").value = item ? item.grade : "";
        $("gradeDate").value = item ? item.date : today();
        $("gradeNote").value = item ? item.note || "" : "";
        $("gradeDebt").checked = item ? !!item.debt : false;
        $("gradesModal").classList.add("open");
        setTimeout(() => $("gradeSubject").focus(), 80);
    }

    function closeForm() { $("gradesModal").classList.remove("open"); editingId = null; }

    function saveForm(event) {
        event.preventDefault();
        const subject = canonicalSubject($("gradeSubject").value);
        if (!subject) { $("gradeSubject").focus(); return; }
        const items = read();
        const entry = {
            id: editingId == null ? (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)) : editingId,
            subject,
            grade: $("gradeValue").value,
            date: $("gradeDate").value || today(),
            note: clean($("gradeNote").value),
            debt: $("gradeDebt").checked,
            done: false
        };
        const index = items.findIndex(item => item.id === editingId);
        if (index >= 0) {
            entry.done = !!items[index].done;
            items[index] = entry;
        } else items.unshift(entry);
        write(items);
        closeForm();
        render();
    }

    function normalizedSubject(value) {
        return clean(value).toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
    }

    function scheduleSubjects() {
        const found = new Map();
        if (typeof state === "undefined" || !state.data) return [];
        Object.keys(state.data).forEach(date => {
            const lessons = (state.data[date] || {})[state.selectedGroup] || [];
            lessons.forEach(lesson => {
                const name = clean(lesson && lesson.lesson);
                const key = normalizedSubject(name);
                if (name && key && !found.has(key)) found.set(key, name);
            });
        });
        return Array.from(found.values()).sort((a, b) => a.localeCompare(b, "ru"));
    }

    function canonicalSubject(value) {
        const typed = clean(value);
        if (!typed) return "";
        const key = normalizedSubject(typed);
        return scheduleSubjects().find(name => normalizedSubject(name) === key) || typed;
    }

    function updateSubjectSuggestions() {
        const list = $("gradeSubjectsList");
        if (!list) return;
        list.innerHTML = scheduleSubjects().map(name => '<option value="' + escapeHtml(name) + '"></option>').join("");
    }

    function subjectAverage(items) {
        const values = items.filter(item => !item.debt && !item.done && /^[2-5]$/.test(String(item.grade))).map(item => Number(item.grade));
        return values.length ? (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(2).replace(".", ",") : "—";
    }

    function render() {
        if (!$("gradesList")) return;
        updateSubjectSuggestions();
        const items = read();
        const debts = items.filter(item => item.debt && !item.done);
        const numericGrades = items.filter(item => !item.debt && /^[2-5]$/.test(String(item.grade)));
        const allSubjects = new Map();
        items.forEach(item => {
            const name = canonicalSubject(item.subject) || clean(item.subject) || "Без предмета";
            const key = normalizedSubject(name);
            if (!allSubjects.has(key)) allSubjects.set(key, { name, items: [] });
            allSubjects.get(key).items.push(item);
        });
        $("gradesSubjectCount").textContent = String(Array.from(allSubjects.values()).filter(group => group.items.some(item => !item.debt && /^[2-5]$/.test(String(item.grade)))).length);
        $("gradesCount").textContent = String(numericGrades.length);
        $("gradesDebtCount").textContent = String(debts.length);

        const visibleItems = (showDebtsOnly ? items.filter(item => item.debt && !item.done) : items)
            .slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        if (!visibleItems.length) {
            $("gradesList").innerHTML = '<div class="grades-empty">' + (showDebtsOnly ? "Задолженностей нет." : "Пока нет записей.<br>Нажми «Добавить запись», чтобы внести оценку или задолженность по конкретному предмету.") + "</div>";
            return;
        }

        const visibleBySubject = new Map();
        visibleItems.forEach(item => {
            const name = canonicalSubject(item.subject) || clean(item.subject) || "Без предмета";
            const key = normalizedSubject(name);
            if (!visibleBySubject.has(key)) visibleBySubject.set(key, { name, items: [] });
            visibleBySubject.get(key).items.push(item);
        });

        $("gradesList").innerHTML = Array.from(visibleBySubject.values())
            .sort((a, b) => a.name.localeCompare(b.name, "ru"))
            .map(group => {
                const graded = group.items.filter(item => !item.debt && /^[2-5]$/.test(String(item.grade)));
                const cards = group.items.map(item => {
                    const debt = item.debt && !item.done;
                    const mark = debt ? "!" : (item.grade || "—");
                    const status = debt ? "Задолженность" : (item.done && item.debt ? "Долг закрыт" : (item.grade ? "Оценка" : "Без оценки"));
                    const date = item.date ? new Date(item.date + "T12:00:00").toLocaleDateString("ru-RU") : "";
                    return '<article class="grade-row' + (debt ? " debt" : "") + '"><div class="grade-row-head"><div class="grade-mark">' + escapeHtml(mark) + '</div><div class="grade-info"><div class="grade-meta">' + escapeHtml(date) + " · " + escapeHtml(status) + '</div>' + (item.note ? '<div class="grade-note">' + escapeHtml(item.note) + "</div>" : "") + '</div></div><div class="grade-actions">' + (debt ? '<button class="grade-resolve" data-action="resolve" data-id="' + escapeHtml(item.id) + '">Закрыть долг</button>' : "") + '<button data-action="edit" data-id="' + escapeHtml(item.id) + '">Изменить</button><button data-action="delete" data-id="' + escapeHtml(item.id) + '">Удалить</button></div></article>';
                }).join("");
                return '<section class="grades-subject-card"><div class="grades-subject-head"><div><div class="grades-subject-title">' + escapeHtml(group.name) + '</div><div class="grades-subject-meta">' + graded.length + (graded.length === 1 ? " оценка" : " оценок") + " · " + group.items.filter(item => item.debt && !item.done).length + ' долгов</div></div><div class="grades-subject-average">' + subjectAverage(group.items) + "</div></div>" + cards + "</section>";
            }).join("");

        $("gradesList").querySelectorAll("button[data-action]").forEach(button => {
            button.addEventListener("click", () => {
                const id = button.dataset.id;
                const action = button.dataset.action;
                const data = read();
                const item = data.find(row => row.id === id);
                if (!item) return;
                if (action === "edit") openForm(id);
                else if (action === "resolve") { item.done = true; write(data); render(); }
                else if (action === "delete") {
                    if (window.confirm("Удалить запись по предмету «" + item.subject + "»?")) {
                        write(data.filter(row => row.id !== id));
                        render();
                    }
                }
            });
        });
    }

    function init() {
        injectStyles();
        ensurePage();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();