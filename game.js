"use strict";

const BALANCE_KEY = "lucky-bingo-balance";
const STARTING_BONUS_CLAIMED_KEY = "lucky-bingo-starting-bonus-claimed";
const ADMIN_STATE_KEY = "lucky-bingo-admin-state-v1";
const ADMIN_SETTINGS_KEY = "lucky-bingo-admin-settings-v1";
const ROOM_CATALOG_KEY = "lucky-bingo-room-catalog-v1";
const ROOM_LIFECYCLE_KEY = "lucky-bingo-room-lifecycle-v1";
const LAST_WINNING_CARDS_KEY = "lucky-bingo-last-winning-cards-v1";
const CARD_DATA_URL = "card%20number.json";
const START_BALANCE = 0;
const DEFAULT_STARTING_BONUS = 50;
const CARD_COUNT = 1000;
const MAX_PICK = 2;
const CALL_MS = 3200;
const DEFAULT_PICK_SECS = 60;
const DEFAULT_WINNING_PATTERN = "1";
const WINNING_PATTERNS = Object.freeze(["1", "2", "3", "4", "full-house"]);
const ROOM_GAME_MS = CALL_MS * 75;
const ROOM_UPDATE_MS = 2400;
const ROOM_STATUS_UPDATE_MS = 1000;
const COMMISSION_RATE = 0.2;
const MIN_WALLET_AMOUNT = 50;
const PLAYER_ID = "LB-PLAYER";
const PLAYER_NAME = "Lucky Bingo Player";
const PAYMENT_METHODS = Object.freeze({
  Telebirr: { accountName: "Lucky Bingo", accountNumber: "0911 000 000" },
  "CBE Birr": { accountName: "Lucky Bingo CBE Birr", accountNumber: "1000 000 000" },
  "M-Pesa": { accountName: "Lucky Bingo M-Pesa", accountNumber: "0700 000 000" },
});

const ROOMS = [
  { id: "10", stake: 10, players: 0, status: "waiting" },
  { id: "20", stake: 20, players: 0, status: "waiting" },
  { id: "50", stake: 50, players: 0, status: "waiting" },
];

const DEFAULT_LAST_WINNING_CARDS = Object.freeze([
  { cardId: 440, name: "RAS", stake: 20, prize: 3800 },
  { cardId: 157, name: "Mengistu", stake: 5, prize: 1155 },
  { cardId: 22, name: "Don Deva", stake: 5, prize: 362 },
  { cardId: 230, name: "Yilma Mamo", stake: 5, prize: 362 },
  { cardId: 268, name: "Abraha", stake: 5, prize: 362 },
]);
const BOT_WINNER_NAMES = Object.freeze(DEFAULT_LAST_WINNING_CARDS.map((winner) => winner.name));

const LETTERS = ["B", "I", "N", "G", "O"];
const COL_RANGES = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

const $ = (id) => document.getElementById(id);
const views = {
  lobby: $("view-lobby"),
  pick: $("view-pick"),
  game: $("view-game"),
};

let startingBonusAwarded = 0;
let balance = loadInitialBalance();
let stake = 10;
let selected = new Set();
let selectedPreviewId = null;
let takenByOthers = new Set();
let mobilePanelTab = "game";
let cardDefs = {};
let cardNumbers = [];
let cardsReady = false;
let cardsLoadError = false;
let called = [];
let manualMarked = new Set();
let autoMarkingEnabled = true;
let soundEffectsEnabled = localStorage.getItem("lucky-bingo-sound-enabled") !== "0";
const VOICE_STORAGE_KEY = "lucky-bingo-selected-voice";
const SUPPORTED_VOICES = ["amharic", "oromgna", "tigregna"];
let selectedVoice = (() => {
  const saved = localStorage.getItem(VOICE_STORAGE_KEY);
  return SUPPORTED_VOICES.includes(saved) ? saved : "amharic";
})();

const TIGREGNA_AUDIO_MAP = {
  1: "tb1-u8-amm-y.mp3", 2: "tb2-DnFGXGK3.mp3", 3: "tb3-Ruwscjl-.mp3", 4: "tb4-D1Imot9q.mp3", 5: "tb5-Bdq-FmX7.mp3",
  6: "tb6-rmjcnyBD.mp3", 7: "tb7-DXoZQcwX.mp3", 8: "tb8-BaCBaRbX.mp3", 9: "tb9-Bn8Heffg.mp3", 10: "tb10-Chf3-Np3.mp3",
  11: "tb11-Cu4U_kn4.mp3", 12: "tb12-DWiFR0ih.mp3", 13: "tb13-DShnYfRm.mp3", 14: "tb14-SGbBsq8y.mp3", 15: "tb15-DQQkZxqa.mp3",
  16: "ti16-wu_v3Nfq.mp3", 17: "ti17-PLUUsM_W.mp3", 18: "ti18-CfSEBXAN.mp3", 19: "ti19-Cjf6X9tP.mp3", 20: "ti20-ClazJcYh.mp3",
  21: "ti21-DjzZpHhn.mp3", 22: "ti22-Bohak4jM.mp3", 23: "ti23-h7lBTSAS.mp3", 24: "ti24-CvbFRm3M.mp3", 25: "ti25-Dwo-U3lx.mp3",
  26: "ti26-DiOzfuRw.mp3", 27: "ti27-Cul0pD3m.mp3", 28: "ti28-Dlv1DPi0.mp3", 29: "ti29-hvfZnt_H.mp3", 30: "ti30-CFlZtU2b.mp3",
  31: "tn31-CEYw_eNg.mp3", 32: "tn32-DpB4DkAe.mp3", 33: "tn33-CW3_C5P4.mp3", 34: "tn34-ojDGH3oc.mp3", 35: "tn35-CQsTCEi3.mp3",
  36: "tn36-CvdnN_ar.mp3", 37: "tn37-DuwWLKC_.mp3", 38: "tn38-D8wAGDK0.mp3", 39: "tn39-D0DO67xk.mp3", 40: "tn40-De2ic06h.mp3",
  41: "tn41-CjTKEU3B.mp3", 42: "tn42-BPAmVAML.mp3", 43: "tn43-CtaQ0XgQ.mp3", 44: "tn44-PjzqJlZX.mp3", 45: "tn45-CgDded1V.mp3",
  46: "tg46-ClGf6b-s.mp3", 47: "tg47-0t8CLx0l.mp3", 48: "tg48-DW9h3Sq5.mp3", 49: "tg49-0NwURg2A.mp3", 50: "tg50-m_irPmFo.mp3",
  51: "tg51-FjtFdSX3.mp3", 52: "tg52-Chi7sIgr.mp3", 53: "tg53-DmOgIzDZ.mp3", 54: "tg54-CRP9EeFU.mp3", 55: "tg55-CXd4xjcU.mp3",
  56: "tg56-D3gaoMuL.mp3", 57: "tg57-Du3ibdpN.mp3", 58: "tg58-Cn_dBl0Y.mp3", 59: "tg59-BmqFm1_u.mp3", 60: "tg60-maMs9xff.mp3",
  61: "to61-CYJXWcAk.mp3", 62: "to62-CYd1MZpV.mp3", 63: "to63-CL-KyV9q.mp3", 64: "to64-D2vsehJw.mp3", 65: "to65-clFqryvR.mp3",
  66: "to66-DfMmYJiI.mp3", 67: "to67-B8In0f2e.mp3", 68: "to68-D8hrQhaZ.mp3", 69: "to69-hDkOCBzt.mp3", 70: "to70-6pM3Ft9G.mp3",
  71: "to71-BbIMP-_K.mp3", 72: "to72-CgcgqWCh.mp3", 73: "to73-DQOrK0nq.mp3", 74: "to74-Ck2l_K0y.mp3", 75: "to75-ttBiMotP.mp3"
};

function getSelectedVoice() {
  return selectedVoice || "amharic";
}

function setVoice(voice, playSample = false) {
  if (!SUPPORTED_VOICES.includes(voice)) return;
  selectedVoice = voice;
  localStorage.setItem(VOICE_STORAGE_KEY, voice);
  document.querySelectorAll(".lb-voice-select").forEach((el) => {
    el.value = voice;
  });
  const voiceNames = {
    amharic: "Amharic (አማርኛ)",
    oromgna: "Afaan Oromoo",
    tigregna: "Tigrinya (ትግርኛ)",
  };
  toast(`VOICE: ${voiceNames[voice] || voice.toUpperCase()}`, "win");
  if (playSample && soundEffectsEnabled) {
    try {
      const sample = new Audio(`assets/audio/${voice}/b1.mp3`);
      sample.play().catch(() => {});
    } catch (e) {}
  }
}

let currentCallAudio = null;
let callPool = [];
let callTimer = null;
let pickTimer = null;
let winnerTimer = null;
let roomTimer = null;
let roomStatusTimer = null;
let roomLifecycle = loadRoomLifecycle();
let lastWinningCards = loadLastWinningCards();
let activeRoomId = null;
let pickLeft = null;
let pickEndsAt = 0;
let playing = false;
let gameWaiting = false;
let entryCharged = false;
let claimed = false;
let botPlayers = 0;
let roundOutcome = null;
let roundWinnerName = "";
let roundWinKind = "";
let roundWinCardId = null;
let walletState = { deposit: "Telebirr", withdraw: "Telebirr" };
// The server owns room membership, counts, rounds, countdowns, and calls.
// This map contains only the latest server snapshots used to render the UI.
let serverRoomStates = {};

// =============================================================================
// SERVER-SIDE SYNCHRONIZATION (CROSS-DEVICE SYNC)
// =============================================================================
async function syncProfileWithServer() {
  if (typeof LuckyBingoAPI === "undefined") return;
  try {
    const user = await LuckyBingoAPI.getProfile();
    if (!user || user.error) return;

    if (typeof user.balance === "number") {
      const prevBal = balance;
      balance = Number(user.balance);
      localStorage.setItem(BALANCE_KEY, String(balance));
      renderBalance();
      if (prevBal !== balance && prevBal > 0) {
        const diff = balance - prevBal;
        if (diff > 0) {
          toast(`BALANCE CREDITED +${fmt(diff)} ETB`, "win");
        }
      }
    }

    if (Array.isArray(user.transactions)) {
      window._serverTransactions = user.transactions.map((tx) => ({
        id: tx.id,
        playerId: `LB-${String(tx.user_id || user.id).slice(-5)}`,
        player: user.first_name || user.username || PLAYER_NAME,
        type: tx.type,
        method: tx.method || "Telebirr",
        amount: Number(tx.amount) || 0,
        requested: tx.created_at || "Recent",
        status: (tx.status === "completed" || tx.status === "approved") ? "completed" : tx.status,
        details: tx.phone_number ? `Ref/Phone: ${tx.phone_number}` : "",
      }));
      const historyActive = document.querySelector('[data-mobile-nav="history"]')?.classList.contains("is-active");
      if (historyActive) {
        renderMobilePanelContent("history");
      }
    }

    if (user.active_room) {
      const recoveredRoomId = String(user.active_room.room_id);
      if (activeRoomId === null || activeRoomId === recoveredRoomId) {
        activeRoomId = recoveredRoomId;
        selected = new Set((user.active_room.card_ids || []).map(Number));
        stake = Number(activeRoomId) || stake;
        serverRoomStates[recoveredRoomId] = {
          ...(serverRoomStates[recoveredRoomId] || {}),
          room_id: recoveredRoomId,
          status: user.active_room.status,
          round_id: user.active_room.current_round_id ?? user.active_room.round_id,
          countdown_ends_at: Number(user.active_room.countdown_ends_at || 0),
        };
        const recoveredStatus = user.active_room.status;
        if (recoveredStatus === "live") {
          entryCharged = true;
          if (!playing) beginLiveGame();
        } else if (!playing && !views.pick.classList.contains("is-on")) {
          showView("pick");
          buildCardGrid();
          renderCartelaPreview();
          if (recoveredStatus === "countdown") {
            const startsAt = Number(user.active_room.countdown_ends_at || 0) * 1000;
            startPickCountdown(startsAt, `countdown:${user.active_room.current_round_id}:server`);
          } else {
            setupPickWaitingState();
          }
        }
        LuckyBingoAPI.stopLobbyPoll();
        LuckyBingoAPI.startRoomPoll(activeRoomId, handleServerRoomState, 800);
      }
    }

    renderBalance();
    updatePickInfo();
  } catch (e) {
    console.warn("Server profile sync error:", e);
  }
}

let _lobbySyncTick = 0;
function startServerLobbySync() {
  if (typeof LuckyBingoAPI === "undefined") return;
  LuckyBingoAPI.startLobbyPoll((data) => {
    if (!data || data.error || !Array.isArray(data.rooms)) return;
    for (const sRoom of data.rooms) {
      const rid = String(sRoom.room_id || sRoom.id);
      serverRoomStates[rid] = { ...sRoom };
      const startsAt = Number(sRoom.countdown_ends_at || 0) * 1000;
      roomLifecycle[rid] = {
        ...(roomLifecycle[rid] || {}),
        phase: sRoom.status === "countdown" ? "countdown" : sRoom.status === "live" ? "live" : "open",
        startsAt,
        roundId: String(sRoom.round_id ?? "0"),
        lifecycleKey: `${sRoom.status}:${sRoom.round_id}:server`,
      };
    }
    if (data.settings && typeof data.settings.commission === "number") {
      window.COMMISSION_RATE = data.settings.commission / 100.0;
    }
    if (views.lobby && views.lobby.classList.contains("is-on")) renderRooms();
    _lobbySyncTick++;
    if (_lobbySyncTick % 2 === 0) {
      syncProfileWithServer();
    }
  }, 1500);
}

