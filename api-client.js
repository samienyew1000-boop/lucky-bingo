"use strict";

/**
 * Lucky Bingo API Client
 * Communicates with the bot.py server-side API for synchronized game state.
 * All game state (balance, rooms, game progress) is managed server-side.
 */
const LuckyBingoAPI = (() => {
  // Auto-detect the API base URL
  let _baseUrl = "";

  function getBaseUrl() {
    if (_baseUrl) return _baseUrl;
    const currentHost = window.location.hostname;
    if (currentHost === "localhost" || currentHost === "127.0.0.1") {
      _baseUrl = "";
    } else if (currentHost.includes("vercel.app")) {
      _baseUrl = window.LUCKY_BINGO_API_URL || "";
    } else {
      _baseUrl = "";
    }
    return _baseUrl;
  }

  function getInitData() {
    try {
      return window.Telegram?.WebApp?.initData || "";
    } catch (e) {
      return "";
    }
  }

  function getTelegramUser() {
    try {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        const u = window.Telegram.WebApp.initDataUnsafe.user;
        localStorage.setItem("lb_tg_user", JSON.stringify(u));
        return u;
      }
      const params = new URLSearchParams(window.location.search);
      const uid = params.get("u") || params.get("user_id") || params.get("tg_user_id");
      if (uid && !isNaN(Number(uid))) {
        const u = { id: Number(uid), username: params.get("username") || "" };
        localStorage.setItem("lb_tg_user", JSON.stringify(u));
        return u;
      }
      const cached = localStorage.getItem("lb_tg_user");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id) return parsed;
        } catch (e) {}
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function apiRequest(path, options = {}) {
    const url = getBaseUrl() + path;
    const headers = {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...options.headers,
    };

    const user = getTelegramUser();
    if (user && user.id) {
      headers["X-Telegram-User-Id"] = String(user.id);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const text = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          errorData = { error: text || `HTTP ${response.status}` };
        }
        return { error: errorData.error || `HTTP ${response.status}`, _status: response.status };
      }

      return await response.json();
    } catch (e) {
      console.error("[API] Request failed:", path, e);
      return { error: "Network error. Please check your connection." };
    }
  }

  // =========================================================================
  // PUBLIC API METHODS
  // =========================================================================

  async function getProfile() {
    return apiRequest("/api/me");
  }

  async function getRooms() {
    return apiRequest("/api/rooms");
  }

  async function getRoomState(roomId) {
    return apiRequest(`/api/room-state?room_id=${encodeURIComponent(roomId)}`);
  }

  async function joinRoom(roomId, cardIds) {
    return apiRequest("/api/join-room", {
      method: "POST",
      body: JSON.stringify({ room_id: String(roomId), card_ids: cardIds }),
    });
  }

  async function leaveRoom(roomId) {
    return apiRequest("/api/leave-room", {
      method: "POST",
      body: JSON.stringify({ room_id: String(roomId) }),
    });
  }

  async function claimBingo(roomId, cardId) {
    return apiRequest("/api/claim-bingo", {
      method: "POST",
      body: JSON.stringify({ room_id: String(roomId), card_id: cardId }),
    });
  }

  async function deposit(amount, method, reference, phone) {
    return apiRequest("/api/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, method, reference, phone }),
    });
  }

  async function withdraw(amount, method, phone) {
    return apiRequest("/api/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, method, phone }),
    });
  }

  // =========================================================================
  // POLLING HELPERS
  // =========================================================================

  let _roomPollTimer = null;
  let _roomPollCallback = null;
  let _roomPollId = null;

  function startRoomPoll(roomId, callback, intervalMs = 800) {
    stopRoomPoll();
    _roomPollId = roomId;
    _roomPollCallback = callback;

    async function poll() {
      if (_roomPollId !== roomId) return;
      const state = await getRoomState(roomId);
      if (_roomPollId === roomId && _roomPollCallback) {
        _roomPollCallback(state);
      }
      if (_roomPollId === roomId) {
        _roomPollTimer = setTimeout(poll, intervalMs);
      }
    }
    poll();
  }

  function stopRoomPoll() {
    _roomPollId = null;
    _roomPollCallback = null;
    if (_roomPollTimer) {
      clearTimeout(_roomPollTimer);
      _roomPollTimer = null;
    }
  }

  let _lobbyPollTimer = null;
  let _lobbyPollCallback = null;

  function startLobbyPoll(callback, intervalMs = 2000) {
    stopLobbyPoll();
    _lobbyPollCallback = callback;

    async function poll() {
      if (!_lobbyPollCallback) return;
      const data = await getRooms();
      if (_lobbyPollCallback) {
        _lobbyPollCallback(data);
      }
      if (_lobbyPollCallback) {
        _lobbyPollTimer = setTimeout(poll, intervalMs);
      }
    }
    poll();
  }

  function stopLobbyPoll() {
    _lobbyPollCallback = null;
    if (_lobbyPollTimer) {
      clearTimeout(_lobbyPollTimer);
      _lobbyPollTimer = null;
    }
  }

  function setBaseUrl(url) {
    _baseUrl = url.replace(/\/+$/, "");
  }

  return {
    getProfile,
    getRooms,
    getRoomState,
    joinRoom,
    leaveRoom,
    claimBingo,
    deposit,
    withdraw,
    startRoomPoll,
    stopRoomPoll,
    startLobbyPoll,
    stopLobbyPoll,
    setBaseUrl,
    getTelegramUser,
    getInitData,
  };
})();
