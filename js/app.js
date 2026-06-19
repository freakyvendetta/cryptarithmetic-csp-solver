/**
 * Cryptarithmetic Solver & Sandbox - UI Controller
 * -------------------------------------------------
 * Handles user interactions, preset loading, auto-solve rendering,
 * and live interactive sandbox carry visualization.
 */

function loadPreset(eqStr) {
  document.getElementById('equation-input').value = eqStr;
  document.getElementById('known-input').value = '';
  document.getElementById('error-box').style.display = 'none';
  renderChips();
  
  if (currentMode === 'sandbox') {
    initSandbox();
  } else {
    // Clear results
    document.getElementById('results-container').innerHTML = `
      <div class="no-solution">Presets loaded. Click Solve to run.</div>
    `;
  }
}

function renderChips() {
  const eq = document.getElementById('equation-input').value;
  const parsed = parseEquation(eq);
  const container = document.getElementById('letter-chips');
  container.innerHTML = '';
  
  if (!parsed) return;
  const allWords = [...parsed.lhs, ...parsed.rhs];
  const allLetters = getLetters(allWords);
  
  allLetters.forEach(l => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = l;
    chip.onclick = () => {
      if (currentMode === 'solve') {
        const knownInput = document.getElementById('known-input');
        const comma = knownInput.value ? ', ' : '';
        knownInput.value += `${comma}${l}=`;
        knownInput.focus();
      }
    };
    container.appendChild(chip);
  });
}

function switchMode(mode) {
  currentMode = mode;
  document.getElementById('mode-solve').classList.toggle('active', mode === 'solve');
  document.getElementById('mode-sandbox').classList.toggle('active', mode === 'sandbox');
  
  document.getElementById('results-card').style.display = mode === 'solve' ? 'block' : 'none';
  document.getElementById('sandbox-card').style.display = mode === 'sandbox' ? 'block' : 'none';
  document.getElementById('solve-btn').style.display = mode === 'solve' ? 'block' : 'none';
  document.getElementById('known-field').style.display = mode === 'solve' ? 'block' : 'none';
  
  if (mode === 'sandbox') {
    initSandbox();
  }
}

// ── Sandbox Mode Implementation ──────────────────────────────────────────────

function initSandbox() {
  const eq = document.getElementById('equation-input').value;
  const parsed = parseEquation(eq);
  if (!parsed) {
    showError("Invalid equation format for sandbox.");
    switchMode('solve');
    return;
  }
  
  // Clear any errors
  showError("");
  
  // Reset assignments
  const letters = getLetters([...parsed.lhs, ...parsed.rhs]);
  sandboxAssignments = {};
  letters.forEach(l => {
    sandboxAssignments[l] = null;
  });
  
  renderSandboxUI();
}

function resetSandbox() {
  initSandbox();
}

function handleHighlight(letter, highlight) {
  activeHighlightLetter = highlight ? letter : null;
  document.querySelectorAll('.math-cell').forEach(cell => {
    if (cell.dataset.letter === letter) {
      cell.classList.toggle('highlighted', highlight);
    }
  });
}

