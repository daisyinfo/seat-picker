// ===== STATE =====
let students = [];
let grid = [];
let rows = 5, cols = 6;
let excludePairs = [];
let pinnedSeats = []; 
let dragData = null;
let confirmCallback = null;
let disabledCells = new Set();
let altPressed = false;
let isPairMode = true;

window.addEventListener('keydown', e => { if (e.key === 'Alt') altPressed = true; });
window.addEventListener('keyup', e => { if (e.key === 'Alt') altPressed = false; });

document.getElementById('pairModeToggle').addEventListener('change', (e) => {
  isPairMode = e.target.checked;
  renderGrid();
});

// ===== HELPERS =====
function uid() { return '_' + Math.random().toString(36).substr(2, 9); }

function showConfirm(msg, cb) {
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmModal').style.display = 'flex';
  confirmCallback = cb;
}

document.getElementById('confirmYes').onclick = () => {
  document.getElementById('confirmModal').style.display = 'none';
  if (confirmCallback) confirmCallback();
};
document.getElementById('confirmNo').onclick = () => {
  document.getElementById('confirmModal').style.display = 'none';
};

// 🌟 스택형 + 중요 알림 시스템
function showToast(msg, isImportant = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  toast.className = `toast ${isImportant ? 'important' : ''}`;
  
  const removeToast = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };

  if (isImportant) {
    toast.innerHTML = `
      <span>${msg}</span>
      <div class="toast-close" title="닫기">✕</div>
    `;
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = removeToast;
  } else {
    toast.innerHTML = `<span>${msg}</span>`;
  }

  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);

  // 중요 알림이 아닐 때만 2.5초 후 자동 삭제
  if (!isImportant) {
    setTimeout(removeToast, 2500);
  }
}

// ===== GRID =====
function initGrid() {
  rows = parseInt(document.getElementById('rowsInput').value) || 5;
  cols = parseInt(document.getElementById('colsInput').value) || 6;
  grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) grid[r][c] = null;
  }
  disabledCells = new Set();
  pinnedSeats = pinnedSeats.filter(p => p.row < rows && p.col < cols);
  renderGrid();
  placeUnassignedToPool();
}
document.getElementById('applyGridBtn').onclick = initGrid;

function renderGrid() {
  const container = document.getElementById('seatGrid');
  container.innerHTML = '';
  
  for (let r = 0; r < rows; r++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = isPairMode ? 'flex justify-center gap-4 w-full flex-1' : 'flex justify-center gap-8 w-full flex-1';
    rowDiv.style.maxHeight = '140px'; 

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell flex items-center justify-center';
      cell.dataset.row = r;
      cell.dataset.col = c;

      if (isPairMode && (cols - c) % 2 === 0 && c !== 0) {
        cell.style.marginLeft = 'clamp(16px, 3vw, 40px)'; 
      }

      const seatNum = (rows - 1 - r) * cols + (cols - 1 - c) + 1;

      // 🟢 번호는 기본적으로 생성 (취소선 효과를 위해 결번도 포함)
      if (!grid[r][c]) {
           const numSpan = document.createElement('span');
           numSpan.className = 'seat-number';
           numSpan.textContent = seatNum;
           cell.appendChild(numSpan);
      }

      // 🟢 렌더링 시 인라인 스타일 제거, 클래스로 제어
      if (disabledCells.has(`${r},${c}`)) {
        cell.classList.add('disabled'); // 🌟 CSS 클래스 추가
        cell.title = '결번 (클릭하여 활성화)';
      } else {
        cell.title = '클릭하여 결번 처리';
      }

      const sid = grid[r][c];
      if (sid && !disabledCells.has(`${r},${c}`)) {
        const s = students.find(x => x.id === sid);
        if (s) {
          cell.classList.add('has-student');
          cell.appendChild(makeCard(s, true, r, c));
        }
      }

      cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        handleDrop(r, c);
      });
      cell.addEventListener('click', e => {
        // 학생 카드가 있는 곳은 무시
        if (cell.classList.contains('has-student')) return;
        
        const key = `${r},${c}`;
        if (disabledCells.has(key)) disabledCells.delete(key);
        else disabledCells.add(key);
        renderGrid();
      });

      rowDiv.appendChild(cell);
    }
    container.appendChild(rowDiv);
  }
  if (window.lucide) lucide.createIcons();
}

