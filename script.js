(function(){
  // Utility constants and regex
  const STUDENT_ID_REGEX = /^\d{2}-\d{4}-\d{6}$/;
  const PHINMA_EMAIL_SUFFIX = "phinmaed.com";

  // Demo student IDs (special permissions)
  const DEMO_IDS = [
    "04-2425-000626",
    "04-2425-000689",
    "04-2425-000617",
    "04-2425-045794",
    "04-2425-030285"
  ];

  // Normalize input
  function normalizeId(id){
    return (id || "").replace(/\s+/g, '').trim();
  }

  // Local DB
  function getDB(){ try { return JSON.parse(localStorage.getItem('ams-ui_students') || '{}'); } catch (e) { return {}; } }
  function saveDB(db){ localStorage.setItem('ams-ui_students', JSON.stringify(db)); }

  // Room attendance
  function getAttendanceStore(){ try { return JSON.parse(localStorage.getItem('ams-ui_roomAttendance') || '{}'); } catch (e) { return {}; } }
  function saveAttendanceStore(store){ localStorage.setItem('ams-ui_roomAttendance', JSON.stringify(store)); }

  // Room lock state (object keyed by room id)
  // Value shape: { ownerId: '04-...', lockAt: timestamp } 
  // Semantics: setting a timer creates a lockAt timestamp in the future; before lockAt, room is open.
  // After lockAt passes, the room is considered locked to non-owners and will remain locked until the owner leaves.
  function getRoomLocks(){ try { return JSON.parse(localStorage.getItem('ams-ui_roomLocks') || '{}'); } catch (e) { return {}; } }
  function saveRoomLocks(locks){ localStorage.setItem('ams-ui_roomLocks', JSON.stringify(locks)); }

  // Demo data
  function ensureDemoData(){
    let db = getDB();
    if(Object.keys(db).length === 0){
      const samples = [
        { fullName:'James Darrell D. Saquilon', studentId:'04-2425-000626', age:19, section:'Redacted', course:'BSIT', email:'jado.saquilon.ui@phinmaed.com', phone:'Redacted' },
        { fullName:'Ken Lester C. Sitjar', studentId:'04-2425-000689', age:20, section:'Redacted', course:'BSIT', email:'keco.sitjar.ui@phinmaed.com', phone:'Redacted' },
        { fullName:'Shanice Gabanes', studentId:'04-2425-000617', age:20, section:'Redacted', course:'BSIT', email:'jshja.gabanes.ui@phinmaed.com', phone:'Redacted' },
        { fullName:'Hanna Jean C. Calawigan', studentId:'04-2425-045794', age:20, section:'Redacted', course:'BSIT', email:'haca.cabaya.ui@phinmaed.com', phone:'Redacted' },
        { fullName:'Lean Raven Nuñez', studentId:'04-2425-030285', age:20, section:'Redacted', course:'BSIT', email:'letr.nunez.ui@phinmaed.com', phone:'Redacted' }
      ];
      samples.forEach(s => db[s.studentId] = s);
      saveDB(db);
    }
  }
  ensureDemoData();

  // Rooms
  const ROOMS = [
    { id: 'ml-301', title:'ML 301', meta:'ML Building, 3rd Floor', allowedCourse: null},
    { id: 'cl-001', title:'CL 001', meta:'CL Building, 3rd Floor', allowedCourse: null},
    { id: 'cl-003', title:'CL 003', meta:'CL Building, 3rd Floor', allowedCourse: null},
    { id: 'el-409', title:'EL 409', meta:'EL Building, 3rd Floor', allowedCourse: null},
    { id: 'cl-005', title:'CL 005', meta:'CL Building, 3rd Floor', allowedCourse: null},
    { id: 'ab 302', title:'AB 302', meta:'AB Building, 3rd Floor', allowedCourse: null},
    { id: 'GYM', title:'GYM/P-VILLA', meta:'TOP Building, 3rd Floor', allowedCourse: null},
    { id: 'ab 303', title:'AB 303', meta:'AB Building, 3rd Floor', allowedCourse: null},
    { id: 'cl 006', title:'CL 006', meta:'CL Building, 3rd Floor', allowedCourse: null},
  ];

  // Attendance store
  let roomAttendance = getAttendanceStore();
  let currentUser = null;
  let currentRoom = null;
  let roomLocks = getRoomLocks();
  let timerInterval = null; // for countdown UI updates

  // Elements
  const authSection = document.getElementById('authSection');
  const dashSection = document.getElementById('dashSection');
  const loginForm = document.getElementById('loginForm');
  const loginId = document.getElementById('loginId');
  const loginMsg = document.getElementById('loginMsg');
  const toRegisterBtn = document.getElementById('toRegister');
  const registerCard = document.getElementById('registerCard');
  const registerForm = document.getElementById('registerForm');
  const regMsg = document.getElementById('regMsg');
  const cancelRegister = document.getElementById('cancelRegister');
  const avatarLetters = document.getElementById('avatarLetters');
  const dashFullName = document.getElementById('dashFullName');
  const dashStudentId = document.getElementById('dashStudentId');
  const settingsBtn = document.getElementById('settingsBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const roomsList = document.getElementById('roomsList');
  const roomSearch = document.getElementById('roomSearch');
  const searchBtn = document.getElementById('searchBtn');
  const joinedRoomCard = document.getElementById('joinedRoomCard');
  const joinedRoomTitle = document.getElementById('joinedRoomTitle');
  const joinedRoomMeta = document.getElementById('joinedRoomMeta');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');
  const settingsModal = document.getElementById('settingsModal');
  const settingsForm = document.getElementById('settingsForm');
  const closeSettings = document.getElementById('closeSettings');
  const settingsMsg = document.getElementById('settingsMsg');
  const confirmModal = document.getElementById('confirmModal');
  const confirmCheck = document.getElementById('confirmCheck');
  const proceedDownload = document.getElementById('proceedDownload');
  const cancelDownload = document.getElementById('cancelDownload');
  const chatArea = document.querySelector('.chat-area');

  // ✅ Initial UI state
  authSection.style.display = 'block';    // show login section
  registerCard.style.display = 'none';    // hide register
  dashSection.style.display = 'none';     // hide dashboard
  joinedRoomCard.style.display = 'none';

// Join room
function joinRoom(room) {
  currentRoom = room;

  // update joined room UI
  joinedRoomTitle.textContent = room.title;
  joinedRoomMeta.textContent = room.meta || "Section / Course";

  // 👇 show the joined card only when a room is joined
  joinedRoomCard.style.display = "block";

  systemNotify(currentUser.fullName + " joined " + room.title);

  // start attendance timer or any other logic you already have
  startTimer();
}

  // Show Register, hide Login
  toRegisterBtn.addEventListener('click', ()=> { 
  loginForm.style.display = 'none';        
  registerCard.style.display = 'block';    
  });

  cancelRegister.addEventListener('click', ()=> { 
  registerCard.style.display = 'none';     
  loginForm.style.display = 'block';       
  });

  // Create Room Timer button (we'll insert near the leave button)
  const roomTimerBtn = document.createElement('button');
  roomTimerBtn.id = "roomTimerBtn";
  roomTimerBtn.textContent = "Timer";
  roomTimerBtn.style.display = "none";
  roomTimerBtn.className = "btn";
  roomTimerBtn.style.marginLeft = "1px"; // spacing next to leave button

  // Timer display element (visible countdown / locked text)
  const roomTimerDisplay = document.createElement('div');
  roomTimerDisplay.id = "roomTimerDisplay";
  roomTimerDisplay.style.marginTop = "8px";
  roomTimerDisplay.style.fontSize = "13px";
  roomTimerDisplay.style.color = "#c53030";
  roomTimerDisplay.textContent = "";
  // We'll append this to joinedRoomCard's body area
  joinedRoomCard?.appendChild(roomTimerDisplay);

  // Try to put the Timer button beside Leave button (best effort)
  (function insertTimerBtnNextToLeave(){
    try {
      if(saveAttendanceBtn && saveAttendanceBtn.parentNode){
        // Insert before Save Attendance (so it typically ends up between Leave and Save)
        saveAttendanceBtn.parentNode.insertBefore(roomTimerBtn, saveAttendanceBtn);
      } else if(leaveRoomBtn && leaveRoomBtn.parentNode){
        // fallback: insert after Leave
        leaveRoomBtn.parentNode.insertBefore(roomTimerBtn, leaveRoomBtn.nextSibling);
      } else if(joinedRoomCard) {
        joinedRoomCard.appendChild(roomTimerBtn);
      }
    } catch (err){
      if(joinedRoomCard) joinedRoomCard.appendChild(roomTimerBtn);
    }
  })();

  // Helpers
  function showMessage(el, text, isError=false, timeout=4000){
    if(!el) return;
    el.textContent = text;
    el.classList.toggle('error', isError);
    el.classList.toggle('success', !isError && text !== '');
    if(timeout){
      setTimeout(()=>{ if(el) { el.textContent = ''; el.classList.remove('error','success'); } }, timeout);
    }
  }

  function validStudentIdFormat(id){ return STUDENT_ID_REGEX.test(normalizeId(id)); }
  function validPhinmaEmail(email){
    if(!email) return false;
    return email.toLowerCase().endsWith('@' + PHINMA_EMAIL_SUFFIX) ||
           (email.toLowerCase().endsWith('.' + PHINMA_EMAIL_SUFFIX) && email.toLowerCase().includes('@'));
  }

  function initialsFromName(name){
    if(!name) return 'S';
    const words = name.trim().split(' ');
    return (words[0]?.charAt(0) || 'S') + (words[1]?.charAt(0) || '');
  }

  // 🔔 Notification
  function systemNotify(msg){
    if(!chatArea) return;
    const p = document.createElement('p');
    p.textContent = msg;
    p.style.fontSize = '13px';
    p.style.color = '#2b6cb0';
    p.style.margin = '6px 0 0 0';
    chatArea.appendChild(p);
    chatArea.scrollTop = chatArea.scrollHeight;
    setTimeout(()=>{ if(p.parentNode){ p.remove(); } }, 5000);
  }

  // Storage event sync (multi-tab notifications)
  window.addEventListener('storage', function(e){
    if(e.key === 'ams-ui_roomAttendance'){
      let newStore;
      try { newStore = JSON.parse(e.newValue || '{}'); } catch (err) { newStore = {}; }

      if(currentRoom){
        const rid = currentRoom.id;
        const prevArr = roomAttendance[rid] || [];
        const newArr = newStore[rid] || [];

        const added = newArr.filter(id => !prevArr.includes(id));
        const removed = prevArr.filter(id => !newArr.includes(id));

        const db = getDB();
        added.forEach(id => { const s = db[id]; const name = s ? s.fullName : id; systemNotify(name + ' joined the room.'); });
        removed.forEach(id => { const s = db[id]; const name = s ? s.fullName : id; systemNotify(name + ' left the room.'); });
      }

      roomAttendance = newStore;
      return;
    }

    // Room locks change
    if(e.key === 'ams-ui_roomLocks'){
      try { roomLocks = JSON.parse(e.newValue || '{}'); } catch(err){ roomLocks = {}; }
      // Update timer UI if current room affected
      updateTimerUI();
      return;
    }
  });

  // Cleanup user from room on unload (exit/refresh)
  window.addEventListener("beforeunload", () => {
    if(currentUser && currentRoom){
      // remove them from current room attendance
      const arr = roomAttendance[currentRoom.id] || [];
      const idx = arr.indexOf(currentUser.studentId);
      if(idx !== -1){
        arr.splice(idx,1);
        roomAttendance[currentRoom.id] = arr;
        saveAttendanceStore(roomAttendance);
      }
      // If demo user and owner, remove lock for that room (owner leaving unlocks)
      if(DEMO_IDS.includes(currentUser.studentId)){
        if(roomLocks[currentRoom.id]){
          delete roomLocks[currentRoom.id];
          saveRoomLocks(roomLocks);
        }
      }
    }
  });

  // LOGIN
  loginForm.addEventListener('submit', function(e){
    e.preventDefault();
    const id = normalizeId(loginId.value);
    if(!validStudentIdFormat(id)){ showMessage(loginMsg, 'invalid format', true); return; }
    const db = getDB();
    if(!db[id]){ showMessage(loginMsg, 'invalid in database please register this id', true); return; }
    currentUser = db[id];
    showDashboard();
  });

  toRegisterBtn.addEventListener('click', ()=> { registerCard.style.display = 'block'; registerCard.scrollIntoView({behavior:'smooth'}); });
  cancelRegister.addEventListener('click', ()=> { registerCard.style.display = 'none'; });

  // REGISTER
  registerForm.addEventListener('submit', function(e){
    e.preventDefault();
    const fullName = document.getElementById('fullName').value.trim();
    const studentId = normalizeId(document.getElementById('regStudentId').value);
    const age = document.getElementById('age').value.trim();
    const section = document.getElementById('section').value.trim();
    const course = document.getElementById('course').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();

    if(!validStudentIdFormat(studentId)){ showMessage(regMsg, 'invalid student id format', true); return; }
    if(!validPhinmaEmail(email)){ showMessage(regMsg, 'email must be a PHINMAED email', true); return; }
    const db = getDB();
    if(db[studentId]){ showMessage(regMsg, 'this student id is already registered', true); return; }

    db[studentId] = { fullName, studentId, age, section, course, email, phone };
    saveDB(db);
    showMessage(regMsg, 'registered successfully', false, 3000);
    setTimeout(()=> { registerCard.style.display = 'none'; document.getElementById('registerForm').reset(); loginId.value = studentId; }, 900);
  });

  // SETTINGS
  settingsBtn.addEventListener('click', ()=> {
    settingsModal.style.display = 'flex';
    document.getElementById('set_fullName').value = currentUser.fullName;
    document.getElementById('set_studentId').value = currentUser.studentId;
    document.getElementById('set_age').value = currentUser.age;
    document.getElementById('set_section').value = currentUser.section;
    document.getElementById('set_course').value = currentUser.course;
    document.getElementById('set_email').value = currentUser.email;
    document.getElementById('set_phone').value = currentUser.phone;
  });
  closeSettings.addEventListener('click', ()=>{ settingsModal.style.display='none'; });

  settingsForm.addEventListener('submit', function(e){
    e.preventDefault();
    const fullName = document.getElementById('set_fullName').value.trim();
    const studentId = normalizeId(document.getElementById('set_studentId').value);
    const age = document.getElementById('set_age').value.trim();
    const section = document.getElementById('set_section').value.trim();
    const course = document.getElementById('set_course').value.trim();
    const email = document.getElementById('set_email').value.trim();
    const phone = document.getElementById('set_phone').value.trim();

    if(!validStudentIdFormat(studentId)){ showMessage(settingsMsg, 'invalid student id format', true); return; }
    if(!validPhinmaEmail(email)){ showMessage(settingsMsg, 'email must be PHINMAED email', true); return; }

    const db = getDB();
    if(studentId !== currentUser.studentId && db[studentId]){ showMessage(settingsMsg, 'another record already uses this student id', true); return; }

    delete db[currentUser.studentId];
    const updated = { fullName, studentId, age, section, course, email, phone };
    db[studentId] = updated;
    saveDB(db);

    currentUser = updated;
    renderProfile();
    showMessage(settingsMsg,'saved',false,2000);
    setTimeout(()=>{ settingsModal.style.display='none'; settingsMsg.textContent=''; }, 900);
  });

  // LOGOUT
  logoutBtn.addEventListener('click', function(){
    // if demo id and currently owns a lock in this room, remove lock
    if(currentUser && currentRoom && DEMO_IDS.includes(currentUser.studentId)){
      if(roomLocks[currentRoom.id]){
        delete roomLocks[currentRoom.id];
        saveRoomLocks(roomLocks);
      }
    }

    // remove from room attendance (logout should remove from room)
    if(currentUser && currentRoom){
      const arr = roomAttendance[currentRoom.id] || [];
      const idx = arr.indexOf(currentUser.studentId);
      if(idx !== -1){
        arr.splice(idx,1);
        roomAttendance[currentRoom.id] = arr;
        saveAttendanceStore(roomAttendance);
        systemNotify(currentUser.fullName + " left " + currentRoom.title);
      }
    }

    currentUser = null;
    currentRoom = null;
    dashSection.style.display = 'none';
    authSection.style.display = 'block';
    loginId.value = '';

    // update UI timers/display
    clearTimerInterval();
    updateTimerUI();
  });

  // Render rooms
  function renderRooms(list){
    roomsList.innerHTML = '';
    const search = (roomSearch.value || '').trim().toLowerCase();

    const filtered = list.filter(r => !search || r.title.toLowerCase().includes(search) || r.meta.toLowerCase().includes(search));

    if(filtered.length === 0){
      const msg = document.createElement('div');
      msg.textContent = "Room does not exist.";
      msg.style.color = "red";
      roomsList.appendChild(msg);
      return;
    }

    filtered.forEach(room => {
      const div = document.createElement('div');
      div.className = 'room';
      div.innerHTML = `
        <div class="title">${room.title}</div>
        <div class="meta">${room.meta}</div>
        <div class="actions">
          <button class="btn joinBtn">Join</button>
        </div>
      `;
      div.querySelector('.joinBtn').addEventListener('click', ()=> joinRoom(room));
      roomsList.appendChild(div);
    });
  }

  // Search = filter only
  roomSearch.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); renderRooms(ROOMS); } });
  searchBtn.addEventListener('click', ()=> renderRooms(ROOMS));

  // JOIN ROOM (handles auto-leave previous room)
  function joinRoom(room){
    if(!currentUser){ alert('Please login first.'); return; }

    // check locks: if lockAt passed or locked (we treat lockAt <= now as locked for non-owner)
    const lock = roomLocks[room.id];
    if(lock){
      const now = Date.now();
      const isEffectivelyLocked = (lock.lockAt && now >= lock.lockAt);
      // if it's already locked for non-owner, deny join
      if(isEffectivelyLocked && currentUser.studentId !== lock.ownerId){
        alert("This room is locked. You cannot join right now.");
        return;
      }
    }

    // If switching rooms, remove from previous room attendance automatically
    if(currentRoom && currentRoom.id !== room.id){
      const prevArr = roomAttendance[currentRoom.id] || [];
      const idx = prevArr.indexOf(currentUser.studentId);
      if(idx !== -1){
        prevArr.splice(idx,1);
        roomAttendance[currentRoom.id] = prevArr;
        saveAttendanceStore(roomAttendance);
        systemNotify(currentUser.fullName + " left " + currentRoom.title);
      }
    }

    currentRoom = room;
    joinedRoomTitle.textContent = room.title;
    joinedRoomMeta.textContent = room.meta;
    joinedRoomCard.style.display = 'block';
    joinedRoomCard.scrollIntoView({behavior:'smooth'});

    if(!roomAttendance[room.id]) roomAttendance[room.id] = [];
    if(!roomAttendance[room.id].includes(currentUser.studentId)){
      roomAttendance[room.id].push(currentUser.studentId);
      saveAttendanceStore(roomAttendance);
      systemNotify(currentUser.fullName + " joined " + room.title);
    }

    // show/hide Save Attendance and Room Timer for demo IDs
    if(currentUser && DEMO_IDS.includes(currentUser.studentId)){
      saveAttendanceBtn.style.display = "inline-block";
      roomTimerBtn.style.display = "inline-block";
    } else {
      saveAttendanceBtn.style.display = "none";
      roomTimerBtn.style.display = "none";
    }

    // update timer display for this room (if timer has been set)
    updateTimerUI();
    scheduleExpirationCheck();
  }

  // Leave room
  leaveRoomBtn.addEventListener('click', function(){
    joinedRoomCard.style.display = "none";
    if(!currentRoom || !currentUser) return;
    const arr = roomAttendance[currentRoom.id] || [];
    const idx = arr.indexOf(currentUser.studentId);
    if(idx !== -1){
      arr.splice(idx,1);
      roomAttendance[currentRoom.id] = arr;
      saveAttendanceStore(roomAttendance);
      systemNotify(currentUser.fullName + " left " + currentRoom.title);
    }

    // If leaving user is demo owner, clear lock for the room
    if(DEMO_IDS.includes(currentUser.studentId) && roomLocks[currentRoom.id]){
      delete roomLocks[currentRoom.id];
      saveRoomLocks(roomLocks);
      systemNotify("Room lock removed as owner left.");
    }

    currentRoom = null;
    joinedRoomCard.style.display = 'none';

    // clear timer UI/interval for this tab
    clearTimerInterval();
    updateTimerUI();
  });

  // SAVE ATTENDANCE
  saveAttendanceBtn.addEventListener('click', function(){
    if(!currentRoom){ alert('Join a room first.'); return; }

    // permission: only demo ids can save
    if(!currentUser || !DEMO_IDS.includes(currentUser.studentId)){
      return alert('You do not have permission to save attendance.');
    }

    confirmModal.style.display = 'flex';
    confirmCheck.checked = false;
    proceedDownload.disabled = true;
  });

  cancelDownload.addEventListener('click', function(){ confirmModal.style.display = 'none'; });
  confirmCheck.addEventListener('change', function(){ proceedDownload.disabled = !confirmCheck.checked; });

  // PDF Export
  proceedDownload.addEventListener('click', async function(){
    if(!currentRoom){
      alert('No room joined.');
      return;
    }

    // only demo ids allowed to export
    if(!currentUser || !DEMO_IDS.includes(currentUser.studentId)){
      alert('You do not have permission to save attendance.');
      confirmModal.style.display = 'none';
      return;
    }

    const db = getDB();
    let students = (roomAttendance[currentRoom.id] || [])
      .map(id => db[id])
      .filter(Boolean);

    if(students.length === 0){
      alert("No students joined this room yet.");
      confirmModal.style.display = 'none';
      return;
    }

    // Sort alphabetically by surname, then first name
    function sortNameKey(fn){
      const parts = fn.split(',');
      const surname = (parts[0] || '').trim().toLowerCase();
      const rest = (parts[1] || '').trim().toLowerCase();
      const restParts = rest.split(' ').filter(Boolean);
      const first = restParts[0] || '';
      const middle = restParts.slice(1).join(' ') || '';
      return [surname, first, middle];
    }
    students.sort((a,b) => {
      const A = sortNameKey(a.fullName);
      const B = sortNameKey(b.fullName);
      for(let i=0;i<3;i++){
        if(A[i] < B[i]) return -1;
        if(A[i] > B[i]) return 1;
      }
      return 0;
    });

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });

      const margin = 40;
      let y = margin;
      const lineHeight = 16;

      // Header
      doc.setFontSize(14);
      doc.text('Attendance List', margin, y); y += 20;
      doc.setFontSize(11);
      doc.text('Room: ' + currentRoom.title + ' — ' + currentRoom.meta, margin, y); y += 16;
      doc.text('Generated by A.M.S - UI', margin, y); y += 16;
      const today = new Date();
      const formattedDate = today.getFullYear() + "-" +
                String(today.getMonth() + 1).padStart(2, '0') + "-" +
                String(today.getDate()).padStart(2, '0');

      // format time (hh:mm AM/PM)
      let hours = today.getHours();
      let minutes = String(today.getMinutes()).padStart(2, '0');
      let ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 => 12
      const formattedTime = hours + ":" + minutes + " " + ampm;

      doc.text('Date: ' + formattedDate, margin, y);
      y += 18;
      doc.text('Downloaded Time: ' + formattedTime, margin, y)
      y += 24;

      // Table header
      doc.setFontSize(10);
      doc.text('No.', margin, y);
      doc.text('Student ID', margin + 50, y);
      doc.text('Full name', margin + 190, y);
      doc.text('Section & Course', margin + 420, y);
      y += 6;
      doc.setLineWidth(0.5);
      doc.line(margin, y, 550, y);
      y += 12;

      // List of demo student IDs (the ones you want redacted)
      const demoIds = DEMO_IDS.slice();

      // Table entries
      students.forEach((s, idx) => {
        if (y > 740) { // new page
          doc.addPage();
          y = margin;
        }

        // Numbering starts at 0
        doc.text(String(idx), margin, y);

        // Check if student is in demo list
        if (demoIds.includes(s.studentId)) {
          // Redact all sensitive info
          doc.text("REDACTED", margin + 50, y); // ID
          doc.text(s.fullName || "REDACTED", margin + 190, y, { maxWidth: 220 }); // keep name
          doc.text("REDACTED", margin + 420, y); // Section + Course
        } else {
          // Show normal student data
          doc.text(s.studentId, margin + 50, y);
          doc.text(s.fullName || "-", margin + 190, y, { maxWidth: 220 });
          const secCourse = (s.section || '-') + " / " + (s.course || '-');
          doc.text(secCourse.trim(), margin + 420, y);
        }

        y += lineHeight;
      });

      // ✅ Finish PDF generation
      const filename = currentRoom.id + '_attendance_' + 
        (new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-') + '.pdf';
      doc.save(filename);

      confirmModal.style.display = 'none';
      alert('PDF downloaded: ' + filename);
    } catch (err) {
      console.error(err);
      alert('Failed to create PDF. Make sure jsPDF is loaded.');
    }
  }); // ✅ closes proceedDownload.addEventListener

  // DASHBOARD
  function showDashboard(){
  authSection.style.display = 'none';
  dashSection.style.display = 'block';
  renderProfile();
  renderRooms(ROOMS);

  // Hide joined card unless user is already in a room
  if (!currentRoom) {
    joinedRoomCard.style.display = 'none';
  }

  // Restrict Save Attendance and Room Timer visibility
  if(currentUser && DEMO_IDS.includes(currentUser.studentId) && currentRoom && currentRoom.id){
    saveAttendanceBtn.style.display = "inline-block";
    roomTimerBtn.style.display = "inline-block";
  } else {
    saveAttendanceBtn.style.display = "none";
    roomTimerBtn.style.display = "none";
  }

    updateTimerUI();
    scheduleExpirationCheck();
  }

  function renderProfile(){
    dashFullName.textContent = currentUser.fullName;
    dashStudentId.textContent = currentUser.studentId;
    avatarLetters.textContent = initialsFromName(currentUser.fullName);
  }

  // Room Timer Feature
  roomTimerBtn.addEventListener("click", () => {
    if(!currentRoom || !currentUser) return;

    if(!DEMO_IDS.includes(currentUser.studentId)){
      return alert('You do not have permission to set a room timer.');
    }

    const mins = prompt("Set room timer (any minutes):");
    const valid = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];
    const dur = parseInt(mins,10);
    if(!valid.includes(dur) || isNaN(dur)) return alert("Invalid time.");

    // New semantics: lockAt is in the future. Room remains open UNTIL lockAt.
    const lockAt = Date.now() + dur * 60000;
    roomLocks[currentRoom.id] = {
      ownerId: currentUser.studentId,
      lockAt: lockAt
    };
    saveRoomLocks(roomLocks);

    systemNotify(`Room will lock in ${dur} minute(s). Owner: ${currentUser.fullName}`);
    updateTimerUI();
    scheduleExpirationCheck();
  });

  // Timer display & management helpers
  function updateTimerUI(){
    if(!currentRoom){
      roomTimerDisplay.textContent = "";
      return;
    }
    const lock = roomLocks[currentRoom.id];
    if(!lock){
      roomTimerDisplay.textContent = "";
      // control button visibility
      if(currentUser && DEMO_IDS.includes(currentUser.studentId)){
        roomTimerBtn.style.display = "inline-block";
        saveAttendanceBtn.style.display = "inline-block";
      } else {
        roomTimerBtn.style.display = "none";
        saveAttendanceBtn.style.display = "none";
      }
      return;
    }

    const now = Date.now();
    if(lock.lockAt && lock.lockAt > now){
      const remMs = lock.lockAt - now;
      roomTimerDisplay.textContent = redactIDs(`Room will lock in ${formatRemaining(remMs)} (owner: ${lock.ownerId})`);
    } else {
      // lockAt passed -> room is effectively locked for non-owner
      roomTimerDisplay.textContent = redactIDs(`Room is locked (timer ended). Remains locked until owner (${lock.ownerId}) leaves.`);
    }

    // show Timer button only to owner
    if(currentUser && currentUser.studentId === lock.ownerId && DEMO_IDS.includes(currentUser.studentId)){
      roomTimerBtn.style.display = "inline-block";
      saveAttendanceBtn.style.display = "inline-block";
    } else {
      roomTimerBtn.style.display = "none";
      // saveAttendance still only for demo IDs
      if(currentUser && DEMO_IDS.includes(currentUser.studentId)){
        saveAttendanceBtn.style.display = "inline-block";
      } else {
        saveAttendanceBtn.style.display = "none";
      }
    }
  }

  function formatRemaining(ms){
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s}s`;
  }

  function redactIDs(text) {
  return text.replace(/\d{2}-\d{4}-\d{6}/g, "REDACTED");
}


  function scheduleExpirationCheck(){
    // Clear prev interval
    clearTimerInterval();

    if(!currentRoom) return;
    const lock = roomLocks[currentRoom.id];
    if(!lock || !lock.lockAt) return;

    // Update UI every second
    timerInterval = setInterval(() => {
      updateTimerUI();
      const lockNow = roomLocks[currentRoom.id];
      // If lock was removed elsewhere, stop interval
      if(!lockNow || !lockNow.lockAt){ clearTimerInterval(); }
    }, 1000);
  }

  function clearTimerInterval(){
    if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  // Press enter to login
  loginId.addEventListener('keydown', function(e){ 
    if(e.key === 'Enter'){ 
      e.preventDefault(); 
      loginForm.dispatchEvent(new Event('submit')); 
    } 
  });

  // Close modals on overlay click
  [settingsModal, confirmModal].forEach(mod => {
    mod.addEventListener('click', function(e){ 
      if(e.target === mod){ mod.style.display = 'none'; } 
    });
  });

  // Render initial rooms
  renderRooms(ROOMS);

  // Helper: remove user from a room (used by unload and cross-room join)
  function removeUserFromRoom(userId, roomId){
    if(!roomId) return;
    if(!roomAttendance[roomId]) return;
    const arr = roomAttendance[roomId];
    const idx = arr.indexOf(userId);
    if(idx !== -1){
      arr.splice(idx,1);
      roomAttendance[roomId] = arr;
      saveAttendanceStore(roomAttendance);
      const db = getDB();
      const s = db[userId];
      const name = s ? s.fullName : userId;
      systemNotify(name + ' left the room.');
    }
  }

  // Expose for debugging (optional)
  window._ams = window._ams || {};
  window._ams.getAttendance = () => JSON.parse(JSON.stringify(roomAttendance));
  window._ams.getLocks = () => JSON.parse(JSON.stringify(roomLocks));
  window._ams.getDB = () => JSON.parse(JSON.stringify(getDB())); 


})();