function renderSandboxUI() {
  const eq = document.getElementById('equation-input').value;
  const parsed = parseEquation(eq);
  if (!parsed) return;
  
  const allWords = [...parsed.lhs, ...parsed.rhs];
  const letters = getLetters(allWords);
  const leadingLetters = new Set(allWords.filter(w => w.length > 1).map(w => w[0]));
  const maxLen = Math.max(...allWords.map(w => w.length));
  
  // Generate digit pool availability
  const usedDigits = new Set(Object.values(sandboxAssignments).filter(v => v !== null));
  const digitPoolContainer = document.getElementById('sandbox-digit-pool');
  digitPoolContainer.innerHTML = '';
  for (let d = 0; d <= 9; d++) {
    const digitEl = document.createElement('div');
    digitEl.className = 'pool-digit' + (usedDigits.has(d) ? ' used' : '');
    digitEl.textContent = d;
    digitPoolContainer.appendChild(digitEl);
  }
  
  // Render letter assignments cards
  const assignmentsContainer = document.getElementById('sandbox-assignments');
  assignmentsContainer.innerHTML = '';
  letters.forEach(l => {
    const card = document.createElement('div');
    card.className = 'assign-card';
    card.onmouseenter = () => handleHighlight(l, true);
    card.onmouseleave = () => handleHighlight(l, false);
    
    const letterLabel = document.createElement('div');
    letterLabel.className = 'letter';
    letterLabel.textContent = l;
    
    const select = document.createElement('select');
    const defaultOpt = document.createElement('option');
    defaultOpt.value = "";
    defaultOpt.textContent = "?";
    select.appendChild(defaultOpt);
    
    for (let d = 0; d <= 9; d++) {
      if (usedDigits.has(d) && sandboxAssignments[l] !== d) continue;
      if (d === 0 && leadingLetters.has(l)) continue;
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (sandboxAssignments[l] === d) {
        opt.selected = true;
      }
      select.appendChild(opt);
    }
    
    select.onchange = (e) => {
      const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
      sandboxAssignments[l] = val;
      renderSandboxUI();
    };
    
    card.appendChild(letterLabel);
    card.appendChild(select);
    assignmentsContainer.appendChild(card);
  });
  
  // Compute carry variables dynamically for sandbox math visualization
  const carries = Array(maxLen + 1).fill(0);
  const colStatus = Array(maxLen).fill('empty'); // 'empty', 'partial', 'valid', 'invalid'
  
  for (let col = 0; col < maxLen; col++) {
    const carryIn = carries[col];
    let sumAddends = carryIn;
    let allLHSAssigned = true;
    let anyLHSAssigned = false;
    
    parsed.lhs.forEach(word => {
      const char = word[word.length - 1 - col];
      if (char !== undefined) {
        const val = sandboxAssignments[char];
        if (val !== null) {
          sumAddends += val;
          anyLHSAssigned = true;
        } else {
          allLHSAssigned = false;
        }
      }
    });
    
    const resChar = parsed.rhs[0][parsed.rhs[0].length - 1 - col];
    const resVal = resChar !== undefined ? sandboxAssignments[resChar] : null;
    
    if (allLHSAssigned) {
      const expectedDigit = sumAddends % 10;
      carries[col + 1] = Math.floor(sumAddends / 10);
      
      if (resChar !== undefined) {
        if (resVal !== null) {
          if (resVal === expectedDigit) {
            colStatus[col] = 'valid';
          } else {
            colStatus[col] = 'invalid';
            carries[col + 1] = 0; // stop propagate carry if invalid
          }
        } else {
          colStatus[col] = 'partial';
        }
      } else {
        if (expectedDigit === 0) {
          colStatus[col] = 'valid';
        } else {
          colStatus[col] = 'invalid';
          carries[col + 1] = 0;
        }
      }
    } else {
      colStatus[col] = anyLHSAssigned || resVal !== null ? 'partial' : 'empty';
      carries[col + 1] = 0; // carry can't propagate if not fully assigned
    }
  }
  
  // Render Math Grid with dynamic carries
  const mathDisplay = document.getElementById('sandbox-math-display');
  mathDisplay.innerHTML = '';
  
  const verticalGrid = document.createElement('div');
  verticalGrid.className = 'vertical-math-grid';
  
  // 1. Carry Row
  const carryRow = document.createElement('div');
  carryRow.className = 'math-row carry-row';
  for (let c = maxLen; c >= 1; c--) {
    const cell = document.createElement('div');
    cell.className = 'math-cell carry-cell';
    const carryValue = carries[c];
    if (carryValue > 0) {
      cell.textContent = carryValue;
    }
    carryRow.appendChild(cell);
  }
  // Align spacing
  const emptyCarrySpace = document.createElement('div');
  emptyCarrySpace.className = 'math-cell carry-cell';
  carryRow.appendChild(emptyCarrySpace);
  verticalGrid.appendChild(carryRow);
  
  // 2. Addends Rows
  parsed.lhs.forEach((word, wordIdx) => {
    const row = document.createElement('div');
    row.className = 'math-row';
    if (wordIdx === parsed.lhs.length - 1) {
      const op = document.createElement('span');
      op.className = 'operator';
      op.textContent = '+';
      row.appendChild(op);
    }
    
    // Pad left
    for (let pad = 0; pad < maxLen - word.length; pad++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'math-cell';
      row.appendChild(emptyCell);
    }
    
    // Word letters
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const cell = document.createElement('div');
      cell.className = 'math-cell';
      cell.dataset.letter = char;
      if (activeHighlightLetter === char) cell.classList.add('highlighted');
      
      const letterSpan = document.createElement('span');
      letterSpan.className = 'letter';
      letterSpan.textContent = char;
      
      const digitSpan = document.createElement('span');
      digitSpan.className = 'digit';
      const val = sandboxAssignments[char];
      digitSpan.textContent = val !== null ? val : '?';
      
      cell.appendChild(letterSpan);
      cell.appendChild(digitSpan);
      
      cell.onmouseenter = () => handleHighlight(char, true);
      cell.onmouseleave = () => handleHighlight(char, false);
      
      row.appendChild(cell);
    }
    verticalGrid.appendChild(row);
  });
  
  // 3. Sum Row (RHS)
  const sumWord = parsed.rhs[0];
  const sumRow = document.createElement('div');
  sumRow.className = 'math-row sum-row';
  
  // Pad left if sum word is shorter than max length
  for (let pad = 0; pad < maxLen - sumWord.length; pad++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'math-cell';
    sumRow.appendChild(emptyCell);
  }
  
  for (let i = 0; i < sumWord.length; i++) {
    const char = sumWord[i];
    const cell = document.createElement('div');
    cell.className = 'math-cell';
    cell.dataset.letter = char;
    if (activeHighlightLetter === char) cell.classList.add('highlighted');
    
    const letterSpan = document.createElement('span');
    letterSpan.className = 'letter';
    letterSpan.textContent = char;
    
    const digitSpan = document.createElement('span');
    digitSpan.className = 'digit';
    const val = sandboxAssignments[char];
    digitSpan.textContent = val !== null ? val : '?';
    
    cell.appendChild(letterSpan);
    cell.appendChild(digitSpan);
    
    cell.onmouseenter = () => handleHighlight(char, true);
    cell.onmouseleave = () => handleHighlight(char, false);
    
    sumRow.appendChild(cell);
  }
  verticalGrid.appendChild(sumRow);
  mathDisplay.appendChild(verticalGrid);
  
  // Live Verification Check
  renderSandboxVerification(parsed);
}