function makeCard(student, inGrid = false, r = null, c = null) {
  const card = document.createElement('div');
  card.className = 'student-card pop-in';
  card.draggable = true;
  card.dataset.id = student.id;
  card.textContent = student.name;

  const actionBtn = document.createElement('div');
  
  if (inGrid) {
    actionBtn.className = 'return-student';
    actionBtn.innerHTML = '↺';
    actionBtn.title = '미배치 풀로 내리기';
    actionBtn.onclick = (e) => {
      e.stopPropagation();
      grid[r][c] = null;
      pinnedSeats = pinnedSeats.filter(p => p.studentId !== student.id);
      renderGrid();
      renderPool();
      showToast(`${student.name} 학생이 미배치로 돌아갔습니다.`);
    };
  } else {
    actionBtn.className = 'delete-student';
    actionBtn.innerHTML = '✕';
    actionBtn.title = '학생 영구 삭제';
    actionBtn.onclick = (e) => {
      e.stopPropagation();
      removeStudent(student.id);
    };
  }
  card.appendChild(actionBtn);

  if (inGrid) {
    const pinBtn = document.createElement('div');
    const isPinned = pinnedSeats.some(p => p.studentId === student.id);
    
    pinBtn.className = `pin-student ${isPinned ? 'is-pinned' : ''}`;
    pinBtn.innerHTML = '📌';
    pinBtn.title = isPinned ? '자리 고정 해제' : '현재 자리 고정';
    
    pinBtn.onclick = (e) => {
      e.stopPropagation();
      if (isPinned) {
        pinnedSeats = pinnedSeats.filter(p => p.studentId !== student.id);
        showToast(`${student.name} 자리 고정 해제`);
      } else {
        pinnedSeats = pinnedSeats.filter(p => p.studentId !== student.id);
        pinnedSeats.push({ studentId: student.id, row: r, col: c });
        showToast(`${student.name} 자리 고정됨`);
      }
      renderGrid();
    };
    card.appendChild(pinBtn);
  }

  card.addEventListener('dragstart', e => {
    dragData = { studentId: student.id, from: inGrid ? 'grid' : 'pool' };
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => card.style.opacity = '0.4', 0);
  });
  card.addEventListener('dragend', () => { card.style.opacity = '1'; dragData = null; });

  return card;
}

// ===== POOL =====
function renderPool() {
  const pool = document.getElementById('studentPool');
  pool.innerHTML = '';
  const unassigned = students.filter(s => !isAssigned(s.id));
  unassigned.forEach(s => {
    const wrap = document.createElement('div');
    wrap.style.width = '88px'; 
    wrap.style.height = '56px';
    wrap.appendChild(makeCard(s, false));
    pool.appendChild(wrap);
  });
  document.getElementById('poolCount').textContent = unassigned.length;
  updateDropdowns();
}

function isAssigned(id) {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] === id) return true;
  return false;
}

function placeUnassignedToPool() {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] && !students.find(s => s.id === grid[r][c])) {
         grid[r][c] = null;
         pinnedSeats = pinnedSeats.filter(p => p.row !== r || p.col !== c);
      }
  renderPool();
  renderGrid();
}

// ===== DRAG & DROP =====
function handleDrop(r, c) {
  if (!dragData) return;
  if (disabledCells.has(`${r},${c}`)) return showToast('결번 자리입니다.');
  
  const sid = dragData.studentId;
  const targetId = grid[r][c]; 
  
  let srcR = -1, srcC = -1;
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (grid[rr][cc] === sid) {
        srcR = rr; srcC = cc;
      }
    }
  }
  
  grid[r][c] = sid;
  
  if (srcR !== -1) {
    grid[srcR][srcC] = targetId; 
  }
  
  pinnedSeats = pinnedSeats.filter(p => p.studentId !== sid && p.studentId !== targetId);
  renderGrid();
  renderPool();
}

