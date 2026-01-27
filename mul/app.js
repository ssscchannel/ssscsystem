/**
 * 晟自然輔助系統 - 遊戲室 V14-Final (Mul 專用版)
 * 核心邏輯層
 * 修正重點：強制 data_mul 對接、介面淨化、滿版九宮格
 */

// ==========================================================
// 0. PWA Service Worker 註冊與全域變數
// ==========================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] SW registered'))
            .catch(err => console.log('[PWA] SW skip'));
    });
}

// Google Script API (若連線失敗會自動切換為離線模式)
const API_URL = "https://script.google.com/macros/s/AKfycbzxOMG7Y6uQL1qowzJI7ME8GqgZzyLJ1HLyai3WNKURaVz5A5Wbh05BBD0qvuiCVUCf1g/exec"; 
let APP_DATA = { banks: [] };
const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// ==========================================================
// 1. 音效模組 (AudioContext)
// ==========================================================
const AUDIO = {
    ctx: null,
    init: function() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playTone: function(freq, type, duration, vol=0.1) {
        if (!this.ctx) this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playClick: function() { this.playTone(400, 'triangle', 0.05, 0.05); },
    playFlip: function() { this.playTone(600, 'sine', 0.05, 0.03); },
    playMatch: function() { 
        this.playTone(880, 'sine', 0.1, 0.1); 
        setTimeout(()=>this.playTone(1760, 'sine', 0.2, 0.1), 100); 
    },
    playError: function() { this.playTone(150, 'sawtooth', 0.3, 0.1); },
    playAlarm: function() { this.playTone(800, 'square', 0.1, 0.05); },
    playFanfare: function() {
         if(!this.ctx) this.init();
         [523, 659, 783].forEach((f, i) => { 
             setTimeout(() => this.playTone(f, 'triangle', 0.2, 0.1), i * 100);
         });
    },
    playWin: function() {
        if(!this.ctx) this.init();
        [523, 659, 783, 1046].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'square', 0.3, 0.1), i * 150);
        });
    }
};

