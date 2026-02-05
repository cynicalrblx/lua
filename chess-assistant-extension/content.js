const extensionRuntime = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;

const HIGHLIGHT_CLASS = "stockfish-highlight";
const FROM_CLASS = "stockfish-highlight-from";
const TO_CLASS = "stockfish-highlight-to";
const NOTICE_CLASS = "stockfish-notice";

let lastFen = null;
let lastAnalysis = null;
let lastRequestedAt = 0;

function getBoardElement() {
  return (
    document.querySelector("cg-board") ||
    document.querySelector(".cg-board") ||
    document.querySelector("chess-board") ||
    document.querySelector(".board")
  );
}

function isBoardFlipped(board) {
  if (!board) {
    return false;
  }

  if (board.getAttribute("orientation") === "black") {
    return true;
  }

  const wrapper = board.closest(".orientation-black, .flipped");
  return Boolean(wrapper);
}

function getFenFromPage() {
  const fenInput =
    document.querySelector('input[name="fen"]') ||
    document.querySelector('textarea[name="fen"]') ||
    document.querySelector('input[data-cy*="fen"]') ||
    document.querySelector('input[id*="fen"]');

  if (fenInput?.value) {
    return fenInput.value.trim();
  }

  const fenContainer = document.querySelector("[data-fen]");
  if (fenContainer?.dataset?.fen) {
    return fenContainer.dataset.fen.trim();
  }

  const board = getBoardElement();
  const boardFen = board?.getAttribute?.("fen") || board?.getAttribute?.("data-fen");
  if (boardFen) {
    return boardFen.trim();
  }

  return null;
}

function showNotice(message) {
  let notice = document.querySelector(`.${NOTICE_CLASS}`);
  if (!notice) {
    notice = document.createElement("div");
    notice.className = NOTICE_CLASS;
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  notice.classList.add("visible");
  setTimeout(() => notice.classList.remove("visible"), 2000);
}

function clearHighlights() {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((node) => node.remove());
}

function highlightMove(move) {
  const board = getBoardElement();
  if (!board) {
    showNotice("No chess board found on this page.");
    return;
  }

  clearHighlights();

  const rect = board.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height) / 8;
  const flipped = isBoardFlipped(board);

  const fromSquare = move.slice(0, 2);
  const toSquare = move.slice(2, 4);

  [
    { square: fromSquare, className: FROM_CLASS },
    { square: toSquare, className: TO_CLASS }
  ].forEach(({ square, className }) => {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10) - 1;

    if (Number.isNaN(file) || Number.isNaN(rank)) {
      return;
    }

    const x = flipped ? (7 - file) * size : file * size;
    const y = flipped ? rank * size : (7 - rank) * size;

    const highlight = document.createElement("div");
    highlight.className = `${HIGHLIGHT_CLASS} ${className}`;
    highlight.style.left = `${rect.left + x + window.scrollX}px`;
    highlight.style.top = `${rect.top + y + window.scrollY}px`;
    highlight.style.width = `${size}px`;
    highlight.style.height = `${size}px`;

    document.body.appendChild(highlight);
  });
}

async function fetchCloudEval(fen) {
  const url = new URL("https://lichess.org/api/cloud-eval");
  url.searchParams.set("fen", fen);
  url.searchParams.set("multiPv", "3");
  url.searchParams.set("variant", "standard");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Cloud eval failed");
  }

  return response.json();
}

async function getAnalysis(fen) {
  const now = Date.now();
  if (fen === lastFen && lastAnalysis && now - lastRequestedAt < 3000) {
    return lastAnalysis;
  }

  lastRequestedAt = now;
  const analysis = await fetchCloudEval(fen);
  lastFen = fen;
  lastAnalysis = analysis;
  return analysis;
}

function extractMove(analysis, rank) {
  const pv = analysis?.pvs?.[rank - 1];
  if (!pv?.moves) {
    return null;
  }

  const firstMove = pv.moves.split(" ")[0];
  return firstMove || null;
}

async function handleAnalyze(rank) {
  const fen = getFenFromPage();
  if (!fen) {
    showNotice("No FEN found. Open analysis or a board with a FEN input.");
    return;
  }

  try {
    const analysis = await getAnalysis(fen);
    const move = extractMove(analysis, rank);
    if (!move) {
      showNotice("No move available for this position yet.");
      return;
    }

    highlightMove(move);
  } catch (error) {
    showNotice("Unable to reach Stockfish cloud analysis.");
  }
}

extensionRuntime.onMessage.addListener((message) => {
  if (message?.type === "analyze") {
    handleAnalyze(message.rank);
  }
});
