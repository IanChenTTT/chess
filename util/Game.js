// Chess rules engine (no DOM, plain synchronous code).
//
// Board: 8x8 array, board[y][x]. y = 0 is rank 8 (Black's side), x = 0 is file a.
// Piece: "" for empty, otherwise colour + type, e.g. "WP", "BK" (same names as ./image/*.svg).
// Colours: "W" and "B".

const FILES = "abcdefgh";
export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const inb = (y, x) => y >= 0 && y < 8 && x >= 0 && x < 8;
const other = (c) => (c === "W" ? "B" : "W");

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// ---------------------------------------------------------------- FEN

export function stateFromFEN(fen) {
  const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
  const board = placement.split("/").map((row) => {
    const out = [];
    for (const ch of row) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push("");
      else out.push((ch === ch.toUpperCase() ? "W" : "B") + ch.toUpperCase());
    }
    return out;
  });
  const castling = {
    WK: castle.includes("K"),
    WQ: castle.includes("Q"),
    BK: castle.includes("k"),
    BQ: castle.includes("q"),
  };
  const epSq =
    ep && ep !== "-" ? { y: 8 - Number(ep[1]), x: FILES.indexOf(ep[0]) } : null;
  return {
    board,
    turn: turn === "b" ? "B" : "W",
    castling,
    ep: epSq,
    halfmove: Number(half ?? 0),
    fullmove: Number(full ?? 1),
  };
}

// ---------------------------------------------------------------- attacks

function isAttacked(b, y, x, by) {
  const pd = by === "W" ? 1 : -1; // a White pawn attacks upward (y - 1)
  for (const dx of [-1, 1]) {
    const py = y + pd;
    const px = x + dx;
    if (inb(py, px) && b[py][px] === by + "P") return true;
  }
  for (const [dy, dx] of KNIGHT) {
    const ny = y + dy;
    const nx = x + dx;
    if (inb(ny, nx) && b[ny][nx] === by + "N") return true;
  }
  for (const [dy, dx] of KING) {
    const ny = y + dy;
    const nx = x + dx;
    if (inb(ny, nx) && b[ny][nx] === by + "K") return true;
  }
  for (const [dirs, types] of [[ROOK, "RQ"], [BISHOP, "BQ"]]) {
    for (const [dy, dx] of dirs) {
      let ny = y + dy;
      let nx = x + dx;
      while (inb(ny, nx)) {
        const p = b[ny][nx];
        if (p) {
          if (p[0] === by && types.includes(p[1])) return true;
          break;
        }
        ny += dy;
        nx += dx;
      }
    }
  }
  return false;
}

function findKing(b, color) {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) if (b[y][x] === color + "K") return [y, x];
  return null;
}

function kingInCheck(b, color) {
  const k = findKing(b, color);
  return k ? isAttacked(b, k[0], k[1], other(color)) : false;
}

// ---------------------------------------------------------------- move generation