document.getElementById('studentPool').addEventListener('dragover', e => {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over-pool');
});
document.getElementById('studentPool').addEventListener('dragleave', e => {
  e.currentTarget.classList.remove('drag-over-pool');
});
document.getElementById('studentPool').addEventListener('drop', e => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over-pool');
  if (!dragData) return;
  
  const sid = dragData.studentId;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] === sid) grid[r][c] = null;
      
  pinnedSeats = pinnedSeats.filter(p => p.studentId !== sid);
  renderGrid();
  renderPool();
});

// ===== STUDENT CRUD =====
function addStudent(name) {
  name = name.trim();
  if (!name) return;
  if (students.find(s => s.name === name)) { 
    showToast(`'${name}'(은)는 이미 존재하는 이름입니다.`, true); 
    return; 
  }
  students.push({ id: uid(), name });
  renderPool();
  showToast(`${name} 추가됨`);
}

function removeStudent(id) {
  students = students.filter(s => s.id !== id);
  excludePairs = excludePairs.filter(p => p.a !== id && p.b !== id);
  pinnedSeats = pinnedSeats.filter(p => p.studentId !== id);
  placeUnassignedToPool();
  renderExcludeList();
}

document.getElementById('addStudentBtn').onclick = () => {
  const inp = document.getElementById('studentNameInput');
  addStudent(inp.value);
  inp.value = '';
  inp.focus();
};
document.getElementById('studentNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('addStudentBtn').click(); }
});

document.getElementById('bulkAddBtn').onclick = () => {
  document.getElementById('bulkModal').style.display = 'flex';
  document.getElementById('bulkTextarea').value = '';
  document.getElementById('bulkTextarea').focus();
};
document.getElementById('bulkCancelBtn').onclick = () => {
  document.getElementById('bulkModal').style.display = 'none';
};

document.getElementById('bulkConfirmBtn').onclick = () => {
  const text = document.getElementById('bulkTextarea').value;
  let count = 0;
  let dupes = [];
  
  text.split('\n').forEach(line => {
    const name = line.trim();
    if (name) {
      if (students.find(s => s.name === name)) {
        dupes.push(name);
      } else {
        students.push({ id: uid(), name });
        count++;
      }
    }
  });
  
  document.getElementById('bulkModal').style.display = 'none';
  renderPool();
  
  if (dupes.length > 0) {
    showToast(`${count}명 추가됨 (⚠️ 중복 제외: ${dupes.join(', ')})`, true);
  } else if (count > 0) {
    showToast(`${count}명 추가됨`);
  }
};

document.getElementById('clearAllBtn').onclick = () => {
  showConfirm('모든 학생을 삭제하시겠습니까?', () => {
    students = [];
    excludePairs = [];
    pinnedSeats = [];
    initGrid();
    renderExcludeList();
    showToast('전체 삭제 완료');
  });
};

// ===== EXCLUDE =====
function updateDropdowns() {
  const a = document.getElementById('excludeA');
  const b = document.getElementById('excludeB');
  
  const options = `<option value="">선택</option>` + students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const prevA = a.value, prevB = b.value;
  a.innerHTML = options; b.innerHTML = options;
  a.value = prevA; b.value = prevB;
}

document.getElementById('addExcludeBtn').onclick = () => {
  const a = document.getElementById('excludeA').value;
  const b = document.getElementById('excludeB').value;
  if (!a || !b || a === b) return showToast('올바른 학생 쌍을 선택하세요.');
  
  if (!excludePairs.find(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))) {
    excludePairs.push({ id: uid(), a, b });
    renderExcludeList();
    showToast('제외 쌍 추가됨');
  } else {
    showToast('이미 등록된 쌍입니다.');
  }
};

function renderExcludeList() {
  const list = document.getElementById('excludeList');
  list.innerHTML = '';
  excludePairs.forEach(p => {
    const sa = students.find(s => s.id === p.a);
    const sb = students.find(s => s.id === p.b);
    if (!sa || !sb) return;
    
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between bg-[rgba(255,255,255,0.03)] px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.05)] text-xs';
    div.innerHTML = `
      <span style="color:var(--text);">${sa.name} ↔ ${sb.name}</span>
      <button class="text-red-400 hover:text-red-300 transition-colors" onclick="removeExclude('${p.id}')">✕</button>
    `;
    list.appendChild(div);
  });
}
window.removeExclude = (id) => {
  excludePairs = excludePairs.filter(p => p.id !== id);
  renderExcludeList();
};