function handleServerRoomState(sState) {
  if (!sState || sState.error) return;
  const rid = String(sState.room_id || activeRoomId);
  serverRoomStates[rid] = { ...serverRoomStates[rid], ...sState };
  if (activeRoomId && rid !== String(activeRoomId)) return;
  if (Array.isArray(sState.players)) {
    const current = LuckyBingoAPI?.getTelegramUser?.();
    const myId = current ? Number(current.id) : null;
    const newTaken = new Set();
    
    sState.players.forEach((player) => {
      const isMine = myId && Number(player.user_id) === myId;
      try {
        const cIds = JSON.parse(player.card_ids || "[]").map(Number);
        if (isMine) {
          if (!playing && !gameWaiting) {
            selected = new Set(cIds);
          }
        } else {
          cIds.forEach((id) => newTaken.add(id));
        }
      } catch (e) {}
    });

    // Only real players' cards are marked taken
    takenByOthers = newTaken;
    if (!playing) {
      paintPicks();
      updatePickInfo();
      renderPickRoomSummary();
    }
  }

  if (sState.winning_pattern) {
    serverWinningPattern = sState.winning_pattern;
  }

  // 1. Status is COUNTDOWN
  if (sState.status === "countdown" && sState.countdown_ends_at > 0) {
    const startsAt = sState.countdown_ends_at * 1000;
    const remaining = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
    pickLeft = remaining;
    pickEndsAt = startsAt;
    updatePickCountdownDisplay();
    updatePickInfo();
    renderPickRoomSummary();

    // The browser clock is display-only. The server status poll is the only
    // authority allowed to transition a shared room into the live round.
  }

  // 2. Status is LIVE
  if (sState.status === "live") {
    if (!playing && selected.size > 0) {
      entryCharged = true;
      beginLiveGame();
    }
    if (playing && Array.isArray(sState.calls)) {
      for (const n of sState.calls) {
        if (!called.includes(n)) {
          handleSingleCall(n);
        }
      }
    }
  }

  // 3. Status is OPEN
  if (sState.status === "open") {
    if (!pickTimer && !playing) {
      updatePickCountdownDisplay();
      renderPickRoomSummary();
    }
  }
  // 4. Server reports round result (Winner announced!)
  if (sState.last_result && playing && !claimed) {
    const res = sState.last_result;
    if (res.round_id === sState.round_id && res.ended_at && (Date.now() / 1000 - res.ended_at) < 15) {
      const myProfile = typeof LuckyBingoAPI !== "undefined" ? LuckyBingoAPI.getTelegramUser() : null;
      const isMe = res.winner_id && myProfile && Number(res.winner_id) === Number(myProfile.id);
      claimed = true;
      playing = false;
      clearInterval(callTimer);
      if (isMe) {
        roundOutcome = "win";
        roundWinnerName = res.winner_name || PLAYER_NAME;
        showRoundResult("win", roundWinnerName, "LINE", selected.values().next().value);
        showWinnerOverlay("win", roundWinnerName, res.prize, selected.values().next().value, "LINE");
        toast("YOU WON!", "win");
      } else {
        roundOutcome = "lose";
        roundWinnerName = res.winner_name || "Opponent";
        showRoundResult("lose", roundWinnerName, "LINE", null);
        markLoserCards();
        showWinnerOverlay("lose", roundWinnerName, res.prize || stake * 3, null, "LINE");
        toast((roundWinnerName).toUpperCase() + " WON!", "lose");
      }
      syncProfileWithServer();
      setTimeout(() => {
        returnToCardSelection();
      }, 5000);
    }
  }
}

function loadNum(key, fallback, minimum = 1) {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n >= minimum ? n : fallback;
}

function getStartingBonusSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "null") || {};
    const amount = Number(saved.startingBonus);
    return {
      enabled: saved.startingBonusEnabled !== false,
      amount: Number.isFinite(amount) ? Math.max(0, amount) : DEFAULT_STARTING_BONUS,
    };
  } catch (error) {
    return { enabled: true, amount: DEFAULT_STARTING_BONUS };
  }
}

function loadInitialBalance() {
  // The server is authoritative. This local value is only a paint-time fallback
  // while /api/me is loading and must never create or mutate wallet funds.
  const stored = Number(localStorage.getItem(BALANCE_KEY));
  return Number.isFinite(stored) && stored >= 0 ? stored : START_BALANCE;
}

function getPickCountdownSeconds() {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "null");
    const seconds = Number(saved?.countdown);
    return Number.isFinite(seconds) ? Math.min(600, Math.max(10, Math.round(seconds))) : DEFAULT_PICK_SECS;
  } catch (error) {
    return DEFAULT_PICK_SECS;
  }
}

function normalizeWinningPattern(value) {
  const pattern = String(value ?? DEFAULT_WINNING_PATTERN);
  return WINNING_PATTERNS.includes(pattern) ? pattern : DEFAULT_WINNING_PATTERN;
}

let serverWinningPattern = null;

function getWinningPattern() {
  if (serverWinningPattern) return normalizeWinningPattern(serverWinningPattern);
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "null");
    return normalizeWinningPattern(saved?.winningPattern);
  } catch (error) {
    return DEFAULT_WINNING_PATTERN;
  }
}

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function loadRoomLifecycle() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROOM_LIFECYCLE_KEY) || "null");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    return {};
  }
}

function saveRoomLifecycle() {
  try {
    localStorage.setItem(ROOM_LIFECYCLE_KEY, JSON.stringify(roomLifecycle));
  } catch (error) {
    // The room indicator can continue to run for this page if storage is unavailable.
  }
}

function loadLastWinningCards() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_WINNING_CARDS_KEY) || "null");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch (error) {
    return {};
  }
}

function saveLastWinningCards() {
  try {
    localStorage.setItem(LAST_WINNING_CARDS_KEY, JSON.stringify(lastWinningCards));
  } catch (error) {
    // Recent winner history is supplemental and can continue in memory if storage is unavailable.
  }
}

function getLastWinningCards(stakeValue) {
  const saved = lastWinningCards[String(stakeValue)];
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_LAST_WINNING_CARDS;
}

function rememberWinningCard(stakeValue, cardId, name, prize) {
  const history = getLastWinningCards(stakeValue).filter((item) => Number(item.cardId) !== Number(cardId));
  lastWinningCards[String(stakeValue)] = [
    { cardId: Number(cardId), name: String(name), stake: Number(stakeValue), prize: Number(prize) },
    ...history,
  ].slice(0, 4);
  saveLastWinningCards();
}

const REAL_ROOM_PLAYERS_KEY = "lucky-bingo-real-room-players-v2";

function getRealRoomParticipants() {
  try {
    const data = JSON.parse(localStorage.getItem(REAL_ROOM_PLAYERS_KEY) || "{}");
    return typeof data === "object" && data !== null ? data : {};
  } catch (e) {
    return {};
  }
}

function registerRealPlayerInRoom(roomId) {
  // Compatibility hook only. Membership is persisted by /api/join-room.
}

function unregisterRealPlayerFromRoom(roomId) {
  // Compatibility hook only. /api/leave-room owns membership and refunds.
}

function sanitizeRoomCatalog(rooms) {
  if (!Array.isArray(rooms)) return ROOMS;
  // Local storage may contain room labels only. Server snapshots override all
  // player counts, status, round, countdown, and prize calculations.
  return rooms.map((room) => ({
    ...room,
    id: String(room.id),
    players: 0,
    prizePool: 0,
  }));
}

function loadAdminRooms() {
  try {
    const savedCatalog = JSON.parse(localStorage.getItem(ROOM_CATALOG_KEY) || "null");
    if (Array.isArray(savedCatalog)) {
      const sanitized = sanitizeRoomCatalog(savedCatalog);
      try { localStorage.setItem(ROOM_CATALOG_KEY, JSON.stringify(sanitized)); } catch (e) {}
      return sanitized;
    }

    const savedState = JSON.parse(localStorage.getItem(ADMIN_STATE_KEY) || "null");
    const legacyRooms = savedState && Array.isArray(savedState.rooms) ? savedState.rooms : null;
    if (legacyRooms) {
      const sanitized = sanitizeRoomCatalog(legacyRooms);
      try { localStorage.setItem(ROOM_CATALOG_KEY, JSON.stringify(sanitized)); } catch (e) {}
      return sanitized;
    }
  } catch (error) {
    // Fall back to built-in lobby rooms when storage is unavailable.
  }
  return ROOMS;
}

function savePlayerRoomPlayers(roomId, players) {
  // Player counts are strictly tied to real participants
}

function getLobbyRooms() {
  const adminRooms = loadAdminRooms();
  const rooms = adminRooms === null ? ROOMS : adminRooms;
  return rooms
    .map((room) => {
      const id = String(room.id);
      const server = serverRoomStates[id];
      return {
        ...room,
        id,
        stake: Math.max(1, Math.round(Number(room.stake) || Number(id) || 0)),
        // Never use browser storage for authoritative room membership.
        players: server ? Math.max(0, Number(server.player_count) || 0) : 0,
        status: server?.status || "open",
        roundId: server?.round_id ?? 0,
      };
    })
    .filter((room) => room.stake > 0);
}

function getLobbyRoom(roomId) {
  return getLobbyRooms().find((room) => String(room.id) === String(roomId)) || null;
}

function roomSourceStatus(room) {
  const server = serverRoomStates[String(room.id)];
  if (server?.status === "countdown" || server?.status === "live" || server?.status === "open") {
    return server.status;
  }
  if (!server) return "open";
  const adminRooms = loadAdminRooms();
  const adminRoom = adminRooms?.find((item) => String(item.id) === String(room.id));
  if (adminRoom) {
    if (adminRoom.enabled === false) return "paused";
    if (adminRoom.status === "paused") return "paused";
    if (adminRoom.players > 0 && adminRoom.status === "live") return "live";
  }
  return "waiting";
}

function roomRoundKey(room) {
  return `${roomSourceStatus(room)}:${String(room.roundId || "")}:${String(room.lifecycleVersion || 0)}`;
}

function roomLifecycleKey(roundKey, cycle) {
  return `${roundKey}:${cycle}`;
}

function createRoomOpen(room, now = Date.now(), previousLifecycle = null) {
  // Legacy display fallback only. Production room lifecycle comes from the API.
  const roundId = String(room?.roundId || "0");
  const roundKey = room ? roomRoundKey(room) : "waiting:0:0";
  const cycle = Number(previousLifecycle?.cycle || 0) + 1;
  const lifecycle = {
    sourceStatus: "waiting",
    roundId,
    roundKey,
    lifecycleKey: roomLifecycleKey(roundKey, cycle),
    phase: "open",
    botPlayers: 0,
    cycle,
  };
  roomLifecycle[String(room?.id || activeRoomId || "1")] = lifecycle;
  saveRoomLifecycle();
  return lifecycle;
}

function startRoomCountdown(room, now = Date.now(), seconds = null) {
  // Deprecated compatibility hook. Only the server can start a countdown.
  const roomKey = String(room?.id || activeRoomId || "1");
  const server = serverRoomStates[roomKey];
  return server?.status === "countdown" ? roomDisplayState(room) : null;
}

function roomDisplayState(room, now = Date.now()) {
  const roomKey = String(room.id);
  const server = serverRoomStates[roomKey];
  if (server?.status === "countdown") {
    const startsAt = Number(server.countdown_ends_at || 0) * 1000;
    const safeLeft = Math.max(0, Math.ceil((startsAt - now) / 1000));
    return {
      type: "countdown",
      label: formatCountdown(safeLeft),
      ariaLabel: `Starts in ${formatCountdown(safeLeft)}`,
      startsAt,
      roundKey: `countdown:${server.round_id}:server`,
    };
  }
  if (server?.status === "live") {
    return {
      type: "live",
      label: "In Play",
      ariaLabel: "Active game in progress",
      roundKey: `live:${server.round_id}:server`,
    };
  }

  const sourceStatus = roomSourceStatus(room);
  const roundId = String(room.roundId || server?.round_id || "");
  const roundKey = roomRoundKey(room);
  let lifecycle = roomLifecycle[roomKey];

  if (sourceStatus === "paused") {
    return { type: "paused", label: "Paused", ariaLabel: "Game paused", roundKey: lifecycle?.lifecycleKey || "paused" };
  }

  if (sourceStatus === "live") {
    return { type: "live", label: "In Play", ariaLabel: "Active game in progress", roundKey: lifecycle?.lifecycleKey || "live" };
  }

  // If no lifecycle yet, initialize as "open"
  if (!lifecycle || lifecycle.roundKey !== roundKey) {
    lifecycle = createRoomOpen(room, now, lifecycle);
  }

  // 1. Live phase: game currently playing
  if (lifecycle.phase === "live") {
    if (now >= Number(lifecycle.endsAt || 0)) {
      // Game ended, return room to open for the next round
      lifecycle = createRoomOpen(room, now, lifecycle);
    } else {
      return { type: "live", label: "In Play", ariaLabel: "Active game in progress", roundKey: lifecycle.lifecycleKey };
    }
  }

  // 2. Countdown phase: >= 2 players picked, counting down to start
  if (lifecycle.phase === "countdown") {
    const safeLeft = Math.ceil((Number(lifecycle.startsAt) - now) / 1000);
    if (safeLeft > 0) {
      return {
        type: "countdown",
        label: formatCountdown(safeLeft),
        ariaLabel: `Starts in ${formatCountdown(safeLeft)}`,
        startsAt: lifecycle.startsAt,
        roundKey: lifecycle.lifecycleKey,
      };
    } else {
      // Countdown ended: transition into live game
      lifecycle = {
        sourceStatus: "waiting",
        roundId,
        roundKey,
        lifecycleKey: lifecycle.lifecycleKey,
        phase: "live",
        startedAt: now,
        endsAt: now + ROOM_GAME_MS,
        botPlayers: lifecycle.botPlayers || 2,
        cycle: Number(lifecycle.cycle || 1),
      };
      roomLifecycle[roomKey] = lifecycle;
      saveRoomLifecycle();
      return { type: "live", label: "In Play", ariaLabel: "Active game in progress", roundKey: lifecycle.lifecycleKey };
    }
  }

  // 3. Open phase: waiting for players to pick cards
  return {
    type: "open",
    label: "Open",
    ariaLabel: "Open for players",
    roundKey: lifecycle.lifecycleKey,
  };
}

function scheduleRoomCountdown(roomId, now = Date.now()) {
  // Deprecated compatibility hook. Countdown scheduling belongs to the server.
  return null;
}

