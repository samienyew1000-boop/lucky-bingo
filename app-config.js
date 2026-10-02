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
  const DEFAULT_BACKEND_URL = "https://instrumental-retailer-resist-fit.trycloudflare.com";

  if (apiParam) {
    window.LUCKY_BINGO_API_URL = apiParam;
  } else {
    window.LUCKY_BINGO_API_URL = DEFAULT_BACKEND_URL;
    try {
      localStorage.setItem("lb_api_url", DEFAULT_BACKEND_URL);
    } catch (e) {}
  }
})();