// ===== SAVE/LOAD LAYOUT =====
function loadLayoutsMenu() {
    const layouts = JSON.parse(localStorage.getItem('seatPickerLayouts') || '[]');
    const select = document.getElementById('loadLayoutSelect');
    select.innerHTML = '<option value="">저장된 배치 불러오기</option>'; 
    layouts.forEach(l => {
        select.innerHTML += `<option value="${l.id}">${l.name}</option>`;
    });
}

document.getElementById('saveLayoutBtn').onclick = () => {
    const name = prompt('저장할 배치의 이름을 입력하세요.\n(💡 중요한 배치는 이름 앞에 ! 를 붙여서 저장하세요.)');
    if(!name) return;
    
    const layouts = JSON.parse(localStorage.getItem('seatPickerLayouts') || '[]');
    layouts.push({
        id: uid(),
        name, rows, cols, isPairMode,
        grid, disabledCells: Array.from(disabledCells), pinnedSeats, students
    });
    localStorage.setItem('seatPickerLayouts', JSON.stringify(layouts));
    loadLayoutsMenu();
    showToast('배치가 저장되었습니다.');
};

document.getElementById('loadLayoutSelect').onchange = (e) => {
    const val = e.target.value;
    if(!val) return;
    const layouts = JSON.parse(localStorage.getItem('seatPickerLayouts') || '[]');
    const layout = layouts.find(l => l.id === val);
    if(layout) applyLayout(layout, false);
};

document.getElementById('deleteLayoutBtn').onclick = () => {
    const select = document.getElementById('loadLayoutSelect');
    const val = select.value;
    if(!val) { showToast('삭제할 배치를 먼저 선택하세요'); return; }
    
    let layouts = JSON.parse(localStorage.getItem('seatPickerLayouts') || '[]');
    layouts = layouts.filter(l => l.id !== val);
    localStorage.setItem('seatPickerLayouts', JSON.stringify(layouts));
    loadLayoutsMenu(); 
    showToast('배치가 삭제되었습니다.');
}

function applyLayout(layout, isTrick = false) {
    rows = layout.rows; cols = layout.cols;
    document.getElementById('rowsInput').value = rows;
    document.getElementById('colsInput').value = cols;
    
    if (layout.isPairMode !== undefined) {
        isPairMode = layout.isPairMode;
        document.getElementById('pairModeToggle').checked = isPairMode;
    }

    students = layout.students || [];
    grid = layout.grid;
    disabledCells = new Set(layout.disabledCells || []);
    pinnedSeats = layout.pinnedSeats || [];
    renderGrid();
    renderPool();
    
    if(isTrick) {
        showToast('자리를 섞었습니다.');
    } else {
        showToast('배치를 불러왔습니다.');
    }
}