// ==========================================================
// 2. 核心應用邏輯 (APP)
// ==========================================================
const APP = {
    state: {
        currentPlayer: { school:"", name:"" },
        currentBankId: "b1",
        currentMode: "standard",
        history: [],
        leaderboardTabs: { standard: 'b1', survival: 'b1' }
    },
    adminClickCount: 0,
    adminTimer: null,
    pendingAction: null, 

    init: function() {
        console.log("系統初始化...");

        // 🛑【強制讀取 data_mul.js】🛑
        if (typeof questionData !== 'undefined') {
            APP_DATA.banks = [];
            let bCount = 1;
            Object.keys(questionData).forEach(grade => {
                Object.keys(questionData[grade]).forEach(unit => {
                    APP_DATA.banks.push({
                        id: 'b' + bCount,       
                        title: grade + '-' + unit 
                    });
                    bCount++;
                });
            });
            console.log("✅ 題庫載入成功：共 " + APP_DATA.banks.length + " 個單元");
            
            if(APP_DATA.banks.length > 0) {
                APP.state.currentBankId = APP_DATA.banks[0].id;
            }
        } else {
            console.error("❌ 嚴重錯誤：找不到 questionData，請檢查 data_mul.js");
            alert("題庫檔案讀取失敗，請確認 data_mul.js 存在");
        }

        const savedSchool = localStorage.getItem('pref_school');
        if(savedSchool && document.getElementById('input-school')) {
            document.getElementById('input-school').value = savedSchool;
        }

        APP.renderBankButtons(); 
        APP.syncHistory();
    },
	
	// 補上遺失的偏好設定儲存函式
    savePref: function(key, val) {
        localStorage.setItem('pref_' + key, val);
    },

    syncHistory: function() {
        const leaderboardContainer = document.getElementById('leaderboard-grid');
        if(!leaderboardContainer) return;

        leaderboardContainer.innerHTML = '<div style="color:white; text-align:center; padding-top:50px;">☁️ 正在連線雲端資料庫...</div>';

        const localSaved = localStorage.getItem('cheng_nature_game_log_v2');
        if (localSaved) {
            try { APP.state.history = JSON.parse(localSaved); } catch(e) {}
        }

        if(API_URL.includes("script.google.com")) {
            fetch(API_URL)
                .then(res => res.json())
                .then(cloudData => {
                    APP.state.history = cloudData;
                    APP.updateLeaderboardV11(); 
                    F1.initSetup();
                    TOUR.initSetup();
                    localStorage.setItem('cheng_nature_game_log_v2', JSON.stringify(cloudData));
                })
                .catch(err => {
                    console.warn("[Cloud] 離線模式:", err);
                    APP.updateLeaderboardV11();
                    F1.initSetup();
                    TOUR.initSetup();
                    const lb = document.getElementById('leaderboard-grid');
                    if(lb) {
                        const hint = document.createElement('div');
                        hint.innerHTML = '<small style="color:#f1c40f; display:block; text-align:center;">⚠️ 目前為離線模式 (僅顯示本機紀錄)</small>';
                        lb.insertBefore(hint, lb.firstChild);
                    }
                });
        } else {
             APP.updateLeaderboardV11();
             F1.initSetup();
             TOUR.initSetup();
        }
    },

    initTouchControl: function() {
        document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    },

    triggerAdmin: function() {
        APP.adminClickCount++;
        if (APP.adminTimer) clearTimeout(APP.adminTimer);
        APP.adminTimer = setTimeout(() => { APP.adminClickCount = 0; }, 500);
        if (APP.adminClickCount >= 3) {
            APP.adminClickCount = 0;
            // 簡化：直接跳轉，不做密碼檢查以避免複雜度
            APP.navTo('admin');
        }
    },

    confirmNavTo: function(screenId) {
        AUDIO.playClick();
        if (confirm("確定要返回首頁嗎？")) {
            GAME.abort();
            APP.navTo(screenId);
        }
    },

    navTo: function(screenId, filterStr = null) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const target = document.getElementById('screen-' + screenId);
        if(target) {
            target.classList.add('active');
            target.style.display = 'flex'; // 強制 Flex 佈局
        }
        
        // 隱藏非 active 的 screen
        document.querySelectorAll('.screen:not(.active)').forEach(s => s.style.display = 'none');

        if (screenId === 'input') {
            document.getElementById('input-name').value = "";
            if (APP_DATA.banks && APP_DATA.banks.length > 0) {
                APP.renderBankButtons();
                APP.selectMode('standard'); 
                //APP.state.currentBankId = APP_DATA.banks[0].id;
            }
        }
        if (screenId === 'lobby') APP.updateLeaderboardV11();
        if (screenId === 'history') APP.renderHistory(filterStr);
    },

    selectMode: function(mode) {
        AUDIO.playClick();
        APP.state.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        
        let btnId = "m-std";
        if (mode === 'standard') btnId = "m-std";
        else if (mode === 'survival') btnId = "m-surv";
        else if (mode === 'f1') btnId = "m-f1";
        else if (mode === 'tournament') btnId = "m-tour";

        const btn = document.getElementById(btnId);
        if(btn) btn.classList.add('selected');
    },

    renderBankButtons: function() {
        if (!APP_DATA.banks || APP_DATA.banks.length === 0) return;
        let grades = new Set();
        APP_DATA.banks.forEach(b => {
            let parts = b.title.split('-');
            let g = parts.length > 1 ? parts[0] : "精選";
            grades.add(g);
        });
        let sortedGrades = Array.from(grades).sort();

        const gradeSel = document.getElementById('sel-grade');
        if(gradeSel) {
            gradeSel.innerHTML = "";
            sortedGrades.forEach(g => {
                let opt = document.createElement('option');
                opt.value = g; opt.innerText = g;
                gradeSel.appendChild(opt);
            });
            APP.onGradeChange(true); 
        }
    },

    onGradeChange: function(isInit = false) {
        const gradeSel = document.getElementById('sel-grade');
        const unitSel = document.getElementById('sel-unit');
        if(!gradeSel || !unitSel) return;
        
        const grade = gradeSel.value;
        let filteredBanks = APP_DATA.banks.filter(b => {
            if (grade === "精選") return !b.title.includes('-');
            return b.title.startsWith(grade + '-');
        });

        unitSel.innerHTML = "";
        filteredBanks.forEach(b => {
            let opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = b.title.includes('-') ? b.title.split('-')[1] : b.title;
            unitSel.appendChild(opt);
        });
        
        if(!isInit) AUDIO.playClick();
        APP.onUnitChange(isInit);
    },

    onUnitChange: function(isInit = false) {
        const unitSel = document.getElementById('sel-unit');
        if(unitSel) {
            APP.state.currentBankId = unitSel.value;
			// 🟢【新增】強制同步記憶：將現在選的關卡寫入首頁的記憶中
            localStorage.setItem('pref_last_bank_standard', unitSel.value);
            localStorage.setItem('pref_last_bank_survival', unitSel.value);
            if(!isInit) AUDIO.playClick();
        }
    },

    updateLeaderboardV11: function() {
        const container = document.getElementById('leaderboard-grid');
        if(!container) return;
        container.innerHTML = "";
        
        if(!APP_DATA.banks || APP_DATA.banks.length === 0) {
            container.innerHTML = '<div style="color:#aaa; text-align:center;">尚無題庫資料</div>';
            return;
        }

        // 1. 預先整理所有年級列表
        let grades = new Set();
        APP_DATA.banks.forEach(b => {
            let parts = b.title.split('-');
            let g = parts.length > 1 ? parts[0] : "精選";
            grades.add(g);
        });
        let sortedGrades = Array.from(grades).sort();

        const blocks = [ { id: 'standard', name: '標準競速' }, { id: 'survival', name: '生存模式' } ];

        blocks.forEach(block => {
            const box = document.createElement('div');
            box.className = 'mode-box';
            
            // 🛑 步驟 A：決定「最終目標」是誰 (改為：追隨最新一筆成績紀錄)
            let targetId = null;

            // 1. 先嘗試從歷史紀錄找「該模式下」最新的一筆
            if (APP.state.history && APP.state.history.length > 0) {
                // 複製一份並依時間倒序排列 (最新的在前面)
                // 注意：這裡假設 timestamp 是數字。如果是 Google Sheet 字串需小心，但通常 APP 內是存 timestamp
                const sortedLogs = [...APP.state.history]
                    .filter(h => h.mode === block.id) // 只找目前這個模式(競速/生存)的紀錄
                    .sort((a, b) => b.timestamp - a.timestamp);
                
                if (sortedLogs.length > 0) {
                    targetId = sortedLogs[0].bankId; // 抓到最新的那個單元 ID
                }
            }

            // 2. 如果完全沒紀錄 (或是新系統)，才用 localStorage 或預設值當備案
            if (!targetId) {
                targetId = localStorage.getItem('pref_last_bank_' + block.id) || APP_DATA.banks[0].id;
            }

            // 🟢【補上這段】確保 targetBank 被定義
            let targetBank = APP_DATA.banks.find(b => b.id === targetId);
            
            // 安全檢查：如果 ID 找不到資料 (例如舊紀錄)，強制回歸第一題
            if (!targetBank) {
                targetBank = APP_DATA.banks[0];
                targetId = targetBank.id;
            }

            // 算出目標年級
            let targetGrade = targetBank.title.includes('-') ? targetBank.title.split('-')[0] : "精選";

            // 更新內部狀態，確保下次讀取正確
            APP.state.leaderboardTabs[block.id] = targetId;

            // --- 畫面建置開始 ---

            // 標題與點擊跳轉
            const header = document.createElement('div');
            header.className = 'mode-header';
            header.innerText = block.name;
            header.onclick = () => {
                AUDIO.playClick();
                // 這裡直接讀取選單當下的值，最準確
                let currentVal = unitSelect.value; 
                APP.navTo('history', `${block.id}:${currentVal}`);
            };
            box.appendChild(header);

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'lb-controls-row';

            // 🛑 步驟 B：建立「年級選單」並強制選中目標
            const gradeSelect = document.createElement('select');
            gradeSelect.className = 'lb-mini-select';
            sortedGrades.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g; 
                opt.innerText = g.replace("年級", "");
                if(g === targetGrade) opt.selected = true; // 強制選中
                gradeSelect.appendChild(opt);
            });
            controlsDiv.appendChild(gradeSelect);

            // 🛑 步驟 C：建立「單元選單」並強制選中目標
            const unitSelect = document.createElement('select');
            unitSelect.className = 'lb-mini-select';
            
            // 定義：根據傳入的年級，重新產生單元選項的函式
            const renderUnitOptions = (gradeToRender) => {
                unitSelect.innerHTML = "";
                // 篩選該年級的所有題庫
                const filteredBanks = APP_DATA.banks.filter(b => {
                    if (gradeToRender === "精選") return !b.title.includes('-');
                    return b.title.startsWith(gradeToRender + '-');
                });

                let isTargetInList = false;
                filteredBanks.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.innerText = b.title.includes('-') ? b.title.split('-')[1] : b.title;
                    
                    // 如果這個選項等於我們的目標 ID，就選中它
                    if (b.id === targetId) {
                        opt.selected = true;
                        isTargetInList = true;
                    }
                    unitSelect.appendChild(opt);
                });

                // 如果切換年級後，原本的目標不在清單內，預設選第一個
                if (!isTargetInList && filteredBanks.length > 0) {
                    unitSelect.selectedIndex = 0;
                    // 同步更新目標 ID，以免下次操作錯誤
                    targetId = filteredBanks[0].id;
                }
            };

            // 初次執行：使用我們算好的 targetGrade
            renderUnitOptions(targetGrade);
            controlsDiv.appendChild(unitSelect);
            box.appendChild(controlsDiv);

            // 列表容器
            const listContainer = document.createElement('div');
            listContainer.className = 'tower-list';
            box.appendChild(listContainer);

            // 定義：更新榜單內容
            const updateRankList = () => {
                listContainer.innerHTML = "";
                const currentBankId = unitSelect.value;
                
                // 儲存狀態
                APP.state.leaderboardTabs[block.id] = currentBankId;
                localStorage.setItem('pref_last_bank_' + block.id, currentBankId);
                
                const logs = APP.state.history.filter(h => h.mode === block.id && h.bankId === currentBankId);
                
                if (block.id === 'survival') {
                    logs.sort((a,b) => (b.time - a.time) || (a.timestamp - b.timestamp));
                } else {
                    logs.sort((a,b) => (a.time - b.time) || (a.timestamp - b.timestamp));
                }
                APP.renderRankList(listContainer, logs.slice(0, 20));
            };

            // 🛑 步驟 D：綁定事件 (使用者後續操作)
            gradeSelect.onchange = () => {
                // 切換年級 -> 重繪單元選單 -> 預設選第一個 -> 更新榜單
                targetId = null; // 切換年級後，目標 ID 重置，讓 renderUnitOptions 選第一個
                renderUnitOptions(gradeSelect.value);
                updateRankList(); 
            };

            unitSelect.onchange = () => {
                updateRankList();
            };

            // 初始執行一次榜單更新
            updateRankList();
            container.appendChild(box);
        });
    },

    renderRankList: function(container, list) {
        if (list.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#666;">尚無紀錄</div>`;
        } else {
            list.forEach((log, index) => {
                let rankDisplay = index + 1;
                let colorClass = "";
                if (index === 0) { rankDisplay = "🥇"; colorClass="color:#ffd700;"; }
                else if (index === 1) { rankDisplay = "🥈"; colorClass="color:#e0e0e0;"; }
                else if (index === 2) { rankDisplay = "🥉"; colorClass="color:#cd7f32;"; }

                const row = document.createElement('div');
                row.className = 'rank-row';
                let rightContent = `<span class="rank-time">${log.time.toFixed(2)}s</span>`;
                row.innerHTML = `
                    <div style="display:flex; align-items:center; overflow:hidden;">
                        <span class="rank-idx" style="${colorClass}">${rankDisplay}</span>
                        <span class="rank-name">${log.player}</span>
                    </div>
                    <div style="flex-shrink:0;">${rightContent}</div>
                `;
                container.appendChild(row);
            });
        }
    },

    // 🛑【修復版】歷史紀錄列表：找回標題與學校顯示
    renderHistory: function(filterStr) {
        const list = document.getElementById('history-list');
        const title = document.getElementById('hist-title');
        list.innerHTML = "";
        let logs = [...APP.state.history];
        
        // 1. 處理標題顯示
        if (filterStr && filterStr.includes(':')) {
            const parts = filterStr.split(':');
            const targetMode = parts[0];
            const targetBank = parts[1];
            
            // 🛑 修正：從 APP_DATA.banks 查找對應的中文標題
            const bank = APP_DATA.banks.find(b => b.id === targetBank);
            let bankTitle = bank ? bank.title : targetBank;
            
            // 優化標題格式 (把 "八上-單元名" 改成 "八上 單元名")
            if (bankTitle.includes('-')) {
                const titleParts = bankTitle.split('-'); 
                bankTitle = `${titleParts[0]} ${titleParts[1]}`;
            }
            
            const icon = targetMode === 'survival' ? "❤️ " : "⏱️ ";
            title.innerText = icon + bankTitle;
            
            // 篩選資料
            logs = logs.filter(l => l.mode === targetMode && l.bankId === targetBank);
            
            // 排序 (生存模式比久，競速模式比快)
            if (targetMode === 'survival') {
                logs.sort((a,b) => (b.time - a.time) || (a.timestamp - b.timestamp));
            } else {
                logs.sort((a,b) => (a.time - b.time) || (a.timestamp - b.timestamp));
            }
        } else {
            title.innerText = "所有歷史紀錄";
            logs.sort((a,b) => b.timestamp - a.timestamp);
        }

        if (logs.length === 0) {
            list.innerHTML = "<div style='text-align:center; color:#999; padding:20px;'>暫無資料</div>";
            return;
        }

        // 2. 產生列表 (加回學校欄位)
        logs.forEach(log => {
            let div = document.createElement('div');
            div.className = "hist-row";
            
            let d = new Date(log.timestamp || Date.now());
            let dateStr = `${d.getMonth()+1}/${d.getDate()}`;
            
            // 判斷分數顯示顏色
            let scoreColor = log.mode === 'survival' ? '#e74c3c' : 'var(--primary-neon)';

            // 🛑 修正：這裡把 school 加回來了
            div.innerHTML = `
                <span class="hist-name">${log.player}</span>
                <span class="hist-school">${log.school || ""}</span>
                <span class="hist-date">${dateStr}</span>
                <span class="hist-score" style="color:${scoreColor}">
                    ${log.time.toFixed(2)}s
                </span>
            `;
            list.appendChild(div);
        });
    },

    saveRecord: function(result) {
        const name = APP.state.currentPlayer.name;
        const school = document.getElementById('input-school').value;
        const record = {
            player: name, school: school, 
            bankId: APP.state.currentBankId, 
            mode: APP.state.currentMode, 
            time: result.time, score: result.score, errors: result.errors, 
            timestamp: new Date().getTime() 
        };
        APP.state.history.push(record);
        localStorage.setItem('cheng_nature_game_log_v2', JSON.stringify(APP.state.history));
        
        if(API_URL.includes("script.google.com")) {
            fetch(API_URL, {
                method: 'POST', body: JSON.stringify(record),
                headers: { "Content-Type": "text/plain;charset=utf-8" }
            }).catch(e => console.log("Offline save"));
        }
    }
};

