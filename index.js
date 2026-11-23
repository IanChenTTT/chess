import Game from "./util/Game.js";

const game = new Game();

const back = document.querySelector("#Back");
const front = document.querySelector("#Front");
const statusEl = document.querySelector("#status");
const movesBody = document.querySelector("#moves");
const newGameBtn = document.querySelector("#newGame");

let selected = null; // { y, x } of the piece picked by click
let dragFrom = null; // { y, x } of the piece being dragged

// ---------------------------------------------------------------- board DOM (built once)

for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
    const bg = document.createElement("div");
    bg.classList.add((y + x) % 2 === 0 ? "ColorBlock" : "WhiteBlocks");
    back.append(bg);

    const cell = document.createElement("div");
    cell.classList.add(`${y}_${x}`, "dropable");
    cell.dataset.y = y;
    cell.dataset.x = x;
    front.append(cell);
  }
}

const cellAt = (y, x) => front.children[y * 8 + x];
const posOf = (cell) => ({ y: Number(cell.dataset.y), x: Number(cell.dataset.x) });

// ---------------------------------------------------------------- rendering (always from game state)

function render() {
  const king = game.status === "checkmate" || game.inCheck() ? game.kingSquare() : null;

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const cell = cellAt(y, x);
      const piece = game.pieceAt(y, x);
      cell.classList.remove("ChessPiece", "CanDrag", "MoveAble", "Check", "Selected");
      cell.style.backgroundImage = piece ? `url(./image/${piece}.svg)` : "";
      cell.draggable = false;
      if (piece) {
        cell.classList.add("ChessPiece");
        if (game.playing && piece[0] === game.turn) {
          cell.classList.add("CanDrag");
          cell.draggable = true;
        }
      }
      if (king && king[0] === y && king[1] === x) cell.classList.add("Check");
    }
  }

  if (selected) showTargets(selected.y, selected.x);
  renderRecord();
  renderStatus();
}

function renderRecord() {
  movesBody.replaceChildren();
  const td = (text) => {
    const el = document.createElement("td");
    el.textContent = text;
    return el;
  };
  let tr = null;
  for (const entry of game.history) {
    if (entry.color === "W" || !tr) {
      tr = document.createElement("tr");
      tr.id = `MOVE${entry.number}`;
      tr.append(td(entry.number));
      if (entry.color === "B") tr.append(td("..."));
      movesBody.append(tr);
    }
    tr.append(td(entry.san));
  }
}

function renderStatus() {
  if (!game.playing) {
    statusEl.textContent = game.resultText;
    return;
  }
  const who = game.turn === "W" ? "White" : "Black";
  statusEl.textContent = game.inCheck() ? `${who} to move - Check!` : `${who} to move`;
}

function showTargets(y, x) {
  clearTargets();
  cellAt(y, x).classList.add("Selected");
  for (const m of game.legalMovesFrom(y, x)) cellAt(m.ty, m.tx).classList.add("MoveAble");
}

function clearTargets() {
  for (const cell of front.children) cell.classList.remove("MoveAble", "Selected");
}

// ---------------------------------------------------------------- making a move

function askPromotion() {
  const answer = (prompt("Promote to Q, R, B or N?", "Q") ?? "Q").trim().toUpperCase();
  return answer.length === 1 && "QRBN".includes(answer) ? answer : "Q";
}

function tryMove(from, to) {
  const promo = game.needsPromotion(from.y, from.x, to.y, to.x) ? askPromotion() : "Q";
  const entry = game.move(from.y, from.x, to.y, to.x, promo);
  selected = null;
  dragFrom = null;
  render();
  return entry;
}

// ---------------------------------------------------------------- drag and drop (one set of listeners)

front.addEventListener("dragstart", (event) => {
  const cell = event.target.closest?.(".CanDrag");
  if (!cell || !game.playing) {
    event.preventDefault();
    return;
  }
  dragFrom = posOf(cell);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", `${dragFrom.y}_${dragFrom.x}`);
  // Mutating the DOM inside dragstart can cancel the drag in some browsers.
  setTimeout(() => dragFrom && showTargets(dragFrom.y, dragFrom.x), 0);
});

front.addEventListener("dragend", () => {
  dragFrom = null;
  selected = null;
  clearTargets();
});

front.addEventListener("dragover", (event) => {
  if (dragFrom) event.preventDefault();
});

front.addEventListener("drop", (event) => {
  event.preventDefault();
  const cell = event.target.closest?.(".dropable");
  if (!cell || !dragFrom) return;
  tryMove(dragFrom, posOf(cell));
});

// ---------------------------------------------------------------- click to move (touch screens)

front.addEventListener("click", (event) => {
  const cell = event.target.closest?.(".dropable");
  if (!cell || !game.playing) return;
  const pos = posOf(cell);

  if (selected && game.legalMovesFrom(selected.y, selected.x).some((m) => m.ty === pos.y && m.tx === pos.x)) {
    tryMove(selected, pos);
    return;
  }
  const piece = game.pieceAt(pos.y, pos.x);
  if (piece && piece[0] === game.turn && !(selected && selected.y === pos.y && selected.x === pos.x)) {
    selected = pos;
    showTargets(pos.y, pos.x);
  } else {
    selected = null;
    clearTargets();
  }
});

newGameBtn.addEventListener("click", () => {
  game.reset();
  selected = null;
  dragFrom = null;
  render();
});

render();