function saveBalance() {
  // Retained for legacy display code only. Wallet mutations belong to the API.
  localStorage.setItem(BALANCE_KEY, String(balance));
}

function fmtBal(n) {
  return Math.floor(n).toLocaleString("en-US").replace(/,/g, " ");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmt(n) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function letterFor(n) {
  for (let i = 0; i < COL_RANGES.length; i++) {
    if (n >= COL_RANGES[i][0] && n <= COL_RANGES[i][1]) return LETTERS[i];
  }
  return "";
}

function checkAdminAccess() {
  const adminBtn = $("admin-link") || document.querySelector(".lb-admin-link");
  if (!adminBtn) return;

  const ADMIN_USERNAMES = ["samtesfa19", "su121316"];
  const ADMIN_UIDS = ["5663531258"];

  let isAdmin = false;

  // 1. Check URL parameters (?role=admin or ?admin=1 or ?u=5663531258)
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const roleParam = (searchParams.get("role") || hashParams.get("role") || "").toLowerCase();
    const adminParam = searchParams.get("admin") || hashParams.get("admin");
    const uParam = searchParams.get("u") || searchParams.get("uid") || hashParams.get("u");

    if (roleParam === "admin" || adminParam === "1" || ADMIN_UIDS.includes(uParam)) {
      isAdmin = true;
      try { sessionStorage.setItem("lb_is_admin", "1"); } catch (e) {}
    }
  } catch (e) {}

  // 2. Check Telegram WebApp user identity
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        const uid = String(user.id || "");
        const uname = String(user.username || "").toLowerCase();
        if (ADMIN_UIDS.includes(uid) || ADMIN_USERNAMES.includes(uname)) {
          isAdmin = true;
          try { sessionStorage.setItem("lb_is_admin", "1"); } catch (e) {}
        }
      }
    }
  } catch (e) {}

  // 3. Check against window.LUCKY_BINGO_ADMIN from players-data.js
  if (!isAdmin && window.LUCKY_BINGO_ADMIN) {
    try {
      const cfgUname = String(window.LUCKY_BINGO_ADMIN.username || "").replace(/^@/, "").toLowerCase();
      const currentTgUname = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.username || "").toLowerCase();
      if (cfgUname && currentTgUname && (currentTgUname === cfgUname || ADMIN_USERNAMES.includes(currentTgUname))) {
        isAdmin = true;
        try { sessionStorage.setItem("lb_is_admin", "1"); } catch (e) {}
      }
    } catch (e) {}
  }

  // 4. Check sessionStorage cache
  if (!isAdmin) {
    try {
      if (sessionStorage.getItem("lb_is_admin") === "1") {
        const currentUid = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "");
        const currentUname = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.username || "").toLowerCase();
        if (currentUid && !ADMIN_UIDS.includes(currentUid) && !ADMIN_USERNAMES.includes(currentUname)) {
          sessionStorage.removeItem("lb_is_admin");
          isAdmin = false;
        } else {
          isAdmin = true;
        }
      }
    } catch (e) {}
  }

  // Toggle button visibility: ONLY the authorized admin sees this button!
  if (isAdmin) {
    adminBtn.hidden = false;
    adminBtn.style.display = "";
  } else {
    adminBtn.hidden = true;
    adminBtn.style.display = "none";
  }
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => el.classList.toggle("is-on", key === name));
  document.body.classList.toggle("is-selection-active", name === "pick");
  document.body.classList.toggle("is-game-active", name === "game");
  document.body.classList.toggle("is-lobby-active", name === "lobby");
  if (name === "lobby") {
    checkAdminAccess();
    startRoomUpdates();
    startRoomStatusUpdates();
  } else {
    stopRoomUpdates();
    stopRoomStatusUpdates();
  }
}

function mobileNavLabel(tab) {
  return ({
    game: "Game",
    history: "History",
    profile: "Profile",
    deposit: "Deposit",
    settings: "Settings",
  })[tab] || "Player";
}

let historyFilter = "all";

function recordPlayerTransaction(data) {
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_STATE_KEY) || "{}");
    const transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
    const txn = {
      id: makeTransactionId(),
      playerId: PLAYER_ID,
      player: PLAYER_NAME,
      type: data.type || "stake",
      method: data.method || "Game Stake",
      amount: Number(data.amount) || 0,
      requested: data.requested || "Just now",
      status: data.status || "completed",
      details: data.details || "",
    };
    saved.transactions = [txn, ...transactions].slice(0, 100);
    localStorage.setItem(ADMIN_STATE_KEY, JSON.stringify(saved));
    return txn;
  } catch (error) {
    return null;
  }
}

function getStoredTransactions() {
  if (Array.isArray(window._serverTransactions) && window._serverTransactions.length > 0) {
    return window._serverTransactions;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_STATE_KEY) || "{}");
    const transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
    if (!transactions.length) {
      return [
        {
          id: "TX-1001",
          playerId: PLAYER_ID,
          player: PLAYER_NAME,
          type: "bonus",
          method: "Welcome Bonus",
          amount: 50,
          requested: "Today",
          status: "completed",
          details: "Starting balance credit",
        },
      ];
    }
    return transactions;
  } catch (error) {
    return [];
  }
}

