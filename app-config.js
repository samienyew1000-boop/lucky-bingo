// Lucky Bingo API Configuration
// Authoritative backend URL for multi-device sync
(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const apiParam = params.get("api");
  if (apiParam) {
    try {
      localStorage.setItem("lb_api_url", apiParam.replace(/\/+$/, ""));
    } catch (e) {}
  }

  // Pre-configured cloud or tunnel backend URL
  const DEFAULT_BACKEND_URL = "https://thy-dublin-wear-declare.trycloudflare.com";

  window.LUCKY_BINGO_API_URL =
    window.LUCKY_BINGO_API_URL ||
    apiParam ||
    DEFAULT_BACKEND_URL;
})();