function genPseudo(s) {
  const { board: b, turn: c, castling, ep } = s;
  const en = other(c);
  const moves = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = b[y][x];
      if (!p || p[0] !== c) continue;
      const t = p[1];
      const add = (ty, tx, extra) =>
        moves.push({ fy: y, fx: x, ty, tx, piece: p, captured: b[ty][tx], ...extra });

      if (t === "P") {
        const dir = c === "W" ? -1 : 1;
        const start = c === "W" ? 6 : 1;
        const last = c === "W" ? 0 : 7;
        const ny = y + dir;
        if (inb(ny, x) && !b[ny][x]) {
          if (ny === last) for (const pr of "QRBN") add(ny, x, { promo: pr });
          else {
            add(ny, x);
            if (y === start && !b[y + 2 * dir][x]) add(y + 2 * dir, x);
          }
        }
        for (const dx of [-1, 1]) {
          const nx = x + dx;
          if (!inb(ny, nx)) continue;
          const q = b[ny][nx];
          if (q && q[0] === en) {
            if (ny === last) for (const pr of "QRBN") add(ny, nx, { promo: pr });
            else add(ny, nx);
          } else if (!q && ep && ep.y === ny && ep.x === nx) {
            add(ny, nx, { ep: true, captured: en + "P" });
          }
        }
      } else if (t === "N" || t === "K") {
        for (const [dy, dx] of t === "N" ? KNIGHT : KING) {
          const ny = y + dy;
          const nx = x + dx;
          if (inb(ny, nx) && (!b[ny][nx] || b[ny][nx][0] === en)) add(ny, nx);
        }
        if (t === "K" && x === 4 && y === (c === "W" ? 7 : 0) && !isAttacked(b, y, 4, en)) {
          if (
            castling[c + "K"] &&
            !b[y][5] && !b[y][6] && b[y][7] === c + "R" &&
            !isAttacked(b, y, 5, en) && !isAttacked(b, y, 6, en)
          )
            add(y, 6, { castle: "K" });
          if (
            castling[c + "Q"] &&
            !b[y][1] && !b[y][2] && !b[y][3] && b[y][0] === c + "R" &&
            !isAttacked(b, y, 3, en) && !isAttacked(b, y, 2, en)
          )
            add(y, 2, { castle: "Q" });
        }
      } else {
        const dirs = t === "R" ? ROOK : t === "B" ? BISHOP : [...ROOK, ...BISHOP];
        for (const [dy, dx] of dirs) {
          let ny = y + dy;
          let nx = x + dx;
          while (inb(ny, nx)) {
            const q = b[ny][nx];
            if (!q) add(ny, nx);
            else {
              if (q[0] === en) add(ny, nx);
              break;
            }
            ny += dy;
            nx += dx;
          }
        }
      }
    }
  }
  return moves;
}

function applyBoard(board, m, color) {
  const b = board.map((r) => r.slice());
  const piece = b[m.fy][m.fx];
  b[m.fy][m.fx] = "";
  if (m.ep) b[m.fy][m.tx] = ""; // the captured pawn sits beside the mover
  b[m.ty][m.tx] = m.promo ? color + m.promo : piece;
  if (m.castle === "K") {
    b[m.ty][5] = b[m.ty][7];
    b[m.ty][7] = "";
  } else if (m.castle === "Q") {
    b[m.ty][3] = b[m.ty][0];
    b[m.ty][0] = "";
  }
  return b;
}

export function genLegal(s) {
  return genPseudo(s).filter((m) => !kingInCheck(applyBoard(s.board, m, s.turn), s.turn));
}

const CORNERS = [[7, 0, "WQ"], [7, 7, "WK"], [0, 0, "BQ"], [0, 7, "BK"]];

export function applyMove(s, m) {
  const color = s.turn;
  const castling = { ...s.castling };
  if (m.piece[1] === "K") {
    castling[color + "K"] = false;
    castling[color + "Q"] = false;
  }
  // a rook leaving, or being captured on, its corner loses that right
  for (const [cy, cx, key] of CORNERS) {
    if ((m.fy === cy && m.fx === cx) || (m.ty === cy && m.tx === cx)) castling[key] = false;
  }
  const isPawn = m.piece[1] === "P";
  return {
    board: applyBoard(s.board, m, color),
    turn: other(color),
    castling,
    ep: isPawn && Math.abs(m.ty - m.fy) === 2 ? { y: (m.fy + m.ty) / 2, x: m.fx } : null,
    halfmove: isPawn || m.captured ? 0 : s.halfmove + 1,
    fullmove: color === "B" ? s.fullmove + 1 : s.fullmove,
  };
}

export function perft(s, depth) {
  if (depth === 0) return 1;
  const moves = genLegal(s);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(s, m), depth - 1);
  return n;
}

// ---------------------------------------------------------------- notation

function sanOf(m, legal) {
  if (m.castle) return m.castle === "K" ? "O-O" : "O-O-O";
  const t = m.piece[1];
  const dest = FILES[m.tx] + (8 - m.ty);
  const cap = m.captured !== "";
  if (t === "P") {
    let str = cap ? FILES[m.fx] + "x" : "";
    str += dest;
    if (m.promo) str += "=" + m.promo;
    return str;
  }
  let str = t;
  const rivals = legal.filter(
    (o) => o !== m && o.piece === m.piece && o.ty === m.ty && o.tx === m.tx
  );
  if (rivals.length) {
    if (!rivals.some((o) => o.fx === m.fx)) str += FILES[m.fx];
    else if (!rivals.some((o) => o.fy === m.fy)) str += 8 - m.fy;
    else str += FILES[m.fx] + (8 - m.fy);
  }
  return str + (cap ? "x" : "") + dest;
}