function renderSandboxVerification(parsed) {
  const verificationContainer = document.getElementById('sandbox-verification');
  verificationContainer.innerHTML = '';
  
  // Convert words to values
  const getWordVal = (word) => {
    const valStr = word.split('').map(c => sandboxAssignments[c]).join('');
    if (valStr.includes('null')) return null;
    return parseInt(valStr, 10);
  };
  
  const lhsVals = parsed.lhs.map(w => getWordVal(w));
  const rhsVal = getWordVal(parsed.rhs[0]);
  
  const lhsSum = lhsVals.includes(null) ? null : lhsVals.reduce((a, b) => a + b, 0);
  
  const formulaStr = parsed.lhs.map((w, idx) => {
    const v = lhsVals[idx];
    return `${w} (${v !== null ? v : '?'})`;
  }).join(' + ') + ` = ${parsed.rhs[0]} (${rhsVal !== null ? rhsVal : '?'})`;
  
  const badge = document.createElement('div');
  badge.className = 'verification-badge';
  
  const statusContainer = document.createElement('div');
  
  if (lhsSum !== null && rhsVal !== null) {
    if (lhsSum === rhsVal) {
      statusContainer.className = 'badge-status valid';
      statusContainer.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Valid Solution!
      `;
      badge.style.borderColor = 'var(--success)';
      badge.style.background = 'var(--success-bg)';
    } else {
      statusContainer.className = 'badge-status invalid';
      statusContainer.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        Sum Mismatch
      `;
      badge.style.borderColor = 'var(--error)';
      badge.style.background = 'var(--error-bg)';
    }
  } else {
    statusContainer.className = 'badge-status partial';
    statusContainer.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      Partially Assigned
    `;
    badge.style.borderColor = 'var(--warning)';
    badge.style.background = 'var(--warning-bg)';
  }
  
  const formulaEl = document.createElement('div');
  formulaEl.textContent = formulaStr;
  
  badge.appendChild(statusContainer);
  badge.appendChild(formulaEl);
  verificationContainer.appendChild(badge);
}

// ── Auto Solver Output Rendering ─────────────────────────────────────────────

function showError(msg) {
  const box = document.getElementById('error-box');
  box.textContent = msg;
  box.style.display = msg ? 'block' : 'none';
}

let solverResults = null;
let currentShowCount = 3;

function renderVerticalMathGrid(lhs, rhs, sol, index) {
  const allWords = [...lhs, ...rhs];
  const maxLen = Math.max(...allWords.map(w => w.length));
  
  // Calculate carries for display
  const carries = Array(maxLen + 1).fill(0);
  for (let col = 0; col < maxLen; col++) {
    let sumAddends = carries[col];
    lhs.forEach(word => {
      const char = word[word.length - 1 - col];
      if (char !== undefined) sumAddends += sol.mapping[char];
    });
    carries[col + 1] = Math.floor(sumAddends / 10);
  }

  let html = `<div class="vertical-math-grid">`;
  
  // Carry Row
  html += `<div class="math-row carry-row">`;
  for (let c = maxLen; c >= 1; c--) {
    const carryValue = carries[c];
    html += `<div class="math-cell carry-cell">${carryValue > 0 ? carryValue : ''}</div>`;
  }
  html += `<div class="math-cell carry-cell"></div></div>`;
  
  // Addend Rows
  lhs.forEach((word, wordIdx) => {
    html += `<div class="math-row">`;
    if (wordIdx === lhs.length - 1) {
      html += `<span class="operator">+</span>`;
    }
    // Pad left
    for (let pad = 0; pad < maxLen - word.length; pad++) {
      html += `<div class="math-cell"></div>`;
    }
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const val = sol.mapping[char];
      html += `
        <div class="math-cell" data-letter="${char}" onmouseenter="handleHighlight('${char}', true)" onmouseleave="handleHighlight('${char}', false)">
          <span class="letter">${char}</span>
          <span class="digit">${val}</span>
        </div>`;
    }
    html += `</div>`;
  });
  
  // Sum Row (RHS)
  const sumWord = rhs[0];
  html += `<div class="math-row sum-row">`;
  for (let pad = 0; pad < maxLen - sumWord.length; pad++) {
    html += `<div class="math-cell"></div>`;
  }
  for (let i = 0; i < sumWord.length; i++) {
    const char = sumWord[i];
    const val = sol.mapping[char];
    html += `
      <div class="math-cell" data-letter="${char}" onmouseenter="handleHighlight('${char}', true)" onmouseleave="handleHighlight('${char}', false)">
        <span class="letter">${char}</span>
        <span class="digit">${val}</span>
      </div>`;
  }
  html += `</div></div>`;
  
  return html;
}


function copyMapping(mappingStr, btnElement) {
  navigator.clipboard.writeText(mappingStr).then(() => {
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
    btnElement.style.color = "var(--accent)";
    btnElement.style.borderColor = "var(--accent)";
    setTimeout(() => {
      btnElement.innerHTML = originalText;
      btnElement.style.color = "var(--text-muted)";
      btnElement.style.borderColor = "var(--border)";
    }, 1800);
  }).catch(err => {
    console.error("Could not copy: ", err);
  });
}

function renderResults() {
  const container = document.getElementById('results-container');
  if (!solverResults || !solverResults.solutions) {
    container.innerHTML = `<div class="no-solution">No results.</div>`;
    return;
  }
  
  const { solutions, stats, parsed } = solverResults;
  const totalCount = solutions.length;
  
  let html = `
    <div class="results-meta">
      <div class="results-count">${totalCount} Solution${totalCount !== 1 ? 's' : ''} Found</div>
      <div class="stats-pill">
        Steps: <span>${stats.steps}</span> | Backtracks: <span>${stats.backtracks}</span> | Time: <span>${stats.timeTakenMs.toFixed(2)} ms</span>
      </div>
    </div>
  `;
  
  const countToShow = Math.min(currentShowCount, totalCount);
  const knownInput = document.getElementById('known-input').value;
  const { map: knownMap } = parseKnown(knownInput);
  
  for (let i = 0; i < countToShow; i++) {
    const sol = solutions[i];
    const verifLHS = parsed.lhs.map(w => sol.wordValues[w]).join(' + ');
    const verifRHS = sol.wordValues[parsed.rhs[0]];
    
    // Mapping tags
    const tagsHtml = Object.entries(sol.mapping)
      .sort((a,b) => a[0].localeCompare(b[0]))
      .map(([l, d]) => {
        const isNew = !(l in knownMap);
        return `
          <span style="
            display: inline-flex; align-items: center; gap: 4px;
            background: ${isNew ? '#1e2e00' : 'rgba(0,0,0,0.2)'};
            border: 1px solid ${isNew ? 'var(--accent)' : 'var(--border)'};
            border-radius: 6px; padding: 2px 8px; font-size: 13px;
            font-family: 'Fira Code', monospace;
            color: ${isNew ? 'var(--accent)' : 'var(--text)'};
          ">
            <b>${l}</b><span style="color: var(--text-dark);">=</span><b>${d}</b>
          </span>
        `;
      }).join('');
      
    html += `
      <div class="vertical-math-card" style="animation-delay: ${i * 50}ms">
        <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between;">
          <span>Solution #${i + 1}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="show-all-btn" style="width: auto; margin-top: 0; padding: 2px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" onclick='copyMapping("${Object.entries(sol.mapping).sort().map(([k,v]) => `${k}=${v}`).join(", ")}", this)'>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy Map
            </button>
            <span style="color: var(--success); font-weight: 700;">✓ Checked</span>
          </div>
        </div>
        
        ${renderVerticalMathGrid(parsed.lhs, parsed.rhs, sol, i)}
        
        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0 12px;">
          ${tagsHtml}
        </div>
        
        <div class="verification-badge" style="margin-top: 0; background: rgba(0,0,0,0.15);">
          <div class="badge-status valid" style="font-size: 12px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ${verifLHS} = ${verifRHS}
          </div>
        </div>
      </div>
    `;
  }
  
  if (totalCount > currentShowCount) {
    html += `
      <button class="show-all-btn" onclick="showMoreResults()">
        Show remaining ${totalCount - currentShowCount} solution${totalCount - currentShowCount !== 1 ? 's' : ''}
      </button>
    `;
  }
  
  container.innerHTML = html;
}

function showMoreResults() {
  currentShowCount += 10;
  renderResults();
}

function handleSolve() {
  showError('');
  const eqRaw = document.getElementById('equation-input').value;
  const knownRaw = document.getElementById('known-input').value;
  
  const parsed = parseEquation(eqRaw);
  if (!parsed) {
    showError("Invalid equation format. Use format: SEND + MORE = MONEY");
    return;
  }
  
  const { map: knownMap, error: knownErr } = parseKnown(knownRaw);
  if (knownErr) {
    showError(knownErr);
    return;
  }
  
  // Validate that all known letters are actually in the equation
  const allLetters = getLetters([...parsed.lhs, ...parsed.rhs]);
  for (const letter of Object.keys(knownMap)) {
    if (!allLetters.includes(letter)) {
      showError(`Letter '${letter}' from known assignments is not in the equation.`);
      return;
    }
  }
  
  const btn = document.getElementById('solve-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Solving equation...';
  
  setTimeout(() => {
    const res = solveCSP(parsed, knownMap);
    btn.disabled = false;
    btn.innerHTML = 'Solve Equation';
    
    if (res.error) {
      // Check if we have stats to show even on failure
      if (res.stats) {
        document.getElementById('results-container').innerHTML = `
          <div class="results-meta">
            <div class="results-count" style="color: var(--error);">No Solutions</div>
            <div class="stats-pill">
              Steps: <span>${res.stats.steps}</span> | Backtracks: <span>${res.stats.backtracks}</span> | Time: <span>${res.stats.timeTakenMs.toFixed(2)} ms</span>
            </div>
          </div>
          <div class="no-solution" style="color: var(--error);">${res.error}</div>
        `;
      } else {
        showError(res.error);
      }
      return;
    }
    
    solverResults = {
      solutions: res.solutions,
      stats: res.stats,
      parsed: parsed
    };
    currentShowCount = 3;
    renderResults();
  }, 50);
}

// ── Event Listeners ──────────────────────────────────────────────────────────

document.getElementById('equation-input').addEventListener('input', () => {
  renderChips();
  if (currentMode === 'sandbox') {
    initSandbox();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && currentMode === 'solve' && !document.getElementById('solve-btn').disabled) {
    handleSolve();
  }
});

// Initialize on load
renderChips();
