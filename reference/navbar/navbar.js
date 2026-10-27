/* =============================================================================
   SignalWire docs navbar: behaviour for <sw-docs-navbar>.
   Ported from the signalwire-python reference navbar (assets/js/navbar.js):
     - dropdown open/close + anchored positioning (product / support / theme)
     - theme control: light / dark / system
   The markup arrives as a declarative shadow root (navbar.html), so the bar
   renders before this script runs; this script only adds behaviour.

   Theme adapter. The navbar doesn't know how the page does light/dark. A page
   with its own theme registers an adapter in a script that runs before this
   one:

     window.SwDocsNavbar = {
       themeAdapter: {
         get() {},          // the current choice: "light" | "dark" | "system"
         set(pref) {},      // apply and persist a choice the page's own way
         subscribe(cb) {},  // optional: call cb() when the page changes theme
       },
     };

   Without an adapter the choice is kept in localStorage under
   "sw-docs-navbar:theme" and only the navbar follows it.
   ============================================================================= */
(function () {
  "use strict";

  var STORAGE_KEY = "sw-docs-navbar:theme";
  var PREFS = ["light", "dark", "system"];
  var CHECK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';

  var darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  /* --- Theme ---------------------------------------------------------------- */
  // Default adapter: the navbar keeps the choice to itself. Storage can throw
  // when the browser blocks it; the choice then lasts until the page unloads.
  var memory = null;
  var storageAdapter = {
    get: function () {
      try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return memory; }
    },
    set: function (pref) {
      memory = pref;
      try { localStorage.setItem(STORAGE_KEY, pref); } catch (e) { /* blocked */ }
    },
  };

  function themeAdapter() {
    return (window.SwDocsNavbar && window.SwDocsNavbar.themeAdapter) || storageAdapter;
  }

  /* --- Init ----------------------------------------------------------------- */
  function init(host, root) {
    var adapter = themeAdapter();

    function currentPref() {
      var pref = adapter.get();
      return PREFS.indexOf(pref) >= 0 ? pref : "system";
    }

    // The host's data-theme switches the token set in tokens.css. As on
    // signalwire.com/docs, the trigger icon and the check both show the choice:
    // sun, moon, or monitor for System.
    function syncTheme() {
      var pref = currentPref();
      var dark = pref === "dark" || (pref === "system" && darkQuery.matches);
      host.setAttribute("data-theme", dark ? "dark" : "light");
      root.getElementById("theme-icon-sun").hidden = pref !== "light";
      root.getElementById("theme-icon-moon").hidden = pref !== "dark";
      root.getElementById("theme-icon-system").hidden = pref !== "system";
      var items = root.querySelectorAll("#theme-panel [data-theme-pref]");
      for (var i = 0; i < items.length; i++) {
        var chk = items[i].querySelector("[data-check]");
        if (chk) chk.innerHTML = items[i].getAttribute("data-theme-pref") === pref ? CHECK_SVG : "";
      }
    }

    /* --- Dropdowns ---------------------------------------------------------- */
    var dropdowns = [];
    function closeAll() { for (var i = 0; i < dropdowns.length; i++) dropdowns[i].set(false); }

    function registerDropdown(triggerId, panelId, opts) {
      opts = opts || {};
      var align = opts.align || "start";
      var offset = opts.offset != null ? opts.offset : 8;
      var trigger = root.getElementById(triggerId);
      var panel = root.getElementById(panelId);
      if (!trigger || !panel) return null;

      function position() {
        var r = trigger.getBoundingClientRect();
        panel.style.top = r.bottom + offset + "px";
        if (align === "end") {
          panel.style.right = Math.max(8, window.innerWidth - r.right) + "px";
          panel.style.left = "auto";
        } else if (align === "center") {
          var w = panel.offsetWidth;
          var c = r.left + r.width / 2 - w / 2;
          panel.style.left = Math.min(Math.max(8, c), window.innerWidth - w - 8) + "px";
          panel.style.right = "auto";
        } else {
          var width = panel.offsetWidth;
          panel.style.left = Math.min(r.left, Math.max(8, window.innerWidth - width - 8)) + "px";
          panel.style.right = "auto";
        }
      }
      var dd = {
        isOpen: function () { return panel.getAttribute("data-state") === "open"; },
        set: function (open) {
          panel.setAttribute("data-state", open ? "open" : "closed");
          trigger.setAttribute("data-state", open ? "open" : "closed");
          trigger.setAttribute("aria-expanded", String(open));
          if (open) position();
        },
      };
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = !dd.isOpen();
        closeAll();
        dd.set(willOpen);
      });
      dropdowns.push(dd);
      return dd;
    }

    // Events from inside the shadow root reach the document retargeted to the
    // host, so look at the composed path to tell a click inside a panel.
    document.addEventListener("click", function (e) {
      var path = e.composedPath();
      for (var i = 0; i < path.length; i++) {
        if (path[i].matches && path[i].matches(".fern-dropdown, .fern-dropdown-panel")) return;
      }
      closeAll();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAll(); });
    window.addEventListener("resize", closeAll);

    registerDropdown("product-trigger", "product-panel", { align: "start", offset: 4 });
    registerDropdown("support-trigger", "support-panel", { align: "end" });
    registerDropdown("theme-trigger", "theme-panel", { align: "end" });

    var themeItems = root.querySelectorAll("#theme-panel [data-theme-pref]");
    for (var i = 0; i < themeItems.length; i++) {
      themeItems[i].addEventListener("click", function () {
        closeAll();
        adapter.set(this.getAttribute("data-theme-pref"));
        syncTheme();
      });
    }
    syncTheme();
    darkQuery.addEventListener("change", syncTheme);
    if (adapter.subscribe) adapter.subscribe(syncTheme);
  }

  /* --- Element -------------------------------------------------------------- */
  // A browser without declarative shadow DOM leaves the <template> in the
  // light DOM; attach it by hand.
  function shadowRootOf(host) {
    if (host.shadowRoot) return host.shadowRoot;
    var template = host.querySelector("template[shadowrootmode]");
    if (!template) return null;
    var root = host.attachShadow({ mode: "open" });
    root.appendChild(template.content);
    template.remove();
    return root;
  }

  class SwDocsNavbar extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      var root = shadowRootOf(this);
      if (!root) return;
      this.initialized = true;
      init(this, root);
    }
  }

  if (!customElements.get("sw-docs-navbar")) customElements.define("sw-docs-navbar", SwDocsNavbar);
})();
