(function () {
    "use strict";

    const STORAGE_PREFIX = "scheduleapp_subjects_v2_";
    let subjects = load();\n    let curator = localStorage.getItem("scheduleapp_curator_v1_" + groupKey()) || "";

    function groupKey() { const s=document.getElementById("groupSelect"); const g=clean(s?s.value:""); return g ? g.toLowerCase().replace(/[^a-zа-я0-9]+/gi,"_") : "none"; }\n\n    function load() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + groupKey()) || "{}");
            return value && typeof value === "object" ? value : {};
        } catch (_) {
            return {};
        }
    }

    function save() {
        localStorage.setItem(STORAGE_PREFIX + groupKey(), JSON.stringify(subjects));
    }

    function clean(value) {
        return String(value == null ? "" : value)
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function key(value) {
        return clean(value).toLowerCase().replace(/ё/g, "е");
    }

    function esc(value) {
        return clean(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function validSubject(value) {
        const s = clean(value);
        if (!s || s.length < 2 || s.length > 120) return false;
        const n = key(s);
        if (/^(каб|ауд|аудитория|кабинет)$/i.test(n)) return false; if (/^10\s*м\/с$/i.test(s)) return false; if (/классн(?:ый|ые)?\s*час/i.test(s)) return false;
        if (/^\d+(?:[.,]\d+)?$/.test(s)) return false;
        if (/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)$/i.test(n)) return false;
        return true;
    }

    function merge(found) {
        let changed = false;
        found.forEach(function (name) {
            const cleanName = clean(name);
            const k = key(cleanName);
            if (!validSubject(cleanName)) return;
            const existing = Object.keys(subjects).find(function (x) {
                return key(x) === k;
            });
            if (!existing) {
                subjects[cleanName] = "";
                changed = true;
            }
        });
        if (changed) save();
        render();
    }

    function currentGroup() {
        const select = document.getElementById("groupSelect");
        return select ? clean(select.value) : "";
    }

    async function collectFromFiles() {
        if (!window.XLSX) return;
        const files = Array.isArray(window.__scheduleSubjectFiles)
            ? window.__scheduleSubjectFiles.slice()
            : [];
        const group = currentGroup();
        if (!group || !files.length) return;

        const found = [];
        for (const file of files) {
            try {
                const response = await fetch(file.url, { cache: "no-store" });
                if (!response.ok) continue;
                const buffer = await response.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
                workbook.SheetNames.forEach(function (sheetName) {
                    const sheet = workbook.Sheets[sheetName];
                    if (!sheet) return;
                    const rows = XLSX.utils.sheet_to_json(sheet, {
                        header: 1, defval: "", raw: true
                    });
                    if (!rows.length) return;

                    let columns = [];
                    for (let r = 0; r < Math.min(rows.length, 8); r++) {
                        const row = rows[r] || [];
                        for (let c = 0; c < row.length - 1; c++) {
                            if (/^каб\.?$/i.test(clean(row[c])) &&
                                key(row[c + 1]) === key(group)) {
                                columns.push(c + 1);
                            }
                        }
                    }
                    columns = Array.from(new Set(columns));
                    if (!columns.length) return;

                    columns.forEach(function (column) {
                        for (let r = 0; r < rows.length; r++) {
                            const value = clean((rows[r] || [])[column]);
                            if (validSubject(value)) found.push(value);
                        }
                    });
                });
            } catch (_) {}
        }
        merge(found);
    }

    function inject() {
        if (document.getElementById("subjectsPage")) return;

        const style = document.createElement("style");
        style.id = "subjectsStyle";
        style.textContent = `
            #subjectsPage {
                position:relative;
            }
            #subjectsPage .subjects-back {
                width:100%; height:44px; margin-bottom:12px;
                border-radius:14px;
                background:rgba(255,255,255,.055);
                border:1px solid rgba(255,255,255,.07);
                color:#d8d0df; font-weight:700; cursor:pointer;
            }
            #subjectsPage .subject-search {
                width:100%; height:46px; border-radius:14px;
                padding:0 14px; color:#fff;
                background:rgba(255,255,255,.055);
                border:1px solid rgba(255,255,255,.07);
                outline:none; margin-bottom:12px;
            }
            .subjects-open-btn {
                position:absolute;
                top:0; right:0;
                width:48px; height:48px;
                border-radius:16px;
                background:linear-gradient(135deg,#a66cff,#7945d6);
                border:1px solid rgba(255,255,255,.10);
                box-shadow:0 8px 24px rgba(126,70,220,.30), inset 0 1px rgba(255,255,255,.18);
                color:#fff; cursor:pointer;
                overflow:hidden;
                isolation:isolate;
                transition:transform .18s ease, box-shadow .25s ease;
            }
            .subjects-open-btn::before {
                content:"";
                position:absolute;
                width:80px; height:80px;
                left:-16px; top:-48px;
                border-radius:45%;
                background:rgba(255,255,255,.20);
                filter:blur(1px);
                animation:subjectsWater 2.8s ease-in-out infinite;
                z-index:-1;
            }
            .subjects-open-btn::after {
                content:"";
                position:absolute;
                inset:0;
                border-radius:inherit;
                background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.22) 48%,transparent 70%);
                transform:translateX(-120%);
                animation:subjectsShine 3.6s ease-in-out infinite;
            }
            .subjects-open-btn:active {
                transform:scale(.94);
            }
            .subjects-open-icon {
                position:relative;
                z-index:2;
                font-size:21px;
                line-height:1;
            }
            @keyframes subjectsWater {
                0%,100% { transform:translate3d(-3px,0,0) rotate(-4deg); border-radius:45% 55% 50% 50%; }
                50% { transform:translate3d(12px,7px,0) rotate(7deg); border-radius:55% 45% 42% 58%; }
            }
            @keyframes subjectsShine {
                0%,55% { transform:translateX(-120%); }
                75%,100% { transform:translateX(120%); }
            }
            #subjectsPage .subject-search::placeholder { color:#746c79; }
            .subjects-count { color:#817987; font-size:11px; margin:0 4px 10px; } .curator-card{position:relative;overflow:hidden;padding:16px;margin-bottom:14px;border-radius:21px;background:linear-gradient(145deg,#33204d,#17111f);border:1px solid rgba(182,130,255,.32);box-shadow:0 0 18px rgba(145,82,230,.16),inset 0 1px rgba(255,255,255,.1);animation:curatorGlow 3.5s ease-in-out infinite}.curator-card:after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.2) 49%,transparent 56%);animation:curatorSparkle 4.5s ease-in-out infinite;pointer-events:none}@keyframes curatorGlow{0%,100%{box-shadow:0 0 14px rgba(145,82,230,.14),inset 0 1px rgba(255,255,255,.08)}50%{box-shadow:0 0 28px rgba(166,108,255,.3),inset 0 1px rgba(255,255,255,.14)}}@keyframes curatorSparkle{0%,55%{transform:translateX(-65%)}78%,100%{transform:translateX(65%)}}
            .subject-list { display:flex; flex-direction:column; gap:8px; }
            .subject-row {
                display:flex; align-items:center; gap:12px;
                width:100%; padding:14px;
                border-radius:17px; text-align:left; cursor:pointer;
                background:#151119; border:1px solid rgba(255,255,255,.055);
            }
            .subject-icon {
                width:40px; height:40px; flex:0 0 40px;
                display:flex; align-items:center; justify-content:center;
                border-radius:13px; background:rgba(139,81,230,.16);
                font-size:19px;
            }
            .subject-main { min-width:0; flex:1; }
            .subject-name { font-size:14px; font-weight:700; word-break:break-word; }
            .subject-teacher { margin-top:4px; color:#817987; font-size:11px; word-break:break-word; }
            .subject-arrow { color:#746c79; font-size:22px; }
            .subject-empty {
                padding:28px 15px; border-radius:18px; text-align:center;
                color:#817986; background:#141017; border:1px solid rgba(255,255,255,.05);
            }
            .teacher-label { color:#817987; font-size:12px; margin-bottom:7px; }
            .teacher-input {
                width:100%; height:48px; padding:0 14px; border-radius:14px;
                color:#fff; background:rgba(255,255,255,.055);
                border:1px solid rgba(255,255,255,.08); outline:none;
            }
            .teacher-save {
                width:100%; height:45px; margin-top:12px; border-radius:14px;
                background:linear-gradient(135deg,#a66cff,#7945d6); font-weight:700;
            }
        `;
        document.head.appendChild(style);

        const settings = document.getElementById("settingsPage");
        const page = document.createElement("section");
        page.id = "subjectsPage";
        page.className = "screen-page";
        page.innerHTML = `
            <div class="top-title">
                <h1>Предметы</h1>
                <p>Предметы из расписания и преподаватели</p>
            </div>
            <button class="subjects-back" onclick="showPage('schedule')">‹&nbsp;&nbsp; Назад к расписанию</button>
            <input id="subjectSearch" class="subject-search" type="search" placeholder="🔎  Найти предмет">
            <div id="curatorCard" class="curator-card"></div><div id="subjectsCount" class="subjects-count"></div>
            <div id="subjectsList" class="subject-list"></div>
        `;
        settings.parentNode.insertBefore(page, settings);

        const scheduleTitle = document.querySelector("#schedulePage .top-title");
        if (scheduleTitle && !document.getElementById("openSubjectsButton")) {
            const button = document.createElement("button");
            button.id = "openSubjectsButton";
            button.className = "subjects-open-btn";
            button.setAttribute("aria-label", "Предметы");
            button.title = "Предметы";
            button.innerHTML = '<span class="subjects-open-icon">📚</span>';
            button.onclick = function () { showPage("subjects"); };
            scheduleTitle.style.position = "relative";
            scheduleTitle.style.paddingRight = "58px";
            scheduleTitle.appendChild(button);
        }

        const search = document.getElementById("subjectSearch");
        search.addEventListener("input", render);

        render();
    }

    function render() {
        const list = document.getElementById("subjectsList");
        const count = document.getElementById("subjectsCount");
        if (!list || !count) return;

        const card = document.getElementById("curatorCard"); if(card){card.innerHTML="<div style=\"font-size:16px;font-weight:800\">✨ Куратор</div><div style=\"margin-top:5px;color:#92889e;font-size:11px\">Классный час · 09:55</div><div style=\"margin-top:9px;font-size:14px;font-weight:700\">"+(curator||"Куратор не указан")+"</div>";}\n        const query = key(document.getElementById("subjectSearch")?.value || "");
        const names = Object.keys(subjects)
            .sort(function (a, b) { return a.localeCompare(b, "ru"); })
            .filter(function (name) { return !query || key(name).includes(query); });

        count.textContent = Object.keys(subjects).length
            ? "Всего предметов: " + Object.keys(subjects).length
            : "";

        if (!names.length) {
            list.innerHTML = '<div class="subject-empty">Предметов пока нет.<br><br>Они появятся после загрузки расписания.</div>';
            return;
        }

        list.innerHTML = "";
        names.forEach(function (name) {
            const row = document.createElement("button");
            row.className = "subject-row";
            row.innerHTML =
                '<div class="subject-icon">📚</div>' +
                '<div class="subject-main">' +
                '<div class="subject-name">' + esc(name) + '</div>' +
                '<div class="subject-teacher">' +
                (subjects[name] ? esc(subjects[name]) : "Преподаватель не указан") +
                '</div></div><div class="subject-arrow">›</div>';
            row.onclick = function () { editTeacher(name); };
            list.appendChild(row);
        });
    }

    function editCurator() { const value=prompt("ФИО куратора",curator||""); if(value!==null){curator=clean(value); localStorage.setItem("scheduleapp_curator_v1_"+groupKey(),curator); render();} }\n\n    function editTeacher(name) {
        let modal = document.getElementById("teacherModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "teacherModal";
            modal.className = "modal";
            modal.innerHTML = `
                <div class="modal-box" onclick="event.stopPropagation()">
                    <div class="modal-title">
                        <strong id="teacherTitle"></strong>
                        <button class="close-btn" id="teacherClose">×</button>
                    </div>
                    <div class="teacher-label">ФИО преподавателя</div>
                    <input id="teacherInput" class="teacher-input" type="text" autocomplete="name" placeholder="Например, Иванов Иван Иванович">
                    <button id="teacherSave" class="teacher-save">Сохранить</button>
                </div>`;
            document.body.appendChild(modal);
            modal.addEventListener("click", function (e) {
                if (e.target === modal) modal.classList.remove("open");
            });
            document.getElementById("teacherClose").onclick = function () {
                modal.classList.remove("open");
            };
        }
        document.getElementById("teacherTitle").textContent = name;
        const input = document.getElementById("teacherInput");
        input.value = subjects[name] || "";
        document.getElementById("teacherSave").onclick = function () {
            subjects[name] = clean(input.value);
            save();
            modal.classList.remove("open");
            render();
        };
        modal.classList.add("open");
        setTimeout(function () { input.focus(); }, 80);
    }

    function wrapNativeFiles() {
        if (window.__subjectsWrapped) return;
        window.__subjectsWrapped = true;

        const oldFiles = window.onNativeFiles;
        window.onNativeFiles = function (json, status) {
            try {
                const parsed = typeof json === "string" ? JSON.parse(json) : json;
                window.__scheduleSubjectFiles = Array.isArray(parsed) ? parsed : [];
            } catch (_) {}
            if (typeof oldFiles === "function") oldFiles(json, status);
            setTimeout(collectFromFiles, 500);
        };

        const oldError = window.onNativeError;
        window.onNativeError = function (message) {
            if (typeof oldError === "function") oldError(message);
        };
    }

    function observeGroup() {
        const select = document.getElementById("groupSelect");
        if (!select || select.__subjectsObserved) return;
        select.__subjectsObserved = true;
        select.addEventListener("change", function () {
            setTimeout(collectFromFiles, 100);
        });
    }

    function patchShowPage() {
        if (typeof window.showPage !== "function" || window.showPage.__subjectsPatched) return;
        const original = window.showPage;
        function patched(page) {
            if (page === "subjects") {
                document.querySelectorAll(".screen-page").forEach(function (x) { x.classList.remove("active"); });
                document.getElementById("subjectsPage").classList.add("active");
                const nav = document.querySelector(".bottom-nav");
                if (nav) nav.style.display = "none";
                render();
                collectFromFiles();
                return;
            }
            const nav = document.querySelector(".bottom-nav");
            if (nav) nav.style.display = "";
            original(page);
        }
        patched.__subjectsPatched = true;
        window.showPage = patched;
    }

    function boot() {
        inject();
        wrapNativeFiles();
        observeGroup();
        patchShowPage();
        setTimeout(boot, 1000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();