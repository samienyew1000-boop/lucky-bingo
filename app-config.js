// Lucky Bingo API Configuration
// Authoritative backend URL for multi-device sync
(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  let apiParam = params.get("api");

  // 24/7 VPS Cloud Backend URL
  const DEFAULT_BACKEND_URL = "https://pamela-sapphire-developing-emotions.trycloudflare.com";
  window.LUCKY_BINGO_DEFAULT_URL = DEFAULT_BACKEND_URL;

  const DEAD_DOMAINS = [
    "ethiodeploy.com",
    "traveling-philosophy-limits-john",
    "retain-projectors-packaging-shopping",
    "warned-justice-locate-struct"
  ];

  function isDeadUrl(u) {
    if (!u) return true;
    return DEAD_DOMAINS.some(function (d) { return u.includes(d); });
  }

  // If apiParam is dead, ignore it
  if (apiParam && isDeadUrl(apiParam)) {
    apiParam = null;
  }

  if (apiParam) {
    const cleanUrl = apiParam.replace(/\/+$/, "");
    try {
      localStorage.setItem("lb_api_url", cleanUrl);
    } catch (e) {}
    window.LUCKY_BINGO_API_URL = cleanUrl;
  } else {
    try {
      let stored = localStorage.getItem("lb_api_url");
      if (!stored || isDeadUrl(stored)) {
        stored = DEFAULT_BACKEND_URL;
        localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
      }
      window.LUCKY_BINGO_API_URL = stored;
    } catch (e) {
      window.LUCKY_BINGO_API_URL = DEFAULT_BACKEND_URL;
    }
  }

  if (!window.LUCKY_BINGO_API_URL || isDeadUrl(window.LUCKY_BINGO_API_URL)) {
    window.LUCKY_BINGO_API_URL = DEFAULT_BACKEND_URL;
  }
})();
