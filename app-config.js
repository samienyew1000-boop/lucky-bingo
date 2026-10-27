// Lucky Bingo API Configuration
// Authoritative backend URL for multi-device sync
(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const apiParam = params.get("api");

  // 24/7 VPS Cloud Backend URL
  const DEFAULT_BACKEND_URL = "https://traveling-philosophy-limits-john.trycloudflare.com";

  if (apiParam) {
    try {
      localStorage.setItem("lb_api_url", apiParam.replace(/\/+$/, ""));
    } catch (e) {}
    window.LUCKY_BINGO_API_URL = apiParam.replace(/\/+$/, "");
  } else {
    try {
      const stored = localStorage.getItem("lb_api_url");
      // If stored URL was the old dead ethiodeploy server, override with active VPS backend
      if (!stored || stored.includes("ethiodeploy.com")) {
        localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
      }
    } catch (e) {}
    window.LUCKY_BINGO_API_URL = localStorage.getItem("lb_api_url") || DEFAULT_BACKEND_URL;
    if (window.LUCKY_BINGO_API_URL.includes("ethiodeploy.com")) {
      window.LUCKY_BINGO_API_URL = DEFAULT_BACKEND_URL;
      try {
        localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
      } catch (e) {}
    }
  }
})();
