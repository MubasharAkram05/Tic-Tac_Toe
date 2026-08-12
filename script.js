(function(){
  const boardEl = document.getElementById('board');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const resetBtn = document.getElementById('reset-btn');
  const modeGroup = document.getElementById('mode-group');
  const difficultyGroup = document.getElementById('difficulty-group');
  const difficultyRow = document.getElementById('difficulty-row');
  const namesModal = document.getElementById('names-modal');
  const resultModal = document.getElementById('result-modal');
  const resultIcon = document.getElementById('result-icon');
  const resultTitle = document.getElementById('result-title');
  const resultSub = document.getElementById('result-sub');
  const resultPlayAgainBtn = document.getElementById('result-play-again-btn');
  const resultCloseBtn = document.getElementById('result-close-btn');
  const player1Input = document.getElementById('player1-input');
  const player2Input = document.getElementById('player2-input');
  const namesStartBtn = document.getElementById('names-start-btn');
  const namesXBtn = document.getElementById('names-x-btn');
  const namesCancelBtn = document.getElementById('names-cancel-btn');
  const resetScoresBtn = document.getElementById('reset-scores-btn');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const scoreDrawEl = document.getElementById('score-draw');
  const labelXEl = document.getElementById('label-x');
  const labelOEl = document.getElementById('label-o');
  const winLineEl = document.getElementById('win-line');
  const boardWrap = document.querySelector('.board-wrap');

  let board = Array(9).fill(null);
  let humanMark = 'X';
  let aiMark = 'O';
  let difficulty = 'medium';
  let mode = 'computer';
  let player1Name = 'Player 1';
  let player2Name = 'Player 2';
  let pendingReset = false;
  let gameOver = false;
  let scores = { X: 0, O: 0, draw: 0 };

  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  const X_SVG = '<svg viewBox="0 0 100 100"><path class="stroke" d="M20,20 L80,80"/><path class="stroke" d="M80,20 L20,80"/></svg>';
  const O_SVG = '<svg viewBox="0 0 100 100"><circle class="stroke" cx="50" cy="50" r="34"/></svg>';

  function buildBoard(){
    boardEl.innerHTML = '';
    for(let i=0;i<9;i++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }

  function render(){
    const cells = boardEl.children;
    for(let i=0;i<9;i++){
      const cell = cells[i];
      cell.classList.remove('x','o');
      cell.innerHTML = '';
      cell.classList.toggle('taken', !!board[i]);
      if(board[i] === 'X'){
        cell.classList.add('x');
        cell.innerHTML = X_SVG;
      } else if(board[i] === 'O'){
        cell.classList.add('o');
        cell.innerHTML = O_SVG;
      }
    }
  }

  function checkWinner(b){
    for(const line of WIN_LINES){
      const [a,c,d] = line;
      if(b[a] && b[a]===b[c] && b[a]===b[d]){
        return { mark:b[a], line };
      }
    }
    if(b.every(v=>v!==null)) return { mark:'draw', line:null };
    return null;
  }

  function onCellClick(e){
    if(gameOver) return;
    const idx = parseInt(e.currentTarget.dataset.index);
    if(board[idx]) return;

    if(mode === 'friend'){
      const turn = currentTurn();
      board[idx] = turn;
      render();
      const result = checkWinner(board);
      if(result){ endGame(result); return; }
      const next = turn === 'X' ? 'O' : 'X';
      statusText.textContent = (next === 'X' ? player1Name : player2Name) + "'s move";
      return;
    }

    if(currentTurn() !== humanMark) return;

    board[idx] = humanMark;
    render();
    const result = checkWinner(board);
    if(result){ endGame(result); return; }

    setThinking(true);
    setDisabled(true);
    setTimeout(()=>{
      aiMove();
      setDisabled(false);
      setThinking(false);
    }, 400);
  }

  function currentTurn(){
    const filled = board.filter(v=>v!==null).length;
    return filled % 2 === 0 ? 'X' : 'O';
  }

  function setDisabled(disabled){
    Array.from(boardEl.children).forEach(c=>c.classList.toggle('disabled', disabled));
  }

  function setThinking(isThinking){
    statusPill.classList.toggle('thinking', isThinking);
    statusText.textContent = isThinking ? 'Machine is thinking' : statusText.textContent;
  }

  function aiMove(){
    if(gameOver) return;
    let idx;
    if(difficulty === 'easy'){
      idx = randomMove();
    } else if(difficulty === 'medium'){
      idx = Math.random() < 0.5 ? bestMove() : randomMove();
    } else {
      idx = bestMove();
    }
    board[idx] = aiMark;
    render();
    const result = checkWinner(board);
    if(result){ endGame(result); return; }
    statusText.textContent = 'Your move';
  }

  function randomMove(){
    const empties = board.map((v,i)=>v===null?i:null).filter(v=>v!==null);
    return empties[Math.floor(Math.random()*empties.length)];
  }

  function bestMove(){
    let bestScore = -Infinity;
    let move = null;
    for(let i=0;i<9;i++){
      if(board[i]===null){
        board[i] = aiMark;
        const score = minimax(board, 0, false);
        board[i] = null;
        if(score > bestScore){
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }

  function minimax(b, depth, isMaximizing){
    const result = checkWinner(b);
    if(result){
      if(result.mark === aiMark) return 10 - depth;
      if(result.mark === humanMark) return depth - 10;
      return 0;
    }
    if(isMaximizing){
      let best = -Infinity;
      for(let i=0;i<9;i++){
        if(b[i]===null){
          b[i] = aiMark;
          best = Math.max(best, minimax(b, depth+1, false));
          b[i] = null;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for(let i=0;i<9;i++){
        if(b[i]===null){
          b[i] = humanMark;
          best = Math.min(best, minimax(b, depth+1, true));
          b[i] = null;
        }
      }
      return best;
    }
  }

  function drawWinLine(line){
    const cells = boardEl.children;
    const startCell = cells[line[0]];
    const endCell = cells[line[2]];
    const wrapRect = boardWrap.getBoundingClientRect();
    const r1 = startCell.getBoundingClientRect();
    const r2 = endCell.getBoundingClientRect();

    const x1 = r1.left + r1.width/2 - wrapRect.left;
    const y1 = r1.top + r1.height/2 - wrapRect.top;
    const x2 = r2.left + r2.width/2 - wrapRect.left;
    const y2 = r2.top + r2.height/2 - wrapRect.top;

    const dx = x2 - x1, dy = y2 - y1;
    const length = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    winLineEl.style.left = x1 + 'px';
    winLineEl.style.top = y1 + 'px';
    winLineEl.style.transform = `rotate(${angle}deg)`;
    winLineEl.style.width = '0px';
    requestAnimationFrame(()=>{
      winLineEl.style.width = length + 'px';
    });
  }

  function endGame(result){
    gameOver = true;
    setDisabled(true);
    statusPill.classList.remove('thinking');
    let icon = '🎉', title = '', sub = '';

    if(result.mark === 'draw'){
      statusText.textContent = "It's a draw";
      scores.draw++;
      icon = '🤝';
      title = "It's a Draw!";
      sub = 'Evenly matched — go again?';
    } else {
      if(result.line){
        result.line.forEach(i=> boardEl.children[i].classList.add('win'));
        drawWinLine(result.line);
      }
      if(mode === 'friend'){
        const winnerName = result.mark === 'X' ? player1Name : player2Name;
        statusText.textContent = winnerName + ' wins';
        title = winnerName + ' Wins!';
        sub = 'Three in a row — well played.';
      } else if(result.mark === humanMark){
        statusText.textContent = 'You win';
        title = 'You Win!';
        sub = 'You outsmarted the machine.';
      } else {
        statusText.textContent = 'Machine wins';
        title = 'Machine Wins';
        icon = '🤖';
        sub = 'Better luck next round.';
      }
      scores[result.mark]++;
    }
    updateScoreboard();

    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    resultSub.textContent = sub;
    setTimeout(()=>{ resultModal.classList.add('open'); }, 500);
  }

  function updateScoreboard(){
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    scoreDrawEl.textContent = scores.draw;
  }

  function updateLabels(){
    if(mode === 'friend'){
      labelXEl.textContent = player1Name;
      labelOEl.textContent = player2Name;
    } else {
      labelXEl.textContent = humanMark === 'X' ? 'You' : 'Machine';
      labelOEl.textContent = humanMark === 'O' ? 'You' : 'Machine';
    }
  }

  function newGame(){
    board = Array(9).fill(null);
    gameOver = false;
    winLineEl.style.width = '0px';
    buildBoard();
    render();
    setDisabled(false);
    updateLabels();

    if(mode === 'friend'){
      statusText.textContent = player1Name + "'s move";
      return;
    }

    if(humanMark === 'O'){
      statusText.textContent = 'Machine opens';
      setThinking(true);
      setDisabled(true);
      setTimeout(()=>{
        aiMove();
        setDisabled(false);
        setThinking(false);
      }, 400);
    } else {
      statusText.textContent = 'Your move';
    }
  }

  modeGroup.addEventListener('click', (e)=>{
    const btn = e.target.closest('.seg-btn');
    if(!btn) return;
    mode = btn.dataset.mode;
    Array.from(modeGroup.children).forEach(b=>b.classList.toggle('active', b===btn));
    difficultyRow.style.display = mode === 'friend' ? 'none' : 'flex';
    if(mode === 'friend'){
      openNamesModal();
    } else {
      newGame();
    }
  });

  function openNamesModal(){
    resultModal.classList.remove('open');
    player1Input.value = player1Name === 'Player 1' ? '' : player1Name;
    player2Input.value = player2Name === 'Player 2' ? '' : player2Name;
    namesModal.classList.add('open');
    setDisabled(true);
    setTimeout(()=> player1Input.focus(), 50);
  }

  function closeNamesModal(){
    namesModal.classList.remove('open');
  }

  function cancelNamesModal(){
    closeNamesModal();
    if(pendingReset){
      pendingReset = false;
      if(!gameOver) setDisabled(false);
      return;
    }
    mode = 'computer';
    Array.from(modeGroup.children).forEach(b=>b.classList.toggle('active', b.dataset.mode === 'computer'));
    difficultyRow.style.display = 'flex';
    if(!gameOver) setDisabled(false);
  }

  function confirmNames(){
    const newP1 = player1Input.value.trim() || 'Player 1';
    const newP2 = player2Input.value.trim() || 'Player 2';
    const namesChanged = (newP1 !== player1Name) || (newP2 !== player2Name);
    player1Name = newP1;
    player2Name = newP2;
    updateLabels();
    closeNamesModal();
    if(namesChanged || pendingReset){
      scores = { X: 0, O: 0, draw: 0 };
      updateScoreboard();
    }
    pendingReset = false;
    newGame();
  }

  namesStartBtn.addEventListener('click', confirmNames);
  namesXBtn.addEventListener('click', cancelNamesModal);
  namesCancelBtn.addEventListener('click', cancelNamesModal);
  player1Input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') confirmNames(); });
  player2Input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') confirmNames(); });

  difficultyGroup.addEventListener('click', (e)=>{
    const btn = e.target.closest('.seg-btn');
    if(!btn) return;
    difficulty = btn.dataset.level;
    Array.from(difficultyGroup.children).forEach(b=>b.classList.toggle('active', b===btn));
  });

  resetBtn.addEventListener('click', newGame);

  resetScoresBtn.addEventListener('click', ()=>{
    if(mode === 'friend'){
      pendingReset = true;
      openNamesModal();
    } else {
      scores = { X: 0, O: 0, draw: 0 };
      updateScoreboard();
      newGame();
    }
  });

  resultPlayAgainBtn.addEventListener('click', ()=>{
    resultModal.classList.remove('open');
    newGame();
  });
  resultCloseBtn.addEventListener('click', ()=>{
    resultModal.classList.remove('open');
  });

  buildBoard();
  newGame();
})();