// ==========================================================
// 3. F1 積分賽模組 (Placeholder for F1 logic)
// ==========================================================
const F1 = {
    initSetup: function() {},
    handleGameEnd: function(time, errors) { APP.navTo('result'); }
};

// ==========================================================
// 4. Tour (錦標賽) 模組 (Placeholder for Tour logic)
// ==========================================================
const TOUR = {
    initSetup: function() {},
    handleGameEnd: function(time, errors) { APP.navTo('result'); }
};

// ==========================================================
// 5. 遊戲引擎 (V14-Fix：修正 Class 名稱對應)
// ==========================================================
const GAME = {
    timerInterval: null, startTime: 0, 
    lastFrameTime: 0, lastAlarmTime: 0,
    isPaused: false, pauseStartTime: 0,
    
    questionQueue: [], currentQ: null, 
    correctLeft: 0, totalErrors: 0, ROUNDS_PER_GAME: 5,

    startPre: function() {
        AUDIO.playClick();
        
        // 1. 導航與輸入檢查
        if (APP.state.currentMode === 'f1') { APP.navTo('f1-setup'); return; }
        if (APP.state.currentMode === 'tournament') { APP.navTo('tour-setup'); return; }

        const schoolInput = document.getElementById('input-school');
        const nameInput = document.getElementById('input-name');
        const school = schoolInput ? schoolInput.value.trim() : "預設學校";
        const name = nameInput ? nameInput.value.trim() : "玩家";
        
        let isValid = true;
        if (schoolInput && !school) { schoolInput.classList.add('input-error'); isValid = false; }
        if (nameInput && !name) { nameInput.classList.add('input-error'); isValid = false; }
        
        const removeErr = (e) => e.target.classList.remove('input-error');
        if(schoolInput) schoolInput.addEventListener('animationend', removeErr, {once:true});
        if(nameInput) nameInput.addEventListener('animationend', removeErr, {once:true});
        
        if (!isValid) return; 

        APP.state.currentPlayer.name = name;
        
        const navCenter = document.getElementById('quest-status');
        if (navCenter) navCenter.innerText = `🆔 ${name}`;

        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('critical-alarm');
        
        GAME.prepareQuestions();
    },
	
	// 🟢 建議加在這裡，或者放在物件最後面也可以
    retry: function() {
        this.startPre();
    },

    prepareQuestions: function() {
        if(!APP_DATA.banks) return;
        const bank = APP_DATA.banks.find(b => b.id === APP.state.currentBankId) || APP_DATA.banks[0];
        
        let pool = [];
        if (typeof questionData !== 'undefined') {
            let parts = bank.title.split('-');
            let grade = parts[0];
            let unit = parts.length > 1 ? parts[1] : "";
            if (questionData[grade] && questionData[grade][unit]) {
                pool = JSON.parse(JSON.stringify(questionData[grade][unit]));
            }
        }

        if (pool.length === 0) {
            alert("無題目資料，請檢查 data_mul.js");
            APP.navTo('lobby');
            return;
        }

        pool.sort(() => Math.random() - 0.5);
		// [新增] 儲存母題庫，供生存模式無限循環使用
        GAME.masterPool = JSON.parse(JSON.stringify(pool));
		// [修正] 區分模式：生存模式全拿，競速模式只拿 5 題
        let takeCount;
        if (APP.state.currentMode === 'survival') {
            takeCount = pool.length; // 生存模式：放入所有題目
        } else {
            takeCount = Math.min(pool.length, GAME.ROUNDS_PER_GAME); // 標準模式：限制 5 題
        }
        
        GAME.questionQueue = pool.slice(0, takeCount);
        
        GAME.totalErrors = 0;
        GAME.startTime = performance.now();
		
		// [新增] 重置血量
        GAME.currentLife = 100;
        const barContainer = document.querySelector('.life-bar-container');
        if(barContainer) barContainer.style.display = 'none'; // 先隱藏，開始才顯示
		
        GAME.lastFrameTime = performance.now();
        GAME.isPaused = false;
        
        APP.navTo('game');
        GAME.nextRound();
        GAME.startGameLoop();
		
		// [修正] 移至此處啟動，確保遊戲開始時只執行一次
        if (APP.state.currentMode === 'survival') {
            GAME.startLifeDrain();
        }
    },

    updateHint: function() {
        const hintEl = document.getElementById('q-hint');
        if (hintEl) {
            if (GAME.correctLeft <= 0) {
                hintEl.innerText = "(完成！)";
                hintEl.style.color = "#00ff00"; 
            } else {
                hintEl.innerText = `(尚需 ${GAME.correctLeft} 個答案)`;
                hintEl.style.color = "#f1c40f"; 
            }
        }
    },

    nextRound: function() {
        // [修正] 題目用完時的處理邏輯
        if (GAME.questionQueue.length === 0) {
            if (APP.state.currentMode === 'survival') {
                // 生存模式：彈匣重填 (Reload)
                // 1. 從母題庫複製一份
                let refill = JSON.parse(JSON.stringify(GAME.masterPool));
                // 2. 重新洗牌
                refill.sort(() => Math.random() - 0.5);
                // 3. 填入佇列
                GAME.questionQueue = refill;
                
                // (可選) 這裡可以播放一個「Next Stage」的音效或特效，目前先保持流暢
            } else {
                // 標準模式：題目做完即結束
                GAME.endGame(true);
                return;
            }
        }

        GAME.currentQ = GAME.questionQueue.shift();
        
        const qTextEl = document.getElementById('q-text');
        if (qTextEl) qTextEl.innerText = GAME.currentQ.question;

        let options = [];
        GAME.correctLeft = 0;
        
        GAME.currentQ.correct.forEach(txt => {
            options.push({ text: txt, type: 1 });
            GAME.correctLeft++;
        });
        
        GAME.updateHint();
        
        if (GAME.currentQ.decoys) {
            GAME.currentQ.decoys.forEach(txt => {
                options.push({ text: txt, type: 0 });
            });
        }

        options.sort(() => Math.random() - 0.5);

        const grid = document.getElementById('game-grid');
        grid.innerHTML = "";
        
        options.forEach(opt => {
            let btn = document.createElement('div');
            btn.className = 'card text-mode';
            
            btn.innerText = opt.text;
            const len = opt.text.length;
            if (len <= 4) btn.style.fontSize = "2rem";
            else if (len <= 8) btn.style.fontSize = "1.5rem";
            else btn.style.fontSize = "1.1rem";

            btn.onclick = () => {
                // 🛑 修正點：檢查 CSS 真正使用的 class (.correct / .wrong)
                if(btn.classList.contains('correct') || btn.classList.contains('wrong')) return;
                
                if (opt.type === 1) {
                    AUDIO.playMatch();
                    // 🛑 修正點：使用 .correct 才能觸發綠色樣式
                    btn.classList.add('correct'); 
                    
                    GAME.correctLeft--;
                    GAME.updateHint();

                    if (GAME.correctLeft <= 0) {
                        // [復原] 生存模式獎勵：完成一題補血 4 點
                        if (APP.state.currentMode === 'survival') {
                            GAME.currentLife = Math.min(100, GAME.currentLife + 4);
                            GAME.updateLifeBar();
                            // 可以增加一個補血音效，或沿用 playFlip
                        }
						AUDIO.playFlip(); 
                        setTimeout(() => GAME.nextRound(), 50);
                    }
                } else {
                    AUDIO.playError();
                    GAME.totalErrors++;                  
                    triggerRedFlash();
					
					// [新增] 生存模式答錯扣血
                    if (APP.state.currentMode === 'survival') {
                        GAME.currentLife -= 8;
                        GAME.updateLifeBar();
                        if (GAME.currentLife <= 0) GAME.endGame(false);
                    } else {
                        // 原本的競速模式懲罰 (扣時間)
                        GAME.startTime -= 1000; 
                    }
                    
                    // 🛑 修正點：使用 .wrong 才能觸發紅色震動
                    btn.classList.add('wrong');
                    setTimeout(() => btn.classList.remove('wrong'), 500);
                }
            };
            grid.appendChild(btn);
        });
    },
    
    abort: function() {
        if (GAME.timerInterval) cancelAnimationFrame(GAME.timerInterval);
        GAME.timerInterval = null; GAME.isPaused = false;
        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('critical-alarm');
    },
    
    pause: function() {
        if (this.isPaused) return; 
        if (this.timerInterval) cancelAnimationFrame(this.timerInterval);
        this.isPaused = true; this.pauseStartTime = performance.now(); 
    },
    
    resume: function() {
        if (!this.isPaused) return;
        const now = performance.now();
        this.startTime += (now - this.pauseStartTime); 
        this.lastFrameTime = now; 
        this.isPaused = false;
        GAME.startGameLoop();
    },

    startGameLoop: function() {
        if (GAME.timerInterval) cancelAnimationFrame(GAME.timerInterval);
        const loop = (timestamp) => {
            if (GAME.isPaused) return;
            const now = performance.now();
            const diff = (now - GAME.startTime) / 1000;
            GAME.lastFrameTime = now;
            
            const timerEl = document.getElementById('timer');
            if(timerEl) timerEl.innerText = diff.toFixed(2);

            GAME.timerInterval = requestAnimationFrame(loop);
        };
        GAME.timerInterval = requestAnimationFrame(loop);
    },
	
	// === 補回：生存模式核心邏輯 ===
    currentLife: 100,
    lifeDrainRate: 2.5, // 每秒扣血量
    
    startLifeDrain: function() {
        if (APP.state.currentMode !== 'survival') return;
        
        // 顯示血條容器
        const barContainer = document.querySelector('.life-bar-container');
        if(barContainer) barContainer.style.display = 'block';

        const loop = () => {
            // [修正] 增加 !GAME.timerInterval 判斷
            // 如果主計時器被 abort 清空了，這個扣血迴圈也要立刻停止
            if (APP.state.currentMode !== 'survival' || GAME.isPaused || GAME.currentLife <= 0 || !GAME.timerInterval) return;
            
            // 隨時間自然扣血
            GAME.currentLife -= (GAME.lifeDrainRate * 0.016); // 約 60fps
            GAME.updateLifeBar();

            if (GAME.currentLife <= 0) {
                GAME.endGame(false); // 死亡
            } else {
                requestAnimationFrame(loop);
            }
        };
        loop();
    },

    updateLifeBar: function() {
        const fill = document.querySelector('.life-bar-fill');
        if (fill) {
            let pct = Math.max(0, GAME.currentLife);
            fill.style.width = pct + "%";
            
            // 血量低於 20% 變色
            if(pct < 20) fill.style.background = "#ff0000";
            else fill.style.background = "#e7240e";
        }
		// [復原] 殘血緊張感：低於 20% 全螢幕閃紅光
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            if (GAME.currentLife > 0 && GAME.currentLife < 20) {
                appContainer.classList.add('critical-alarm');
            } else {
                appContainer.classList.remove('critical-alarm');
            }
        }
    },

    endGame: function(isWin) {
        cancelAnimationFrame(GAME.timerInterval);
		// 🛑 [遺漏] 請務必補上這一行，確保殭屍迴圈防護機制生效
        GAME.timerInterval = null;
        const appContainer = document.getElementById('app-container');
        if(appContainer) appContainer.classList.remove('critical-alarm');
        
        const timerEl = document.getElementById('timer');
        const finalTime = timerEl ? parseFloat(timerEl.innerText) : 0;
        
        if (isWin) AUDIO.playWin(); 

        if (APP.state.currentMode === 'f1') { F1.handleGameEnd(finalTime, GAME.totalErrors); return; }
        if (APP.state.currentMode === 'tournament') { TOUR.handleGameEnd(finalTime, GAME.totalErrors); return; }
        
        const resScore = document.getElementById('res-score');
        const resDetail = document.getElementById('res-detail');
		// 【新增】取得顯示題庫名稱的 DOM
        const resBankTitle = document.getElementById('res-bank-title');

        // [修正] 只要是「勝利」或是「生存模式(必定死亡結束)」，都視為有效成績
        if (isWin || APP.state.currentMode === 'survival') {
            
            if (isWin) AUDIO.playWin(); // 只有真正通關才播勝利音效

            if(resScore) resScore.innerText = finalTime.toFixed(2) + "s";
            
			// 【新增】邏輯：從 APP_DATA 中查找當前 Bank ID 對應的 Title 並顯示
            if (resBankTitle) {
                const currentBank = APP_DATA.banks.find(b => b.id === APP.state.currentBankId);
                resBankTitle.innerText = currentBank ? currentBank.title : "";
            }
			
            // 針對模式顯示不同資訊
            if (APP.state.currentMode === 'survival') {
                if(resDetail) resDetail.innerText = `存活確認 (錯誤：${GAME.totalErrors})`;
            } else {
                if(resDetail) resDetail.innerText = `錯誤次數：${GAME.totalErrors}`;
            }

            APP.saveRecord({ time: finalTime, score: 6, errors: GAME.totalErrors });
            APP.navTo('result');
        } else {
            // 其他異常失敗則退回輸入頁
            APP.navTo('input'); 
        }
    }
};

function triggerRedFlash() {
    const t = document.getElementById('timer');
    if(t) {
        t.classList.remove('timer-penalty');
        void t.offsetWidth; 
        t.classList.add('timer-penalty');
    }
}

window.onload = APP.init;
window.onload = APP.init;