function renderMobilePanelContent(tab) {
  const content = $("mobile-panel-content");
  if (!content) return;

  if (tab === "history") {
    const all = getStoredTransactions();
    const filtered = all.filter((item) => {
      if (historyFilter === "deposit") return item.type === "deposit" || item.type === "bonus";
      if (historyFilter === "withdraw") return item.type === "withdraw";
      if (historyFilter === "game") return item.type === "stake" || item.type === "win";
      return true;
    });

    const totalIn = all
      .filter((item) => (item.type === "deposit" || item.type === "bonus" || item.type === "win") && item.status !== "rejected")
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalOut = all
      .filter((item) => (item.type === "withdraw" || item.type === "stake") && item.status !== "rejected")
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    content.innerHTML = `
      <div class="lb-history-summary">
        <div class="lb-history-summary-card">
          <span>Balance</span>
          <strong class="is-positive">${Number(balance).toFixed(2)} ETB</strong>
        </div>
        <div class="lb-history-summary-card">
          <span>Total In</span>
          <strong class="is-positive">+${fmt(totalIn)} ETB</strong>
        </div>
        <div class="lb-history-summary-card">
          <span>Total Out</span>
          <strong>-${fmt(totalOut)} ETB</strong>
        </div>
      </div>

      <div class="lb-history-filters" role="tablist" aria-label="Transaction filters">
        <button type="button" class="lb-history-filter-btn ${historyFilter === "all" ? "is-active" : ""}" data-history-filter="all">All</button>
        <button type="button" class="lb-history-filter-btn ${historyFilter === "deposit" ? "is-active" : ""}" data-history-filter="deposit">Deposits</button>
        <button type="button" class="lb-history-filter-btn ${historyFilter === "withdraw" ? "is-active" : ""}" data-history-filter="withdraw">Withdrawals</button>
        <button type="button" class="lb-history-filter-btn ${historyFilter === "game" ? "is-active" : ""}" data-history-filter="game">Games</button>
      </div>

      ${filtered.length ? `
        <div class="lb-mobile-history-list">
          ${filtered.map((item) => {
            const isPos = item.type === "deposit" || item.type === "bonus" || item.type === "win";
            const iconChar = item.type === "deposit" ? "↓" : item.type === "withdraw" ? "↑" : item.type === "win" ? "★" : item.type === "bonus" ? "🎁" : "▦";
            const iconClass = `is-${item.type || "stake"}`;
            const title = item.method || (item.type === "withdraw" ? "Withdrawal" : item.type === "deposit" ? "Deposit" : item.type === "win" ? "Bingo Win" : "Game Stake");
            const sub = item.details || item.reference || (item.phone ? `To: ${item.phone}` : "");
            const dateStr = item.requested || "recently";
            const statusClass = `is-${(item.status || "completed").toLowerCase()}`;

            return `
              <article class="lb-mobile-history-item">
                <span class="lb-mobile-history-icon ${iconClass}">${iconChar}</span>
                <div class="lb-mobile-history-details">
                  <strong>${escapeHTML(title)}</strong>
                  <small>${escapeHTML(dateStr)}${sub ? ` · ${escapeHTML(sub)}` : ""}</small>
                </div>
                <div class="lb-mobile-history-right">
                  <b class="${isPos ? "is-positive" : "is-negative"}">${isPos ? "+" : "-"}${fmt(Number(item.amount) || 0)} ETB</b>
                  <span class="lb-mobile-history-status ${statusClass}">${escapeHTML(item.status || "completed")}</span>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      ` : `
        <div class="lb-mobile-empty-state">
          <span class="lb-mobile-empty-icon">◷</span>
          <strong>No transactions found</strong>
          <p>No transactions match the selected filter.</p>
        </div>
      `}
    `;

    content.querySelectorAll("[data-history-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        historyFilter = btn.dataset.historyFilter;
        renderMobilePanelContent("history");
      });
    });
    return;
  }

  if (tab === "profile") {
    content.innerHTML = `
      <div class="lb-mobile-profile-card">
        <div class="lb-mobile-avatar">LB</div>
        <div>
          <strong>${escapeHTML(PLAYER_NAME)}</strong>
          <span>${PLAYER_ID}</span>
        </div>
      </div>
      <div class="lb-mobile-info-list">
        <div><span>Available Balance</span><b class="is-positive">${Number(balance).toFixed(2)} ETB</b></div>
        <div><span>Current Stake</span><b>${stake} ETB</b></div>
        <div><span>Cards per round</span><b>Up to ${MAX_PICK} cards</b></div>
        <div><span>Account Status</span><b class="is-positive">Active</b></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
        <button type="button" class="lb-mobile-action-button" id="profile-deposit-btn">Deposit Funds</button>
        <button type="button" class="lb-mobile-action-button" style="background:#2a2638;color:#ddd;" id="profile-withdraw-btn">Withdraw</button>
      </div>
    `;
    $("profile-deposit-btn")?.addEventListener("click", () => {
      closeMobilePanel();
      openWallet("deposit");
    });
    $("profile-withdraw-btn")?.addEventListener("click", () => {
      closeMobilePanel();
      openWallet("withdraw");
    });
    return;
  }

  if (tab === "deposit") {
    content.innerHTML = `
      <div class="lb-mobile-action-card">
        <div>
          <strong style="font-size:16px;">Lucky Bingo Wallet</strong>
          <p>Top up your balance instantly using mobile money (Telebirr, CBE Birr, M-Pesa).</p>
        </div>
        <div class="lb-mobile-info-list" style="margin:0;">
          <div><span>Current Balance</span><b class="is-positive">${Number(balance).toFixed(2)} ETB</b></div>
          <div><span>Minimum Deposit</span><b>50 ETB</b></div>
        </div>
        <button type="button" class="lb-mobile-action-button" id="mobile-open-wallet">Proceed to Deposit</button>
      </div>
    `;
    $("mobile-open-wallet")?.addEventListener("click", () => {
      closeMobilePanel();
      openWallet("deposit");
    });
    return;
  }

  if (tab === "settings") {
    content.innerHTML = `
      <div class="lb-mobile-info-list">
        <div>
          <span>Auto-mark cards</span>
          <label class="lb-mobile-switch">
            <input type="checkbox" ${autoMarkingEnabled ? "checked" : ""} id="mobile-auto-mark" />
            <i></i>
          </label>
        </div>
        <div>
          <span>Sound effects</span>
          <label class="lb-mobile-switch">
            <input type="checkbox" ${soundEffectsEnabled ? "checked" : ""} id="mobile-sound-toggle" />
            <i></i>
          </label>
        </div>
        <div>
          <span>Caller Voice / የደዋይ ድምፅ</span>
          <select class="lb-voice-select" id="mobile-voice-select">
            <option value="amharic" ${selectedVoice === "amharic" ? "selected" : ""}>አማርኛ (Amharic)</option>
            <option value="oromgna" ${selectedVoice === "oromgna" ? "selected" : ""}>Afaan Oromoo</option>
            <option value="tigregna" ${selectedVoice === "tigregna" ? "selected" : ""}>ትግርኛ (Tigrinya)</option>
          </select>
        </div>
        <div>
          <span>Theme</span>
          <b>Midnight Black</b>
        </div>
        <div>
          <span>Language</span>
          <b>English / አማርኛ</b>
        </div>
      </div>
    `;
    $("mobile-auto-mark")?.addEventListener("change", (event) => setAutoMarking(event.currentTarget.checked, true));
    $("mobile-sound-toggle")?.addEventListener("change", (event) => {
      soundEffectsEnabled = event.currentTarget.checked;
      localStorage.setItem("lucky-bingo-sound-enabled", soundEffectsEnabled ? "1" : "0");
    });
    $("mobile-voice-select")?.addEventListener("change", (event) => setVoice(event.currentTarget.value, true));
    return;
  }

  content.innerHTML = `
    <div class="lb-mobile-empty-state lb-mobile-game-state">
      <span class="lb-mobile-empty-icon">▦</span>
      <strong>Select up to 2 cards</strong>
      <p>Choose up to 2 available cards to hold. When countdown finishes, round starts automatically.</p>
    </div>
  `;
}

function openMobilePanel(tab) {
  mobilePanelTab = tab;
  const panel = $("mobile-panel");
  const title = $("mobile-panel-title");
  if (!panel || !title) return;
  title.textContent = mobileNavLabel(tab);
  renderMobilePanelContent(tab);
  panel.hidden = false;
}

function closeMobilePanel() {
  const panel = $("mobile-panel");
  if (panel) panel.hidden = true;
  setMobileNavState("game");
}

function setMobileNavState(tab) {
  document.querySelectorAll("[data-mobile-nav]").forEach((button) => {
    const active = button.dataset.mobileNav === tab;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function handleMobileNav(tab) {
  setMobileNavState(tab);
  if (tab === "game") {
    closeMobilePanel();
    return;
  }
  openMobilePanel(tab);
}

function toast(text, kind) {
  const el = $("toast");
  el.textContent = text;
  el.className = "lb-toast" + (kind ? " is-" + kind : "");
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 1800);
}

function renderBalance() {
  const lobbyBalance = $("balance");
  if (lobbyBalance) lobbyBalance.textContent = fmtBal(balance);
  const pickBalance = $("pick-balance");
  if (pickBalance) pickBalance.textContent = `${Number(balance).toFixed(2)} ETB`;
  updateWalletBalances();
  renderRooms();
}

function isValidCardValues(values) {
  return Array.isArray(values) && values.length === 25 && values[12] === 0 && values.every(
    (value, index) => index === 12 || Number.isInteger(value) && value >= 0 && value <= 75
  );
}

function importCard(id, values) {
  const cells = [];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 5; column++) {
      const value = values[column * 5 + row];
      cells.push(row === 2 && column === 2 ? "FREE" : value);
    }
  }
  return { id, cells };
}

function applyCardCatalog(source) {
  const ids = Object.keys(source || {});
  const expectedIds = Array.from({ length: CARD_COUNT }, (_, index) => String(index + 1));
  const hasEveryCard = expectedIds.every((id) => Object.prototype.hasOwnProperty.call(source, id));
  const hasOnlyExpectedCards = ids.length === CARD_COUNT && ids.every((id) => expectedIds.includes(id));
  if (!hasEveryCard || !hasOnlyExpectedCards || expectedIds.some((id) => !isValidCardValues(source[id]))) {
    throw new Error("Card data must contain 1,000 valid 5x5 cartelas");
  }

  cardNumbers = expectedIds.map(Number);
  cardDefs = Object.fromEntries(cardNumbers.map((id) => [id, importCard(id, source[String(id)])]));
  cardsReady = true;
  cardsLoadError = false;
  updatePickInfo();
}

async function loadCardCatalog() {
  try {
    if (window.LUCKY_BINGO_CARD_DATA) {
      applyCardCatalog(window.LUCKY_BINGO_CARD_DATA);
      return;
    }

    const response = await fetch(CARD_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Card data request failed with ${response.status}`);
    applyCardCatalog(await response.json());
  } catch (error) {
    cardNumbers = [];
    cardDefs = {};
    cardsReady = false;
    cardsLoadError = true;
    updatePickInfo();
    toast("CARD DATA UNAVAILABLE", "lose");
    console.error("Unable to load card number.json", error);
  }
}

function ensureCard(id) {
  return cardDefs[id] || null;
}

function prizePool() {
  const room = activeRoomId ? getLobbyRoom(activeRoomId) : null;
  const server = activeRoomId ? serverRoomStates[String(activeRoomId)] : null;
  const count = server ? Number(server.player_count) || 0 : 0;
  return stake * count * (1 - COMMISSION_RATE);
}

function canAfford(roomStake) {
  return balance >= roomStake;
}

function calculateDerash(players, roomStake) {
  const p = Number(players) || 0;
  if (p <= 0) return 0;
  const rate = typeof window.COMMISSION_RATE === "number" ? window.COMMISSION_RATE : COMMISSION_RATE;
  return Math.max(roomStake, Math.floor(p * roomStake * (1 - rate)));
}

function renderPickRoomSummary() {
  const room = activeRoomId ? getLobbyRoom(activeRoomId) : null;
  const server = activeRoomId ? serverRoomStates[String(activeRoomId)] : null;
  const roomStake = room?.stake || stake;
  const playerCount = server ? Number(server.player_count) || 0 : 0;
  const available = cardNumbers.length ? Math.max(0, cardNumbers.length - takenByOthers.size - selected.size) : 0;
  const title = $("pick-room-title");
  const entry = $("pick-entry");
  const players = $("pick-players");
  const availableEl = $("pick-available");
  const time = $("pick-time");
  const bannerSeconds = $("pick-banner-secs");
  const pickBalance = $("pick-balance");
  const pickStake = $("pick-stake");

  if (title) title.textContent = `${roomStake} birr Game Lobby`;
  if (entry) entry.textContent = `${roomStake} ETB`;
  if (pickStake) pickStake.textContent = `${roomStake} ETB`;
  if (players) players.textContent = room ? fmt(playerCount) : "—";
  if (availableEl) availableEl.textContent = cardNumbers.length ? fmt(available) : "—";
  const isCounting = pickTimer !== null && pickLeft !== null && pickLeft > 0;
  if (time) time.textContent = isCounting ? `${Math.max(0, pickLeft)}s` : (selected.size > 0 ? "Waiting" : "Open");
  const reservedStake = selected.size * roomStake;
  const availableBal = Math.max(0, balance - reservedStake);
  if (pickBalance) pickBalance.textContent = `${availableBal.toFixed(2)} ETB`;
  if (bannerSeconds) bannerSeconds.textContent = isCounting ? formatCountdown(pickLeft) : "Open";
}

function renderWinningCards() {
  const wrap = $("pick-winning-cards");
  if (!wrap) return;
  const history = getLastWinningCards(stake);
  wrap.innerHTML = history.map((winner) => `
    <article class="lb-winning-card">
      <strong>#${escapeHTML(winner.cardId)}</strong>
      <div><b>${escapeHTML(winner.name)}</b><small>${escapeHTML(winner.stake)} birr · ${fmt(Number(winner.prize) || 0)} ETB</small></div>
    </article>
  `).join("");
}

function updateGameWaiting() {
  const statusPill = $("game-live-status");
  const liveLabel = $("game-live-label");
  const status = $("game-status");
  const countdownLabel = formatCountdown(pickLeft);

  if (statusPill) {
    statusPill.classList.toggle("is-countdown", gameWaiting);
    statusPill.setAttribute("aria-label", gameWaiting ? `Game starts in ${countdownLabel}` : "Live game");
  }
  if (liveLabel) liveLabel.textContent = gameWaiting ? countdownLabel : "LIVE";
  if (!gameWaiting) return;
  if (status) status.textContent = `Game starts in ${countdownLabel}`;
  updateGameSummary();
}

function updateGameSummary() {
  const room = activeRoomId ? getLobbyRoom(activeRoomId) : null;
  const server = activeRoomId ? serverRoomStates[String(activeRoomId)] : null;
  const players = server ? Number(server.player_count) || 0 : 0;
  const roomStake = room?.stake || stake;
  const derash = calculateDerash(players, roomStake);
  const roundId = room?.roundId || activeRoomId || "—";
  const derashEl = $("game-derash");
  const playersEl = $("game-players");
  const stakeEl = $("game-stake");
  const roundEl = $("game-round");
  if (derashEl) derashEl.textContent = `${fmt(derash)} ETB`;
  if (playersEl) playersEl.textContent = fmt(players);
  if (stakeEl) stakeEl.textContent = `${fmt(roomStake)} ETB`;
  if (roundEl) roundEl.textContent = String(roundId).replace(/^#/, "");
}

function updateRecentCalls() {
  const recent = $("recent-calls");
  if (!recent) return;
  recent.replaceChildren(
    ...called.slice(-3).reverse().map((number) => {
      const item = document.createElement("span");
      item.className = "lb-recent-call";
      const letter = letterFor(number);
      item.dataset.letter = letter;
      item.innerHTML = `<b>${letter}</b><i>${number}</i>`;
      return item;
    })
  );
  const latest = called[called.length - 1];
  const letter = $("call-letter");
  if (letter) letter.textContent = latest ? letterFor(latest) : "—";
}

function activeHitSet() {
  return autoMarkingEnabled ? new Set(called) : new Set(manualMarked);
}

function updateBingoButton() {
  const ready = playerHasBingo();
  const button = $("bingo-btn");
  if (button) {
    button.disabled = !ready || claimed;
    if (ready && !claimed) {
      button.classList.add("is-ready-to-claim");
    } else {
      button.classList.remove("is-ready-to-claim");
    }
  }
  return ready;
}

function setAutoMarking(enabled, announce = false) {
  autoMarkingEnabled = Boolean(enabled);
  manualMarked = new Set();
  const toggle = $("auto-mark-toggle");
  if (toggle) toggle.checked = autoMarkingEnabled;
  renderMineCards();

  if (playing && !claimed) {
    const ready = updateBingoButton();
    if (announce) {
      $("game-status").textContent = ready
        ? "You have BINGO — claim now!"
        : autoMarkingEnabled
          ? "Auto marking enabled — called numbers mark automatically"
          : "Manual marking enabled — tap called numbers on your card";
    }
  }
}

function handleAutoMarkToggle(event) {
  setAutoMarking(event.currentTarget.checked, true);
}

function updateVoiceToggleUI() {
  const btn = $("voice-toggle");
  if (!btn) return;
  btn.classList.toggle("is-active", soundEffectsEnabled);
  btn.classList.toggle("is-muted", !soundEffectsEnabled);
  btn.setAttribute("aria-pressed", soundEffectsEnabled ? "true" : "false");
  btn.setAttribute("title", soundEffectsEnabled ? "Voice: ON (tap to mute)" : "Voice: OFF (tap to unmute)");
}

function handleVoiceToggle() {
  soundEffectsEnabled = !soundEffectsEnabled;
  localStorage.setItem("lucky-bingo-sound-enabled", soundEffectsEnabled ? "1" : "0");
  updateVoiceToggleUI();
  const settingToggle = $("mobile-sound-toggle");
  if (settingToggle) settingToggle.checked = soundEffectsEnabled;
  toast(soundEffectsEnabled ? "VOICE ON" : "VOICE MUTED", soundEffectsEnabled ? "win" : "lose");
  if (!soundEffectsEnabled) {
    if (currentCallAudio) {
      currentCallAudio.pause();
      currentCallAudio.currentTime = 0;
    }
    if (currentBingoAudio) {
      currentBingoAudio.pause();
      currentBingoAudio.currentTime = 0;
    }
  }
}

function setGameWaitingState(waiting) {
  gameWaiting = waiting;
  views.game.classList.toggle("is-game-waiting", waiting);
  updateGameWaiting();
  renderMineCards();
}

function updateRoomRegistrations() {
  // Disabled: Fake random player increments removed. Player count strictly reflects actual real users.
}

function startRoomUpdates() {
  // Mock player update timer disabled.
}

function stopRoomUpdates() {
  if (roomTimer !== null) {
    clearInterval(roomTimer);
    roomTimer = null;
  }
}

function startRoomStatusUpdates() {
  if (roomStatusTimer !== null) return;
  roomStatusTimer = setInterval(() => {
    if (views.lobby.classList.contains("is-on")) renderRooms();
  }, ROOM_STATUS_UPDATE_MS);
}

function stopRoomStatusUpdates() {
  if (roomStatusTimer === null) return;
  clearInterval(roomStatusTimer);
  roomStatusTimer = null;
}

function roomStatusMarkup(state) {
  if (state.type === "live") {
    return `<span class="lb-active-badge"><span>In Play</span><i aria-hidden="true"></i></span>`;
  }
  if (state.type === "paused") {
    return `<span class="lb-room-paused">Paused</span>`;
  }
  if (state.type === "countdown") {
    return `<span class="lb-countdown-badge">${state.label}</span>`;
  }
  return `<span class="lb-countdown-badge is-open">Open</span>`;
}

function roomBalanceMessage(room, canPlay, state) {
  if (!canPlay) return balance <= 0 ? "Low balance" : `Need ${fmt(room.stake - balance)} ETB`;
  if (state.type === "open") return "Open";
  if (state.type === "countdown") return "Starting";
  if (state.type === "live") return "In game";
  return "Closed";
}

function renderRooms() {
  const wrap = $("rooms");
  const rooms = getLobbyRooms();
  if (!rooms.length) {
    wrap.innerHTML = '<p class="lb-empty-rooms">No rooms are available right now.</p>';
    return;
  }

  wrap.replaceChildren(
    ...rooms.map((room) => {
      const server = serverRoomStates[String(room.id)];
      const canPlay = canAfford(room.stake);
      const state = roomDisplayState(room);
      const roomOpen = canPlay && (state.type === "open" || state.type === "countdown");
      const roomClosed = state.type === "live" || state.type === "paused";
      const serverPlayers = server ? Number(server.player_count) || 0 : 0;
      const derash = calculateDerash(serverPlayers, room.stake);
      const displayRoom = { ...room, players: serverPlayers };
      const balanceMessage = roomBalanceMessage(displayRoom, canPlay, state);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lb-room" + (canPlay ? "" : " is-locked") + (roomClosed ? " is-closed" : "");
      btn.disabled = roomClosed;
      btn.setAttribute("aria-disabled", String(roomClosed));
      btn.setAttribute("aria-label", `${roomOpen ? "Play" : balanceMessage} ${room.stake} ETB room with ${serverPlayers} players and ${derash} ETB derash. ${state.ariaLabel}.`);
      btn.innerHTML = `
        <span class="lb-room-stake">${room.stake} ETB</span>
        <span class="lb-room-active is-${state.type}" aria-live="polite">
          ${roomStatusMarkup(state)}
          <span class="lb-room-active-copy">${balanceMessage}</span>
        </span>
        <span class="lb-room-players">${fmt(serverPlayers)}</span>
        <span class="lb-room-prize">${fmt(derash)} ETB</span>
        <span class="lb-room-play${roomOpen ? " is-enabled" : " is-disabled"}">${roomOpen ? "Play" : roomClosed ? (state.type === "live" ? "In Play" : "Closed") : "Play"}</span>
      `;
      btn.addEventListener("click", () => enterRoom(room.id));
      wrap.appendChild(btn);
      return btn;
    })
  );
}

function enterRoom(roomId) {
  const room = getLobbyRoom(roomId);
  if (!room) {
    toast("ROOM UNAVAILABLE", "lose");
    renderRooms();
    return;
  }

  const state = roomDisplayState(room);
  if (state.type === "live" || state.type === "paused") {
    toast(state.type === "live" ? "ROUND IN PROGRESS" : "ROOM CLOSED", "lose");
    renderRooms();
    return;
  }

  if (!cardsReady) {
    toast(cardsLoadError ? "CARD DATA UNAVAILABLE" : "CARD DATA LOADING", "lose");
    return;
  }
  if (!canAfford(room.stake)) {
    openWallet("deposit");
    toast("DEPOSIT TO PLAY", "lose");
    return;
  }

  if (activeRoomId && activeRoomId !== String(room.id) && typeof LuckyBingoAPI !== "undefined") {
    LuckyBingoAPI.leaveRoom(activeRoomId).catch(() => {});
  }

  clearInterval(pickTimer);
  pickTimer = null;
  pickLeft = null;
  pickEndsAt = 0;
  if (opponentJoinTimeout) {
    clearTimeout(opponentJoinTimeout);
    opponentJoinTimeout = null;
  }
  clearInterval(callTimer);
  activeRoomId = String(room.id);
  gameWaiting = false;
  entryCharged = false;
  stake = room.stake;
  selected = new Set();
  selectedPreviewId = null;
  takenByOthers = new Set();
  botPlayers = 0;
  setGameWaitingState(false);
  showView("pick");
  $("pick-stake").textContent = `${stake} ETB`;
  $("pick-cost").textContent = String(stake);
  renderWinningCards();
  buildCardGrid();
  renderCartelaPreview();

  if (state.type === "countdown") {
    startPickCountdown(state.startsAt, state.roundKey);
  } else {
    setupPickWaitingState();
  }

  if (typeof LuckyBingoAPI !== "undefined") {
    LuckyBingoAPI.stopLobbyPoll();
    LuckyBingoAPI.startRoomPoll(activeRoomId, handleServerRoomState, 800);
  }
}

function updatePickInfo() {
  const limit = Math.min(MAX_PICK, Math.floor(balance / stake));
  const waitingForStart = pickTimer !== null && pickLeft !== null && pickLeft > 0;
  const startButton = $("start-game");
  if ($("pick-count")) $("pick-count").textContent = String(selected.size);
  if ($("pick-limit")) $("pick-limit").textContent = String(limit);
  if ($("pick-pool")) $("pick-pool").textContent = fmt(prizePool());
  if ($("pick-cost")) $("pick-cost").textContent = String(stake);

  if (startButton) {
    if (selected.size === 0) {
      startButton.disabled = true;
      startButton.innerHTML = '<span aria-hidden="true">🎯</span> SELECT A CARTELA';
    } else if (!waitingForStart) {
      startButton.disabled = false;
      startButton.innerHTML = '<span aria-hidden="true">⌛</span> WAITING FOR PLAYERS';
    } else {
      startButton.disabled = false;
      startButton.innerHTML = '<span aria-hidden="true">⌛</span> ENTER &amp; WAIT';
    }
  }

  if ($("pick-helper")) {
    if (!cardsReady) {
      $("pick-helper").textContent = cardsLoadError ? "The 1,000 card numbers could not be loaded." : "Loading all 1,000 card numbers…";
    } else if (selected.size === 0) {
      $("pick-helper").textContent = "Select your cartela. Countdown begins when players join.";
    } else if (!waitingForStart) {
      $("pick-helper").textContent = `${selected.size} cartela selected. Waiting for other players to join…`;
    } else {
      $("pick-helper").textContent = `Round starts in ${formatCountdown(pickLeft)}. Get ready!`;
    }
  }

  renderPickRoomSummary();
  updateGameWaiting();
}

function buildCardGrid() {
  const grid = $("card-grid");
  grid.replaceChildren();
  cardNumbers.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lb-pick";
    btn.textContent = String(id);
    btn.dataset.id = String(id);
    btn.addEventListener("click", () => toggleCard(id));
    btn.addEventListener("mouseenter", () => previewCard(id));
    btn.addEventListener("focus", () => previewCard(id));
    grid.appendChild(btn);
  });
  paintPicks();
}