// ===== EXPORT TO EXCEL =====
// 🛠️ 수정 1: 결번/빈자리를 텍스트 없이 빈칸("")으로 저장
document.getElementById('excelExportBtn').onclick = () => {
    let csvContent = "\uFEFF"; 
    
    for (let r = 0; r < rows; r++) {
        let rowData = [];
        for (let c = 0; c < cols; c++) {
            if (disabledCells.has(`${r},${c}`)) {
                rowData.push(""); // 결번 -> 빈칸 처리
            } else {
                const sid = grid[r][c];
                if (sid) {
                    const s = students.find(x => x.id === sid);
                    rowData.push(s ? s.name : "");
                } else {
                    rowData.push(""); // 빈자리 -> 빈칸 처리
                }
            }
        }
        csvContent += rowData.join(",") + "\n";
    }
    
    let blackboardRow = new Array(cols).fill("");
    let centerIdx = Math.floor(cols / 2) - (cols % 2 === 0 ? 1 : 0);
    if (centerIdx < 0) centerIdx = 0;
    blackboardRow[centerIdx] = "교탁"; 
    csvContent += "\n" + blackboardRow.join(",") + "\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
    link.setAttribute("download", `자리배치표_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('엑셀(CSV) 파일로 다운로드되었습니다.');
};

// ===== SHUFFLE & RESET =====
document.getElementById('resetSeatsBtn').onclick = () => {
  showConfirm('고정된 자리(📌)를 제외하고 모두 풀로 내리시겠습니까?', () => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!pinnedSeats.some(p => p.row === r && p.col === c)) {
           grid[r][c] = null;
        }
      }
    }
    renderGrid();
    renderPool();
  });
};

function checkExclude(tempGrid) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            const s1 = tempGrid[r][c];
            if(!s1) continue;

            for(let [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;
                
                if(nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    const s2 = tempGrid[nr][nc];
                    if(s2) {
                        if(excludePairs.some(p => (p.a===s1 && p.b===s2) || (p.a===s2 && p.b===s1))) {
                            return false; 
                        }
                    }
                }
            }
        }
    }
    return true;
}

// 🛠️ 수정 2: 주작 모드 시 '결번(disabledCells)' 일치 여부도 검사하여 불일치 시 빨간 경고창
document.getElementById('shuffleBtn').onclick = () => {
  if (altPressed) {
      const layouts = JSON.parse(localStorage.getItem('seatPickerLayouts') || '[]');
      const trickLayout = layouts.find(l => l.name.startsWith('!'));
      if(trickLayout) {
          const isPinnedMatch = trickLayout.pinnedSeats.length === pinnedSeats.length && 
                                trickLayout.pinnedSeats.every(p => pinnedSeats.some(cp => cp.studentId === p.studentId && cp.row === p.row && cp.col === p.col));
                                
          // 🟢 결번 매칭 확인 로직 추가
          const trickDisabled = trickLayout.disabledCells || [];
          const isDisabledMatch = trickDisabled.length === disabledCells.size && 
                                  trickDisabled.every(dc => disabledCells.has(dc));
                                
          if (trickLayout.rows !== rows || trickLayout.cols !== cols || 
              (trickLayout.isPairMode !== undefined && trickLayout.isPairMode !== isPairMode) || 
              !isPinnedMatch || !isDisabledMatch) {
              showToast('배치 조건(행/열 크기, 짝꿍 모드, 고정, 결번 등)이 저장된 데이터와 다릅니다.', true); // true 인자로 빨간 중요 메시지 띄움
              return;
          }

          applyLayout(trickLayout, true);
          return;
      }
  }

  const unpinnedStudents = students.filter(s => !pinnedSeats.some(p => p.studentId === s.id));
  
  const availableSeats = [];
  for(let r=0; r<rows; r++){
      for(let c=0; c<cols; c++){
          if(!disabledCells.has(`${r},${c}`) && !pinnedSeats.some(p => p.row === r && p.col === c)) {
              availableSeats.push({ r, c, num: (rows - 1 - r) * cols + (cols - 1 - c) + 1 });
          }
      }
  }

  availableSeats.sort((a, b) => a.num - b.num);

  let maxRetries = 100;
  let success = false;
  let tempGrid = [];

  while(maxRetries > 0 && !success) {
      tempGrid = grid.map(row => [...row]);
      
      const shuffled = [...unpinnedStudents].sort(() => Math.random() - 0.5);
      
      for(let r=0; r<rows; r++){
          for(let c=0; c<cols; c++){
              if(!pinnedSeats.some(p => p.row === r && p.col === c)) tempGrid[r][c] = null;
          }
      }

      availableSeats.forEach((seat, index) => {
          if (index < shuffled.length) {
              tempGrid[seat.r][seat.c] = shuffled[index].id;
          }
      });

      if(checkExclude(tempGrid)) {
          success = true;
          grid = tempGrid;
      }
      maxRetries--;
  }

  if(!success) {
      showToast('제외 조건을 만족하는 배치를 찾지 못했습니다. 다시 시도하세요.', true);
  } else {
      renderGrid();
      renderPool();
      if(!altPressed) showToast('자리를 섞었습니다.');
  }
};

// 초기 실행
initGrid();
loadLayoutsMenu();
if (window.lucide) lucide.createIcons();