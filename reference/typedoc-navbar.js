/* =============================================================================
   TypeDoc theme adapter for the SignalWire docs navbar (reference/navbar/).
   The navbar's theme control drives TypeDoc's own light/dark setting, so
   TypeDoc's pages, its Settings > Theme select and the navbar always agree.
   Runs before navbar/navbar.js, which reads window.SwDocsNavbar.themeAdapter.

   TypeDoc keeps the choice in localStorage["tsd-theme"] ("os" | "light" |
   "dark") and applies it as data-theme on <html>: an inline script at the top
   of each page applies the stored value, and the select applies changes.
   ============================================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "tsd-theme";
  var TO_TYPEDOC = { light: "light", dark: "dark", system: "os" };
  var FROM_TYPEDOC = { light: "light", dark: "dark", os: "system" };
  var html = document.documentElement;

  window.SwDocsNavbar = window.SwDocsNavbar || {};
  window.SwDocsNavbar.themeAdapter = {
    get: function () {
      return FROM_TYPEDOC[html.dataset.theme] || "system";
    },
    set: function (pref) {
      var theme = TO_TYPEDOC[pref] || "os";
      // Go through TypeDoc's settings select: its change handler stores the
      // choice the way TypeDoc does (honouring
      // TypeDoc.disableWritingLocalStorage()) and applies it.
      var select = document.getElementById("tsd-theme");
      if (select) {
        select.value = theme;
        select.dispatchEvent(new Event("change"));
        return;
      }
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* blocked */ }
      html.dataset.theme = theme;
    },
    // A change made in TypeDoc's settings panel updates the navbar.
    subscribe: function (cb) {
      new MutationObserver(cb).observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    },
  };
})();
