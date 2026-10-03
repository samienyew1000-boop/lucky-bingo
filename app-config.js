// Lucky Bingo API Configuration
// Authoritative backend URL for multi-device sync
(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const apiParam = params.get("api");

  // Permanent 24/7 Cloud Backend URL on EthioDeploy
  const DEFAULT_BACKEND_URL = "https://lucky-bingo.ethiodeploy.com";

  if (apiParam) {
    try {
      localStorage.setItem("lb_api_url", apiParam.replace(/\/+$/, ""));
    } catch (e) {}
    window.LUCKY_BINGO_API_URL = apiParam;
  } else {
    try {
      const stored = localStorage.getItem("lb_api_url");
      // If stored URL was an old temporary trycloudflare tunnel, override with permanent EthioDeploy backend
      if (!stored || stored.includes("trycloudflare.com")) {
        localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
      }
    } catch (e) {}
    window.LUCKY_BINGO_API_URL = localStorage.getItem("lb_api_url") || DEFAULT_BACKEND_URL;
    if (window.LUCKY_BINGO_API_URL.includes("trycloudflare.com")) {
      window.LUCKY_BINGO_API_URL = DEFAULT_BACKEND_URL;
      try {
        localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
      } catch (e) {}
    }
  }
})();