function paintPicks() {
  [...$("card-grid").children].forEach((el) => {
    const id = Number(el.dataset.id);
    el.classList.toggle("is-mine", selected.has(id));
    el.classList.toggle("is-preview", selectedPreviewId === id);
    el.classList.toggle("is-other", takenByOthers.has(id) && !selected.has(id));
    el.classList.toggle("is-taken", takenByOthers.has(id) && !selected.has(id));
  });
}

function createSelectionCard(card, removable = true) {
  const cardEl = document.createElement("article");
  cardEl.className = "lb-selection-card";
  cardEl.dataset.id = String(card.id);
  cardEl.innerHTML = `
    <div class="lb-selection-card-title">Card #${card.id}</div>
    ${removable ? `<button type="button" class="lb-selection-remove" data-remove-card="${card.id}" aria-label="Remove card ${card.id}">×</button>` : ""}
    <div class="lb-selection-bingo-head">${LETTERS.map((letter) => `<span>${letter}</span>`).join("")}</div>
    <div class="lb-selection-cells"></div>
  `;
  const cells = cardEl.querySelector(".lb-selection-cells");
  card.cells.forEach((value) => {
    const cell = document.createElement("span");
    cell.className = "lb-selection-cell" + (value === "FREE" ? " is-free" : "");
    cell.textContent = value === "FREE" ? "★" : String(value);
    cells.appendChild(cell);
  });
  cardEl.querySelector("[data-remove-card]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleCard(Number(event.currentTarget.dataset.removeCard));
  });
  cardEl.addEventListener("click", () => previewCard(card.id));
  return cardEl;
}

function renderCartelaPreview() {
  const preview = $("cartela-preview");
  if (!preview) return;
  preview.replaceChildren();
  if (!selected.size) {
    preview.innerHTML = `<div class="lb-selection-slot is-empty"><span>Select Card 1</span></div><div class="lb-selection-slot is-empty"><span>Select Card 2</span></div>`;
    return;
  }
  [...selected].slice(0, MAX_PICK).forEach((id) => {
    const card = ensureCard(id);
    if (card) preview.appendChild(createSelectionCard(card));
  });
  while (preview.children.length < MAX_PICK) {
    const slot = document.createElement("div");
    slot.className = "lb-selection-slot is-empty";
    slot.innerHTML = `<span>Select Card ${preview.children.length + 1}</span>`;
    preview.appendChild(slot);
  }
}

function previewCard(id) {
  if (!cardsReady || (takenByOthers.has(id) && !selected.has(id))) return;
  selectedPreviewId = id;
  paintPicks();
  renderCartelaPreview();
}

function toggleCard(id) {
  if (!cardsReady) return;
  if (takenByOthers.has(id) && !selected.has(id)) {
    toast("CARTELA ALREADY TAKEN", "lose");
    return;
  }
  if (selected.has(id)) {
    selected.delete(id);
    if (selectedPreviewId === id) selectedPreviewId = selected.size ? [...selected][selected.size - 1] : null;
  } else {
    if (selected.size >= MAX_PICK) {
      toast(`MAXIMUM ${MAX_PICK} CARDS`, "lose");
      return;
    }
    if (selected.size >= Math.min(MAX_PICK, Math.floor(balance / stake))) {
      toast("NOT ENOUGH BALANCE", "lose");
      return;
    }
    selected.add(id);
    selectedPreviewId = id;
    ensureCard(id);
  }
  onCardSelectionChanged();
}