// ---------------------------------------------------------------- draw helpers

function insufficientMaterial(b) {
  const rest = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = b[y][x];
      if (p && p[1] !== "K") rest.push({ t: p[1], sq: (y + x) % 2 });
    }
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0].t === "B" || rest[0].t === "N")) return true;
  return rest.every((r) => r.t === "B" && r.sq === rest[0].sq);
}

function positionKey(s) {
  const ep = s.ep ? FILES[s.ep.x] + (8 - s.ep.y) : "-";
  const c = ["WK", "WQ", "BK", "BQ"].map((k) => (s.castling[k] ? 1 : 0)).join("");
  return s.board.map((r) => r.map((p) => p || "--").join("")).join("/") + ` ${s.turn} ${c} ${ep}`;
}

// ---------------------------------------------------------------- Game

export default class Game {
  constructor(fen = START_FEN) {
    this.load(fen);
  }

  load(fen) {
    this.state = stateFromFEN(fen);
    this.history = []; // [{ number, color, san, from, to, captured }]
    this.positions = new Map();
    this.lastMove = null;
    this.#afterChange();
  }

  reset() {
    this.load(START_FEN);
  }

  get board() {
    return this.state.board;
  }
  get turn() {
    return this.state.turn;
  }
  get playing() {
    return this.status === "playing";
  }

  pieceAt(y, x) {
    return this.state.board[y][x];
  }

  inCheck(color = this.state.turn) {
    return kingInCheck(this.state.board, color);
  }

  kingSquare(color = this.state.turn) {
    return findKing(this.state.board, color);
  }

  /** Legal moves for the piece on (y, x). Empty unless it is that colour's turn. */
  legalMovesFrom(y, x) {
    if (!this.playing) return [];
    return this._legal.filter((m) => m.fy === y && m.fx === x);
  }

  needsPromotion(fy, fx, ty, tx) {
    return this.legalMovesFrom(fy, fx).some((m) => m.ty === ty && m.tx === tx && m.promo);
  }

  /**
   * Play a move. Returns the history entry, or null if the move is illegal.
   * `promo` is one of "Q", "R", "B", "N" and only matters for a pawn reaching the last rank.
   */
  move(fy, fx, ty, tx, promo = "Q") {
    if (!this.playing) return null;
    const m = this._legal.find(
      (o) => o.fy === fy && o.fx === fx && o.ty === ty && o.tx === tx && (!o.promo || o.promo === promo)
    );
    if (!m) return null;

    const before = this.state;
    const base = sanOf(m, this._legal);
    const next = applyMove(before, m);
    const gives = kingInCheck(next.board, next.turn);
    const suffix = gives ? (genLegal(next).length ? "+" : "#") : "";

    const entry = {
      number: before.fullmove,
      color: before.turn,
      san: base + suffix,
      from: [fy, fx],
      to: [ty, tx],
      captured: m.captured,
    };
    this.state = next;
    this.history.push(entry);
    this.lastMove = entry;
    this.#afterChange();
    return entry;
  }

  get resultText() {
    switch (this.status) {
      case "checkmate":
        return `Checkmate - ${this.winner === "W" ? "White" : "Black"} wins`;
      case "stalemate":
        return "Draw by stalemate";
      case "draw":
        return `Draw by ${this.drawReason}`;
      default:
        return "";
    }
  }

  #afterChange() {
    const s = this.state;
    const key = positionKey(s);
    this.positions.set(key, (this.positions.get(key) ?? 0) + 1);

    this._legal = genLegal(s);
    this.winner = null;
    this.drawReason = null;
    if (this._legal.length === 0) {
      if (kingInCheck(s.board, s.turn)) {
        this.status = "checkmate";
        this.winner = other(s.turn);
      } else this.status = "stalemate";
    } else if (insufficientMaterial(s.board)) {
      this.status = "draw";
      this.drawReason = "insufficient material";
    } else if (s.halfmove >= 100) {
      this.status = "draw";
      this.drawReason = "the 50-move rule";
    } else if (this.positions.get(key) >= 3) {
      this.status = "draw";
      this.drawReason = "threefold repetition";
    } else this.status = "playing";
  }
}