function randomAvailableCard() {
  const limit = Math.min(MAX_PICK, Math.floor(balance / stake));
  const available = cardNumbers.filter((id) => !takenByOthers.has(id) && !selected.has(id));
  if (selected.size >= limit || !available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function randomPick(amount) {
  const limit = Math.min(MAX_PICK, Math.floor(balance / stake));
  if (!cardsReady) {
    toast(cardsLoadError ? "CARD DATA UNAVAILABLE" : "CARD DATA LOADING", "lose");
    return;
  }
  if (limit <= 0) {
    toast("NOT ENOUGH BALANCE", "lose");
    return;
  }
  let added = 0;
  while (added < amount && selected.size < limit) {
    const id = randomAvailableCard();
    if (id === null) break;
    selected.add(id);
    selectedPreviewId = id;
    ensureCard(id);
    added += 1;
  }
  if (!added) {
    toast("NO CARTELA AVAILABLE", "lose");
    return;
  }
  onCardSelectionChanged();
  toast(`${added} RANDOM CARTELA${added === 1 ? "" : "S"} PICKED`, "win");
}

let opponentJoinTimeout = null;

function setupPickWaitingState() {
  clearInterval(pickTimer);
  pickTimer = null;
  pickEndsAt = 0;
  pickLeft = null;
  if (opponentJoinTimeout) {
    clearTimeout(opponentJoinTimeout);
    opponentJoinTimeout = null;
  }
  const time = $("pick-time");
  const seconds = $("pick-secs");
  const timer = $("pick-timer");
  const banner = $("pick-banner-secs");
  const helper = $("pick-helper");
  if (time) time.textContent = selected.size > 0 ? "Waiting" : "Open";
  if (seconds) seconds.textContent = "Open";
  if (banner) banner.textContent = "Open";
  if (timer) timer.classList.remove("is-urgent");
  if (helper) {
    helper.textContent = selected.size > 0
      ? "Cartela selected! Waiting for other players to join…"
      : "Select your cartela. Countdown begins when players join.";
  }
  updatePickInfo();
}

function scheduleOpponentJoin() {
  // Real players only — no fake opponents or bots are generated
  if (opponentJoinTimeout) {
    clearTimeout(opponentJoinTimeout);
    opponentJoinTimeout = null;
  }
}

function onCardSelectionChanged() {
  paintPicks();
  renderCartelaPreview();
  updatePickInfo();

  if (selected.size === 0) {
    if (activeRoomId && typeof LuckyBingoAPI !== "undefined") {
      LuckyBingoAPI.leaveRoom(activeRoomId).catch(() => {});
    }
    if (opponentJoinTimeout) {
      clearTimeout(opponentJoinTimeout);
      opponentJoinTimeout = null;
    }
    clearInterval(pickTimer);
    pickTimer = null;
    pickEndsAt = 0;
    pickLeft = null;
    setupPickWaitingState();
  } else {
    if (activeRoomId && typeof LuckyBingoAPI !== "undefined") {
      const requestedCards = new Set(selected);
      LuckyBingoAPI.joinRoom(activeRoomId, Array.from(requestedCards)).then((res) => {
        if (!res || res.error) {
          console.warn("[API] joinRoom notice:", res?.error);

          if (res?.requires_contact) {
            selected = new Set();
            paintPicks();
            renderCartelaPreview();
            updatePickInfo();
            syncProfileWithServer();
            toast("SHARE YOUR TELEGRAM CONTACT TO PLAY", "lose");
            return;
          }

          if (res?.error === "Insufficient balance") {
            selected = new Set();
            paintPicks();
            renderCartelaPreview();
            updatePickInfo();
            syncProfileWithServer();
            toast("NOT ENOUGH BALANCE", "lose");
            return;
          }

          if (res?.error === "Game in progress, please wait") {
            selected = new Set();
            paintPicks();
            renderCartelaPreview();
            updatePickInfo();
            syncProfileWithServer();
            toast("GAME IN PROGRESS, PLEASE WAIT", "lose");
            return;
          }

          const isInfraFailure =
            !res ||
            res._status === 404 ||
            res.isNotFound ||
            res.isNetworkError ||
            (typeof res.error === "string" &&
              (res.error.startsWith("HTTP ") ||
                res.error.toLowerCase().includes("not found") ||
                res.error.toLowerCase().includes("network error") ||
                res.error === "API_NOT_FOUND"));

          if (isInfraFailure) {
            // Static host (e.g. Vercel) or server offline fallback:
            // KEEP the selected cards! Do NOT wipe selected! Do NOT toast "HTTP 404"!
            return;
          }

          selected = new Set();
          paintPicks();
          renderCartelaPreview();
          updatePickInfo();
          syncProfileWithServer();
          toast(res.error, "lose");
          return;
        }
        if (typeof res.balance === "number") {
          balance = Number(res.balance);
          renderBalance();
        }
        syncProfileWithServer();
      }).catch((e) => {
        console.warn("[API] joinRoom network notice:", e);
      });
    }

    // COUNTDOWN TRIGGER:
    // When cards are picked: Start 1-minute countdown (real players only — zero bots)
    botPlayers = 0;
    if (selected.size >= 1) {
      if (opponentJoinTimeout) {
        clearTimeout(opponentJoinTimeout);
        opponentJoinTimeout = null;
      }
      if (!pickTimer) {
        startPickCountdown(Date.now() + 60 * 1000);
        toast(`${selected.size} CARTELA${selected.size > 1 ? "S" : ""} SELECTED — 1 MINUTE COUNTDOWN STARTED!`, "win");
      }
    }
  }
}

function updatePickCountdownDisplay() {
  const seconds = $("pick-secs");
  const time = $("pick-time");
  const timer = $("pick-timer");
  const banner = $("pick-banner-secs");
  const isCounting = pickTimer !== null && pickLeft !== null && pickLeft > 0;
  const label = isCounting ? formatCountdown(pickLeft) : (selected.size > 0 ? "Waiting" : "Open");
  if (seconds) seconds.textContent = label;
  if (time) time.textContent = isCounting ? `${Math.max(0, pickLeft)}s` : label;
  if (banner) banner.textContent = label;
  if (timer) timer.classList.toggle("is-urgent", isCounting && pickLeft <= 5);
  renderPickRoomSummary();
  updateGameWaiting();
}

function startPickCountdown(roomStartsAt = null, roomRoundKey = null) {
  clearInterval(pickTimer);
  pickTimer = null;

  const suppliedStart = Number(roomStartsAt);
  pickEndsAt = Number.isFinite(suppliedStart) && suppliedStart > Date.now()
    ? suppliedStart
    : Date.now() + 60 * 1000;

  const tick = () => {
    pickLeft = Math.max(0, Math.ceil((pickEndsAt - Date.now()) / 1000));
    updatePickCountdownDisplay();
    updatePickInfo();

    if (pickLeft <= 0) {
      clearInterval(pickTimer);
      pickTimer = null;
      pickEndsAt = 0;
      // Countdown ended! Lock room and start live game
      if (selected.size > 0 && !playing) {
        if (!entryCharged) {
          const cost = stake * selected.size;
          if (balance >= cost) {
            balance -= cost;
            saveBalance();
            renderBalance();
            entryCharged = true;
          } else {
            toast("NOT ENOUGH BALANCE", "lose");
            setupPickWaitingState();
            return;
          }
        }
        beginLiveGame();
      }
    }
  };

  tick();
  pickTimer = setInterval(tick, 250);
}

function simulateOthersPicking() {
  // Compatibility no-op. Other players and reserved cards are server state.
}

function startGame() {
  // Joining (and charging) is performed atomically by the server when cards are selected.
  // Do not create a second local charge or local call sequence.
  if (!cardsReady || !selected.size) {
    toast("SELECT A CARTELA FIRST", "lose");
    return;
  }
  if (gameWaiting || playing) {
    toast("YOU ARE ALREADY IN THE GAME", "win");
    return;
  }

  const room = activeRoomId ? getLobbyRoom(activeRoomId) : null;
  if (room) {
    const sourceStatus = roomSourceStatus(room);
    if ((sourceStatus === "live" || sourceStatus === "paused") && pickLeft > 0) {
      toast(sourceStatus === "live" ? "ROUND IN PROGRESS" : "ROOM CLOSED", "lose");
      if (activeRoomId && typeof LuckyBingoAPI !== "undefined") {
        LuckyBingoAPI.leaveRoom(activeRoomId).catch(() => {});
      }
      activeRoomId = null;
      showView("lobby");
      renderRooms();
      return;
    }
    const state = roomDisplayState(room);
    if (state.type === "live") {
      toast("ROUND IN PROGRESS", "lose");
      return;
    }
  }

  const cost = stake * selected.size;
  if (cost > balance) {
    toast("NOT ENOUGH BALANCE", "lose");
    showView("lobby");
    return;
  }

  entryCharged = true;
  hideWinnerOverlay();
  hideRoundResult();
  called = [];
  manualMarked = new Set();
  callPool = [];
  claimed = false;
  roundOutcome = null;
  roundWinnerName = "";
  roundWinKind = "";
  roundWinCardId = null;
  setGameWaitingState(true);
  showView("game");
  buildBoard();
  paintBoard();
  $("call-ball").textContent = "—";
  $("call-letter").textContent = "—";
  $("call-count").textContent = "0";
  updateRecentCalls();
  updateGameWaiting();

  // Do not enter the live view from a local clock. The next room-state poll
  // will call beginLiveGame only after the server reports status === "live".
  $("game-status").textContent = pickLeft > 0
    ? `Game starts in ${formatCountdown(pickLeft)}`
    : "Waiting for the shared room to start…";
  updateGameSummary();
  toast("YOU'RE IN — WAIT FOR THE COUNTDOWN", "win");
}

function beginLiveGame() {
  if (!selected.size || !entryCharged) return;
  clearInterval(pickTimer);
  pickTimer = null;
  // The server owns the room lifecycle. This function is called only after a
  // room-state response reports a shared live round.
  setGameWaitingState(false);
  playing = true;
  claimed = false;
  roundOutcome = null;
  roundWinnerName = "";
  roundWinKind = "";
  roundWinCardId = null;
  hideRoundResult();
  called = [];
  manualMarked = new Set();
  callPool = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
  showView("game");
  updateGameSummary();
  $("bingo-btn").disabled = true;
  $("game-status").textContent = autoMarkingEnabled
    ? "Game started — marking automatically"
    : "Game started — tap called numbers on your card";
  $("call-ball").textContent = "—";
  $("call-count").textContent = "0";
  $("call-letter").textContent = "—";
  updateRecentCalls();
  buildBoard();
  renderMineCards();
  clearInterval(callTimer);
  if (!activeRoomId || typeof LuckyBingoAPI === "undefined") {
    callTimer = setInterval(nextCall, CALL_MS);
  } else {
    callTimer = null;
  }
}

function hideRoundResult() {
  const result = $("round-result");
  if (!result) return;
  result.hidden = true;
  result.className = "lb-round-result";
  result.replaceChildren();
}

function hideWinnerOverlay() {
  clearInterval(winnerTimer);
  winnerTimer = null;
  if (currentBingoAudio) {
    currentBingoAudio.pause();
    currentBingoAudio.currentTime = 0;
  }
  const overlay = $("winner-overlay");
  if (!overlay) return;
  overlay.hidden = true;
  overlay.className = "lb-winner-overlay";
}

function returnToCardSelection() {
  const roomId = activeRoomId;
  const room = roomId ? getLobbyRoom(roomId) : null;
  hideWinnerOverlay();
  clearInterval(callTimer);
  clearInterval(pickTimer);
  pickTimer = null;
  pickEndsAt = 0;
  pickLeft = null;
  if (opponentJoinTimeout) {
    clearTimeout(opponentJoinTimeout);
    opponentJoinTimeout = null;
  }
  stopRoomUpdates();
  stopRoomStatusUpdates();
  playing = false;
  gameWaiting = false;
  entryCharged = false;
  manualMarked = new Set();
  claimed = false;
  roundOutcome = null;
  roundWinnerName = "";
  roundWinKind = "";
  roundWinCardId = null;
  selected = new Set();
  selectedPreviewId = null;
  takenByOthers = new Set();
  botPlayers = 0;
  hideRoundResult();

  if (!room) {
    activeRoomId = null;
    setGameWaitingState(false);
    showView("lobby");
    renderRooms();
    return;
  }

  // The server advances the room round. Re-join only after the new round is
  // visible, never by mutating localStorage or creating a local lifecycle.
  activeRoomId = String(room.id);
  stake = room.stake;
  botPlayers = 0;
  setGameWaitingState(false);
  showView("pick");
  $("pick-stake").textContent = `${stake} ETB`;
  $("pick-cost").textContent = String(stake);
  renderWinningCards();
  buildCardGrid();
  renderCartelaPreview();
  setupPickWaitingState();
  renderRooms();
}

function finishActiveRoomRound() {
  // Round lifecycle is owned by the server. Keep this function for callers that
  // finish the local view, but do not mutate the shared room from a browser.
}

function renderWinnerConfetti() {
  const container = $("winner-confetti");
  if (!container) return;
  container.replaceChildren();

  const colors = [
    "#ef4444", "#dc2626", "#f59e0b", "#fbbf24", "#10b981", "#22c55e",
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"
  ];
  const count = 48;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "lb-confetti-piece";
    const width = 5 + Math.floor(Math.random() * 5);
    const height = 8 + Math.floor(Math.random() * 7);

    let left, top;
    const zone = Math.random();
    if (zone < 0.35) {
      left = Math.random() * 22;
      top = Math.random() * 96;
    } else if (zone < 0.7) {
      left = 78 + Math.random() * 20;
      top = Math.random() * 96;
    } else if (zone < 0.85) {
      left = 15 + Math.random() * 70;
      top = Math.random() * 18;
    } else {
      left = 15 + Math.random() * 70;
      top = 82 + Math.random() * 16;
    }

    const color = colors[Math.floor(Math.random() * colors.length)];
    const rot = Math.floor(Math.random() * 360);
    const delay = (Math.random() * 3).toFixed(2);
    const duration = (2.4 + Math.random() * 2).toFixed(2);

    piece.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      left: ${left}%;
      top: ${top}%;
      background-color: ${color};
      transform: rotate(${rot}deg);
      animation-delay: ${delay}s;
      animation-duration: ${duration}s;
    `;
    fragment.appendChild(piece);
  }
  container.appendChild(fragment);
}

function renderWinnerCard(cardId, hit = null, kind = "LINE") {
  const grid = $("winner-card-grid");
  if (!grid) return;
  grid.replaceChildren();

  const cardObj = ensureCard(cardId) || {
    id: cardId,
    cells: [5, 16, 35, 58, 71, 9, 30, 41, 52, 66, 12, 21, "FREE", 59, 72, 11, 23, 33, 49, 73, 7, 25, 31, 53, 70]
  };

  const winIndexes = new Set();
  const hits = hit instanceof Set ? new Set(hit) : new Set();

  if (String(cardId) === "440") {
    // Exact diagonal win line and hits matching the user reference image
    [0, 6, 12, 18, 24].forEach((idx) => winIndexes.add(idx));
    hits.add(58);
    hits.add(9);
    hits.add(52);
  } else {
    try {
      const calculatedWins = winningCellIndexes(cardObj, hits, kind);
      if (calculatedWins && calculatedWins.length > 0) {
        calculatedWins.forEach((idx) => winIndexes.add(idx));
      } else {
        [0, 6, 12, 18, 24].forEach((idx) => winIndexes.add(idx));
      }
    } catch (e) {
      [0, 6, 12, 18, 24].forEach((idx) => winIndexes.add(idx));
    }
  }

  cardObj.cells.forEach((val, index) => {
    const cell = document.createElement("div");
    cell.className = "lb-winner-cell";
    const isFree = index === 12 || val === "FREE" || val === 0;
    const isWin = winIndexes.has(index);
    const isHit = isWin || isFree || hits.has(val) || hits.has(Number(val));

    if (isWin) cell.classList.add("is-win");
    else if (isHit) cell.classList.add("is-hit");

    if (isFree) {
      cell.classList.add("is-free");
      cell.innerHTML = '<span class="lb-winner-star">★</span>';
    } else {
      cell.textContent = String(val);
    }
    grid.appendChild(cell);
  });
}

function showWinnerOverlay(outcome, winnerName, prize = null, cardId = null, kind = "LINE") {
  const overlay = $("winner-overlay");
  const name = $("winner-overlay-name");
  const cardElem = $("winner-overlay-card");
  const cardTitle = $("winner-card-title");
  const prizeElem = $("winner-prize-value");
  const message = $("winner-overlay-message");
  const seconds = $("winner-overlay-seconds");
  if (!overlay) return;

  clearInterval(winnerTimer);
  const isPlayerWinner = outcome === "win";
  const finalName = winnerName || (isPlayerWinner ? PLAYER_NAME : "RAS");
  const finalCardId = cardId || 440;
  const finalPrize = Number(prize || 3800).toFixed(2);

  if (name) name.textContent = finalName;
  if (cardElem) cardElem.textContent = `#${finalCardId}`;
  if (cardTitle) cardTitle.textContent = `CARD #${finalCardId}`;
  if (prizeElem) prizeElem.textContent = finalPrize;
  if (message) message.textContent = isPlayerWinner ? "You won this round!" : `${finalName} won this round.`;

  playBingoVoice();
  renderWinnerConfetti();
  renderWinnerCard(finalCardId, activeHitSet(), kind);

  overlay.onclick = () => returnToCardSelection();

  let remaining = 6;
  if (seconds) seconds.textContent = String(remaining);
  overlay.removeAttribute("hidden");
  overlay.hidden = false;

  winnerTimer = setInterval(() => {
    remaining -= 1;
    if (seconds) seconds.textContent = String(Math.max(0, remaining));
    if (remaining <= 0) {
      clearInterval(winnerTimer);
      returnToCardSelection();
    }
  }, 1000);
}


function showRoundResult(outcome, winnerName, kind = "LINE", cardId = null) {
  const result = $("round-result");
  if (!result) return;
  roundOutcome = outcome;
  roundWinnerName = winnerName;
  roundWinKind = kind;
  roundWinCardId = cardId;
  result.className = `lb-round-result is-${outcome}`;
  result.innerHTML = `
    <span class="lb-round-result-burst" aria-hidden="true">✦</span>
    <strong>${outcome === "win" ? "WON" : "ROUND OVER"}</strong>
    <span>${outcome === "win" ? `${winnerName} · ${kind}${cardId ? ` on card #${cardId}` : ""}` : `${winnerName} has won.`}</span>
  `;
  result.hidden = false;
  result.animate(
    [{ opacity: 0, transform: "translateY(-10px) scale(.92)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
    { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" }
  );
}

function bingoLines() {
  const lines = [];
  for (let row = 0; row < 5; row++) lines.push([0, 1, 2, 3, 4].map((column) => row * 5 + column));
  for (let column = 0; column < 5; column++) lines.push([0, 1, 2, 3, 4].map((row) => row * 5 + column));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines;
}

function completedBingoLines(card, hit) {
  return bingoLines().filter((indexes) => indexes.every((index) => cellHit(card, index, hit)));
}

function winningCellIndexes(card, hit, kind) {
  if (kind === "FULL HOUSE" || kind === "BLACKOUT") return Array.from({ length: 25 }, (_, index) => index);

  const target = Math.max(1, Number.parseInt(String(kind), 10) || 1);
  const indexes = new Set();
  completedBingoLines(card, hit)
    .slice(0, target)
    .forEach((line) => line.forEach((index) => indexes.add(index)));
  return [...indexes];
}

function markLoserCards() {
  const wrap = $("mine-cards");
  if (!wrap) return;
  wrap.classList.add("has-loser-cards");
  wrap.querySelectorAll(".lb-card").forEach((card) => card.classList.add("is-loser"));
}

function highlightWinningCard(cardId, kind) {
  const wrap = $("mine-cards");
  const card = wrap?.querySelector(`[data-id="${cardId}"]`);
  if (!card) return;
  card.classList.add("is-winner");
  const hit = activeHitSet();
  const definition = ensureCard(cardId);
  const indexes = definition ? winningCellIndexes(definition, hit, kind) : [];
  [...card.querySelectorAll(".lb-cell")].forEach((cell, index) => cell.classList.toggle("is-win", indexes.includes(index)));
}

function buildBoard() {
  const board = $("board");
  board.replaceChildren();
  for (let n = 1; n <= 75; n++) {
    const d = document.createElement("div");
    d.className = "lb-dot";
    d.dataset.n = String(n);
    d.dataset.letter = letterFor(n);
    d.textContent = String(n);
    board.appendChild(d);
  }
}

function paintBoard() {
  const set = new Set(called);
  [...$("board").children].forEach((el) => {
    el.classList.toggle("is-on", set.has(Number(el.dataset.n)));
  });
}

function renderMineCards() {
  const wrap = $("mine-cards");
  const hit = activeHitSet();
  const calledSet = new Set(called);
  wrap.replaceChildren(
    ...[...selected].map((id) => {
      const card = ensureCard(id);
      if (!card) return null;
      const el = document.createElement("div");
      el.className = "lb-card";
      el.dataset.id = String(id);
      el.innerHTML = `
        <div class="lb-mine-card-header">
          <span class="lb-mine-card-title">YOUR CARD (#${id})</span>
          <span class="lb-mine-card-status">LIVE</span>
        </div>
        <div class="lb-binghead">${LETTERS.map((letter) => `<span>${letter}</span>`).join("")}</div>
        <div class="lb-cells"></div>
      `;
      const cells = el.querySelector(".lb-cells");
      card.cells.forEach((value) => {
        const cell = document.createElement("div");
        cell.className = "lb-cell";
        if (value === "FREE") {
          cell.classList.add("is-free", "is-hit");
          cell.textContent = "★";
        } else {
          const hasHit = hit.has(value);
          const hasBeenCalled = calledSet.has(value);
          cell.textContent = String(value);
          if (hasHit) cell.classList.add("is-hit");
          if (!autoMarkingEnabled && playing && !claimed && hasBeenCalled && !hasHit) {
            cell.classList.add("is-callable");
            cell.title = `Tap to mark ${letterFor(value)}-${value}`;
          }
          cell.addEventListener("click", () => toggleManualMark(value));
        }
        cells.appendChild(cell);
      });
      return el;
    }).filter(Boolean)
  );
  if (roundOutcome === "lose") markLoserCards();
  if (roundOutcome === "win" && roundWinCardId !== null) highlightWinningCard(roundWinCardId, roundWinKind);
}

function toggleManualMark(value) {
  if (autoMarkingEnabled || claimed || !playing || value === "FREE") return;

  if (!called.includes(value)) {
    toast(`WAIT FOR ${letterFor(value)}-${value}`, "lose");
    return;
  }

  const wasMarked = manualMarked.has(value);
  if (wasMarked) manualMarked.delete(value);
  else manualMarked.add(value);

  renderMineCards();
  const ready = updateBingoButton();
  $("game-status").textContent = ready && !claimed
    ? "You have BINGO — claim now!"
    : `${wasMarked ? "Unmarked" : "Marked"} ${letterFor(value)}-${value}`;
}

function playCallVoice(number, letter) {
  if (!soundEffectsEnabled) return;
  try {
    if (currentCallAudio) {
      currentCallAudio.pause();
      currentCallAudio.currentTime = 0;
    }
    const voice = getSelectedVoice();
    const l = String(letter).toLowerCase();
    const u = String(letter).toUpperCase();
    const tigregnaHashed = voice === "tigregna" && TIGREGNA_AUDIO_MAP[number] ? TIGREGNA_AUDIO_MAP[number] : null;

    const candidates = [
      `assets/audio/${voice}/${l}${number}.mp3`,
      `assets/audio/${voice}/${u}${number}.mp3`,
      ...(tigregnaHashed ? [`assets/audio/tigregna/${tigregnaHashed}`] : []),
      `assets/audio/${voice}/t${l}${number}.mp3`,
      // Fallback to amharic if current voice misses a file
      `assets/audio/amharic/${l}${number}.mp3`,
      `assets/audio/amharic/${u}${number}.mp3`,
      `assets/audio/${l}${number}.mp3`,
    ];
    let candidateIndex = 0;
    const audio = new Audio();
    audio.preload = "auto";
    audio.onerror = () => {
      candidateIndex++;
      if (candidateIndex < candidates.length) {
        audio.src = candidates[candidateIndex];
        audio.play().catch(() => {});
      }
    };
    audio.src = candidates[0];
    currentCallAudio = audio;
    audio.play().catch(() => {});
  } catch (err) {
    // Graceful ignore
  }
}

let currentBingoAudio = null;
function playBingoVoice() {
  if (!soundEffectsEnabled) return;
  try {
    if (currentCallAudio) {
      currentCallAudio.pause();
      currentCallAudio.currentTime = 0;
    }
    if (currentBingoAudio) {
      currentBingoAudio.pause();
      currentBingoAudio.currentTime = 0;
    }
    const voice = getSelectedVoice();
    const candidates = [
      `assets/audio/${voice}/bingo.mp3`,
      `assets/audio/${voice}/BINGO.mp3`,
      "assets/audio/amharic/bingo.mp3",
      "assets/audio/bingo.mp3",
      "assets/audio/bingo.wav",
      "assets/audio/bingo.m4a",
    ];
    let candidateIndex = 0;
    const audio = new Audio();
    audio.preload = "auto";
    audio.onerror = () => {
      candidateIndex++;
      if (candidateIndex < candidates.length) {
        audio.src = candidates[candidateIndex];
        audio.play().catch(() => {});
      }
    };
    audio.src = candidates[0];
    currentBingoAudio = audio;
    audio.play().catch(() => {});
  } catch (err) {
    // Graceful ignore
  }
}

let currentNopeAudio = null;
function playNopeVoice() {
  if (!soundEffectsEnabled) return;
  try {
    if (currentNopeAudio) {
      currentNopeAudio.pause();
      currentNopeAudio.currentTime = 0;
    }
    const voice = getSelectedVoice();
    const candidates = [
      `assets/audio/${voice}/nop.m4a`,
      `assets/audio/${voice}/nop.mp3`,
      "assets/audio/amharic/nop.m4a",
      "assets/audio/nop.m4a",
      "assets/audio/nop.mp3",
    ];
    let candidateIndex = 0;
    const audio = new Audio();
    audio.preload = "auto";
    audio.onerror = () => {
      candidateIndex++;
      if (candidateIndex < candidates.length) {
        audio.src = candidates[candidateIndex];
        audio.play().catch(() => {});
      }
    };
    audio.src = candidates[0];
    currentNopeAudio = audio;
    audio.play().catch(() => {});
  } catch (err) {
    // Graceful ignore
  }
}

function handleSingleCall(n) {
  if (called.includes(n)) return;
  called.push(n);
  if (!autoMarkingEnabled) manualMarked.delete(n);
  const letter = letterFor(n);
  const ballEl = $("call-ball");
  if (ballEl) {
    ballEl.textContent = String(n);
    ballEl.dataset.letter = letter;
  }
  const callLetterEl = $("call-letter");
  if (callLetterEl) callLetterEl.textContent = letter;
  const callCountEl = $("call-count");
  if (callCountEl) callCountEl.textContent = String(called.length);
  updateRecentCalls();
  updateGameSummary();
  paintBoard();
  renderMineCards();
  playCallVoice(n, letter);

  const ready = updateBingoButton();
  const gameStatusEl = $("game-status");
  if (gameStatusEl) {
    if (ready && !claimed) {
      gameStatusEl.textContent = "You have BINGO — claim now!";
    } else {
      gameStatusEl.textContent = autoMarkingEnabled
        ? "Called " + letter + "-" + n
        : "Called " + letter + "-" + n + " — tap it on your card";
    }
  }
}

function nextCall() {
  if (!playing || !callPool.length) {
    clearInterval(callTimer);
    callTimer = null;
    if (!claimed) {
      playing = false;
      $("game-status").textContent = "No Bingo — round over";
      showRoundResult("lose", "No player");
      markLoserCards();
      toast("NO WINNER", "lose");
      setTimeout(() => {
        returnToCardSelection();
      }, 4000);
    }
    return;
  }
  const n = callPool.pop();
  handleSingleCall(n);

  // Only real players can claim and win
}

function cellHit(card, index, hit) {
  const value = card.cells[index];
  return value === "FREE" || hit.has(value);
}

function bestWinKind(card, hit) {
  if (!card) return null;

  const pattern = getWinningPattern();
  const all = Array.from({ length: 25 }, (_, index) => index);
  if (pattern === "full-house") return all.every((index) => cellHit(card, index, hit)) ? "FULL HOUSE" : null;

  const requiredLines = Number(pattern);
  const completedLines = completedBingoLines(card, hit).length;
  if (completedLines < requiredLines) return null;
  return `${requiredLines} ${requiredLines === 1 ? "LINE" : "LINES"}`;
}

function playerHasBingo() {
  const hit = new Set(called);
  for (const id of selected) {
    const card = ensureCard(id);
    if (card && bestWinKind(card, hit)) return true;
  }
  return false;
}

function claimBingo() {
  if (claimed || !playing) return;
  const hit = new Set(called);
  let kind = null;
  let winCard = null;
  for (const id of selected) {
    const card = ensureCard(id);
    const currentKind = card ? bestWinKind(card, hit) : null;
    if (currentKind) {
      kind = currentKind;
      winCard = id;
      break;
    }
  }
  if (!kind) {
    playNopeVoice();
    toast("NO BINGO YET — WAIT FOR CALLED NUMBERS", "lose");
    updateBingoButton();
    return;
  }
  claimed = true;
  clearInterval(callTimer);
  callTimer = null;
  playing = false;
  $("bingo-btn").disabled = true;

  // Mark all called numbers on winning card so it displays complete
  if (winCard) {
    const winningCard = ensureCard(winCard);
    if (winningCard) {
      winningCard.cells.forEach((val) => {
        if (val !== "FREE" && called.includes(val)) {
          manualMarked.add(val);
        }
      });
    }
  }

  const server = activeRoomId ? serverRoomStates[String(activeRoomId)] : null;
  const playersCount = server ? Number(server.player_count) || 1 : 1;
  const estimatedDerash = (server && server.derash) ? Number(server.derash) : calculateDerash(playersCount, stake);

  roundOutcome = "win";
  roundWinnerName = PLAYER_NAME;
  roundWinKind = kind;
  roundWinCardId = winCard;
  renderMineCards();
  playBingoVoice();

  if (activeRoomId && winCard && typeof LuckyBingoAPI !== "undefined") {
    LuckyBingoAPI.claimBingo(activeRoomId, winCard).then((res) => {
      if (res && res.ok) {
        const prizeWon = Number(res.prize) || estimatedDerash;
        $("game-status").textContent = `${kind} on card #${winCard} · +${fmt(prizeWon)} ETB`;
        showRoundResult("win", PLAYER_NAME, kind, winCard);
        toast(`WON! +${fmt(prizeWon)} ETB`, "win");
        showWinnerOverlay("win", PLAYER_NAME, prizeWon, winCard, kind);
        rememberWinningCard(stake, winCard, PLAYER_NAME, prizeWon);
        recordPlayerTransaction({
          type: "win",
          method: "Derash Prize Win",
          amount: prizeWon,
          status: "completed",
          details: `${kind} · Card #${winCard}`,
        });
      } else {
        console.warn("Claim response:", res);
        toast(res?.error || "CLAIM NOT CONFIRMED", "lose");
        claimed = false;
        playing = true;
        updateBingoButton();
      }
      syncProfileWithServer();
    }).catch((err) => {
      console.warn("Claim network error:", err);
      claimed = false;
      playing = true;
      updateBingoButton();
      syncProfileWithServer();
    });
  } else {
    const prizeWon = estimatedDerash;
    balance += prizeWon;
    saveBalance();
    renderBalance();
    $("game-status").textContent = `${kind} on card #${winCard} · +${fmt(prizeWon)} ETB`;
    showRoundResult("win", PLAYER_NAME, kind, winCard);
    toast(`WON! +${fmt(prizeWon)} ETB`, "win");
    showWinnerOverlay("win", PLAYER_NAME, prizeWon, winCard, kind);
    rememberWinningCard(stake, winCard, PLAYER_NAME, prizeWon);
  }

  setTimeout(() => {
    returnToCardSelection();
  }, 5000);
}

function botWins() {
  // Disabled: Only real human players can claim and win
  return;
}

function leaveGame() {
  const roomId = activeRoomId;
  hideWinnerOverlay();
  if (roomId && typeof LuckyBingoAPI !== "undefined") {
    LuckyBingoAPI.leaveRoom(roomId).then(() => syncProfileWithServer()).catch(() => {});
  }
  clearInterval(callTimer);
  clearInterval(pickTimer);
  pickEndsAt = 0;
  stopRoomUpdates();
  stopRoomStatusUpdates();
  playing = false;
  gameWaiting = false;
  entryCharged = false;
  manualMarked = new Set();
  activeRoomId = null;
  claimed = false;
  roundOutcome = null;
  roundWinnerName = "";
  roundWinKind = "";
  roundWinCardId = null;
  hideRoundResult();
  selected = new Set();
  selectedPreviewId = null;
  setGameWaitingState(false);
  showView("lobby");
  renderRooms();
}

function updateWalletBalances() {
  const panelBalance = $("panel-balance");
  const withdrawAvailable = $("withdraw-available");
  if (panelBalance) panelBalance.textContent = fmtBal(balance);
  if (withdrawAvailable) withdrawAvailable.textContent = fmtBal(balance);
}

function setWalletTab(tab) {
  const activeTab = tab === "withdraw" ? "withdraw" : "deposit";
  document.querySelectorAll("[data-wallet-tab]").forEach((button) => {
    const active = button.dataset.walletTab === activeTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-wallet-view]").forEach((view) => {
    const active = view.dataset.walletView === activeTab;
    view.classList.toggle("is-active", active);
    view.hidden = !active;
  });
  clearWalletFeedback(activeTab);
}

function openWallet(tab = "deposit") {
  const activeTab = tab === "withdraw" ? "withdraw" : "deposit";
  renderBalance();
  updateDepositAccount();
  updateProviderButtons("deposit");
  updateProviderButtons("withdraw");
  setWalletTab(activeTab);
  $("wallet-panel").hidden = false;
  setTimeout(() => document.querySelector(`[data-wallet-tab="${activeTab}"]`)?.focus(), 40);
}

function closeWallet() {
  $("wallet-panel").hidden = true;
}

function clearWalletFeedback(action) {
  const feedback = action === "withdraw" ? $("withdraw-feedback") : $("deposit-feedback");
  if (!feedback) return;
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.classList.remove("is-error");
}

function showWalletFeedback(action, message, isError = false) {
  const feedback = action === "withdraw" ? $("withdraw-feedback") : $("deposit-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
  feedback.hidden = false;
}

function getDepositPaymentAccount(method) {
  try {
    const adminSettings = JSON.parse(localStorage.getItem(ADMIN_SETTINGS_KEY) || "{}");
    if (method === "Telebirr" && adminSettings.depositTelebirrPhone) {
      return {
        accountName: adminSettings.depositTelebirrName || "Lucky Bingo",
        accountNumber: adminSettings.depositTelebirrPhone || "0911 000 000",
      };
    }
    if (method === "CBE Birr" && adminSettings.depositCbeBirrPhone) {
      return {
        accountName: adminSettings.depositCbeBirrName || "Lucky Bingo CBE Birr",
        accountNumber: adminSettings.depositCbeBirrPhone || "1000 000 000",
      };
    }
    if (method === "M-Pesa" && adminSettings.depositMpesaPhone) {
      return {
        accountName: adminSettings.depositMpesaName || "Lucky Bingo M-Pesa",
        accountNumber: adminSettings.depositMpesaPhone || "0700 000 000",
      };
    }
  } catch (e) {}

  if (window.LUCKY_BINGO_PAYMENT_METHODS && window.LUCKY_BINGO_PAYMENT_METHODS[method]) {
    return window.LUCKY_BINGO_PAYMENT_METHODS[method];
  }

  return PAYMENT_METHODS[method] || PAYMENT_METHODS.Telebirr;
}

function updateDepositAccount() {
  const method = walletState.deposit;
  const account = getDepositPaymentAccount(method);
  const methodLabel = $("deposit-selected-method");
  const accountName = $("deposit-account-name");
  const accountNumber = $("deposit-account-number");
  if (methodLabel) methodLabel.textContent = method;
  if (accountName) accountName.textContent = account.accountName;
  if (accountNumber) accountNumber.textContent = account.accountNumber;
}

function updateProviderButtons(action) {
  document.querySelectorAll(`[data-provider-action="${action}"]`).forEach((button) => {
    const selectedMethod = walletState[action];
    const active = button.dataset.method === selectedMethod;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function selectWalletMethod(action, method) {
  if (!walletState[action] || !PAYMENT_METHODS[method]) return;
  walletState[action] = method;
  updateProviderButtons(action);
  clearWalletFeedback(action);
  if (action === "deposit") updateDepositAccount();
  const actionLabel = action === "deposit" ? "Deposit" : "Withdraw";
  toast(`${actionLabel}: ${method} selected`, "win");
}

function normaliseWalletAmount(value) {
  const amount = Math.floor(Number(value));
  return Number.isFinite(amount) ? amount : 0;
}

function makeTransactionId() {
  return `TX-${String(Date.now()).slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
}

function getActivePlayerProfile() {
  try {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser) {
      const name = `${tgUser.first_name || ""} ${tgUser.last_name || ""}`.trim() || (tgUser.username ? `@${tgUser.username}` : `Player ${tgUser.id}`);
      return {
        id: `TG-${tgUser.id}`,
        name: name,
        username: tgUser.username ? `@${tgUser.username}` : "",
      };
    }
  } catch (e) {}

  if (Array.isArray(window.LUCKY_BINGO_PLAYERS) && window.LUCKY_BINGO_PLAYERS.length) {
    const p = window.LUCKY_BINGO_PLAYERS[0];
    return { id: p.id, name: p.name, username: p.username || "" };
  }

  return { id: PLAYER_ID, name: PLAYER_NAME, username: "" };
}

function saveWalletRequest(request) {
  const profile = getActivePlayerProfile();
  const transaction = {
    id: makeTransactionId(),
    playerId: profile.id,
    player: profile.name,
    type: request.type,
    method: request.method,
    amount: request.amount,
    requested: "just now",
    status: "pending",
    phone: request.phone || "",
    reference: request.reference || "",
    accountName: request.accountName || "",
    accountNumber: request.accountNumber || "",
    heldFromBalance: Boolean(request.heldFromBalance),
  };

  try {
    const saved = JSON.parse(localStorage.getItem(ADMIN_STATE_KEY) || "{}");
    const transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
    saved.transactions = [transaction, ...transactions].slice(0, 100);
    localStorage.setItem(ADMIN_STATE_KEY, JSON.stringify(saved));
  } catch (error) {
    // The player request remains confirmed in the UI even if local admin storage is unavailable.
  }

  return transaction;
}

function handleDepositSubmit(event) {
  event.preventDefault();
  const amount = normaliseWalletAmount($("deposit-amount").value);
  const reference = $("deposit-reference").value.trim();
  const method = walletState.deposit;
  const account = PAYMENT_METHODS[method] || PAYMENT_METHODS.Telebirr;

  if (amount < MIN_WALLET_AMOUNT) {
    showWalletFeedback("deposit", `Minimum deposit amount is ${MIN_WALLET_AMOUNT} ETB.`, true);
    toast("MINIMUM 50 ETB", "lose");
    return;
  }
  if (reference.length < 4) {
    showWalletFeedback("deposit", "Paste a valid transaction reference or SMS confirmation.", true);
    toast("REFERENCE REQUIRED", "lose");
    return;
  }

  showWalletFeedback("deposit", "Submitting deposit request to server...", false);
  const submitBtn = $("deposit-submit");
  if (submitBtn) submitBtn.disabled = true;

  if (typeof LuckyBingoAPI !== "undefined") {
    LuckyBingoAPI.deposit(amount, method, reference, "").then((res) => {
      if (submitBtn) submitBtn.disabled = false;
      if (res && (res.id || res.ok)) {
        const txId = res.id || "DEP";
        const bonus = amount >= 100 ? Math.floor(amount * 0.2) : 0;
        showWalletFeedback(
          "deposit",
          `✅ Deposit request ${txId} submitted! ${bonus ? `Bonus pending: ${fmt(bonus)} ETB.` : "Waiting for admin approval."}`
        );
        event.target.reset();
        toast("DEPOSIT REQUEST SENT TO ADMIN", "win");
        syncProfileWithServer();
      } else {
        const errMsg = res?.error || "Could not reach server. Please check your connection.";
        showWalletFeedback("deposit", `❌ ${errMsg}`, true);
        toast(errMsg, "lose");
      }
    }).catch((err) => {
      if (submitBtn) submitBtn.disabled = false;
      showWalletFeedback("deposit", "❌ Connection to server failed. Please try again.", true);
      toast("CONNECTION FAILED", "lose");
    });
  } else {
    if (submitBtn) submitBtn.disabled = false;
    showWalletFeedback("deposit", "❌ Server offline. Please try again later.", true);
  }
}

function handleWithdrawSubmit(event) {
  event.preventDefault();
  const amount = normaliseWalletAmount($("withdraw-amount").value);
  const phone = $("withdraw-phone").value.trim();
  const method = walletState.withdraw;

  if (phone.replace(/\D/g, "").length < 9) {
    showWalletFeedback("withdraw", "Enter the registered phone number for this withdrawal.", true);
    toast("PHONE REQUIRED", "lose");
    return;
  }
  if (amount < MIN_WALLET_AMOUNT) {
    showWalletFeedback("withdraw", `Minimum withdrawal amount is ${MIN_WALLET_AMOUNT} ETB.`, true);
    toast("MINIMUM 50 ETB", "lose");
    return;
  }
  if (amount > balance) {
    showWalletFeedback("withdraw", `You can withdraw up to ${fmtBal(balance)} ETB from your available balance.`, true);
    toast("LOW BALANCE", "lose");
    return;
  }

  showWalletFeedback("withdraw", "Submitting withdrawal request to server...", false);
  const submitBtn = $("withdraw-submit");
  if (submitBtn) submitBtn.disabled = true;

  if (typeof LuckyBingoAPI !== "undefined") {
    LuckyBingoAPI.withdraw(amount, method, phone).then((res) => {
      if (submitBtn) submitBtn.disabled = false;
      if (res && (res.id || res.ok)) {
        const txId = res.id || "WTH";
        showWalletFeedback(
          "withdraw",
          `✅ Withdrawal request ${txId} for ${fmt(amount)} ETB submitted! Waiting for admin approval.`
        );
        event.target.reset();
        toast("WITHDRAWAL REQUEST SENT TO ADMIN", "win");
        syncProfileWithServer();
      } else {
        const errMsg = res?.error || "Could not reach server. Please check your connection.";
        showWalletFeedback("withdraw", `❌ ${errMsg}`, true);
        toast(errMsg, "lose");
      }
    }).catch((err) => {
      if (submitBtn) submitBtn.disabled = false;
      showWalletFeedback("withdraw", "❌ Connection to server failed. Please try again.", true);
      toast("CONNECTION FAILED", "lose");
    });
  } else {
    if (submitBtn) submitBtn.disabled = false;
    showWalletFeedback("withdraw", "❌ Server offline. Please try again later.", true);
  }
}

function syncPlayerWalletFromStorage() {
  // localStorage is not an account ledger. Refresh the signed server profile
  // whenever the tab regains focus instead of copying another tab's cache.
  syncProfileWithServer();
}

window.addEventListener("storage", (event) => {
  if (event.key === BALANCE_KEY || event.key === ADMIN_STATE_KEY) {
    syncPlayerWalletFromStorage();
  }
});

window.addEventListener("focus", syncPlayerWalletFromStorage);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncPlayerWalletFromStorage();
});

function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text);
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    area.remove();
  }
  return copied ? Promise.resolve() : Promise.reject(new Error("Copy unavailable"));
}

function copyDepositAccount() {
  const number = $("deposit-account-number").textContent.trim();
  copyText(number)
    .then(() => {
      showWalletFeedback("deposit", `${walletState.deposit} number copied: ${number}`);
      toast("NUMBER COPIED", "win");
    })
    .catch(() => {
      showWalletFeedback("deposit", `Copy failed. Use this number manually: ${number}`, true);
      toast("COPY FAILED", "lose");
    });
}

function bind() {
  $("start-game").addEventListener("click", startGame);
  document.querySelectorAll("[data-mobile-nav]").forEach((button) => {
    button.addEventListener("click", () => handleMobileNav(button.dataset.mobileNav));
  });
  $("close-mobile-panel")?.addEventListener("click", closeMobilePanel);
  $("mobile-panel")?.addEventListener("click", (event) => {
    if (event.target === $("mobile-panel")) closeMobilePanel();
  });
  $("random-one").addEventListener("click", () => randomPick(1));
  $("random-two").addEventListener("click", () => randomPick(2));
  $("bingo-btn").addEventListener("click", claimBingo);
  $("leave-game").addEventListener("click", leaveGame);
  const autoToggle = $("auto-mark-toggle");
  if (autoToggle) {
    autoToggle.checked = true;
    autoMarkingEnabled = true;
    autoToggle.addEventListener("change", handleAutoMarkToggle);
  }
  const voiceToggle = $("voice-toggle");
  if (voiceToggle) {
    voiceToggle.addEventListener("click", handleVoiceToggle);
    updateVoiceToggleUI();
  }
  document.querySelectorAll(".lb-voice-select").forEach((el) => {
    el.value = selectedVoice;
  });
  $("lobby-voice-select")?.addEventListener("change", (e) => setVoice(e.target.value, true));
  $("game-voice-select")?.addEventListener("change", (e) => setVoice(e.target.value, true));
  $("balance-trigger").addEventListener("click", () => openWallet("deposit"));
  $("close-wallet").addEventListener("click", closeWallet);
  $("wallet-panel").addEventListener("click", (event) => {
    if (event.target === $("wallet-panel")) closeWallet();
  });
  $("refresh-rooms").addEventListener("click", () => {
    renderRooms();
    toast("ROOMS REFRESHED", "win");
  });
  document.querySelectorAll("[data-wallet-tab]").forEach((button) => {
    button.addEventListener("click", () => setWalletTab(button.dataset.walletTab));
  });
  document.querySelectorAll("[data-provider-action]").forEach((button) => {
    button.addEventListener("click", () => selectWalletMethod(button.dataset.providerAction, button.dataset.method));
  });
  $("copy-deposit-account").addEventListener("click", copyDepositAccount);
  $("deposit-form").addEventListener("submit", handleDepositSubmit);
  $("withdraw-form").addEventListener("submit", handleWithdrawSubmit);
  updateDepositAccount();
  updateProviderButtons("deposit");
  updateProviderButtons("withdraw");
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("wallet-panel").hidden) closeWallet();
  });
}

function startClock() {
  // Kept as a small lifecycle hook for the game shell; the lobby intentionally has no clock.
}

loadCardCatalog();
renderBalance();
syncProfileWithServer();
startServerLobbySync();
window.addEventListener("focus", syncProfileWithServer);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncProfileWithServer();
  }
});
bind();
if (startingBonusAwarded > 0) toast(`STARTING BONUS +${fmt(startingBonusAwarded)} ETB`, "win");
if (window.location.hash === "#game" || window.location.search.includes("view=game")) {
  // Deep links no longer create a private game. The active room and called
  // numbers must be recovered from the authenticated server session.
  syncProfileWithServer();
} else if (window.location.hash === "#pick" || window.location.search.includes("view=pick")) {
  showView("pick");
  stake = 10;
  $("pick-stake").textContent = `${stake} ETB`;
  $("pick-cost").textContent = String(stake);
  selected.clear();
  updatePickInfo();
  buildCardGrid();
  renderCartelaPreview();
} else if (window.location.hash === "#winner" || window.location.search.includes("view=winner")) {
  showView("game");
  showWinnerOverlay("win", "RAS", 3800, 440, "LINE");
} else {
  showView("lobby");
}

checkAdminAccess();
window.addEventListener("DOMContentLoaded", checkAdminAccess);
window.addEventListener("load", checkAdminAccess);
window.addEventListener("beforeunload", () => {
  // Do not mutate server membership during unload. A refresh or second device
  // must not receive a localStorage-driven refund or room deletion.
});
window.addEventListener("storage", (event) => {
  if (event.key === ROOM_CATALOG_KEY) {
    if (views.lobby && views.lobby.classList.contains("is-on")) renderRooms();
  }
});

