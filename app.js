/* ===================================================
   Societal Health Index — Dashboard Application
   =================================================== */

(function () {
  "use strict";

  // ---- State ----
  let DATA = null;
  let currentView = "overview";
  let currentDomain = null;
  let charts = {};

  // ---- DOM refs ----
  const mainEl = document.getElementById("mainContent");
  const sidebarNav = document.getElementById("sidebarNav");
  const headerTitle = document.getElementById("headerTitle");
  const headerMeta = document.getElementById("headerMeta");
  const navComposite = document.getElementById("navComposite");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuBtn = document.getElementById("menuBtn");

  // ---- Theme toggle ----
  (function () {
    const t = document.querySelector("[data-theme-toggle]");
    const r = document.documentElement;
    let d = matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
    r.setAttribute("data-theme", d);
    if (t) {
      t.addEventListener("click", function () {
        d = d === "dark" ? "light" : "dark";
        r.setAttribute("data-theme", d);
        t.setAttribute("aria-label", "Switch to " + (d === "dark" ? "light" : "dark") + " mode");
        t.innerHTML =
          d === "dark"
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        // Re-render charts with new theme
        if (DATA) {
          renderCurrentView();
        }
      });
    }
  })();

  // ---- Mobile menu ----
  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", function () {
      sidebar.classList.remove("open");
    });
  }

  // ---- Helpers ----
  function getScoreColor(score) {
    if (score === null || score === undefined) return "var(--color-text-faint)";
    if (score >= 75) return "var(--gauge-excellent)";
    if (score >= 55) return "var(--gauge-good)";
    if (score >= 40) return "var(--gauge-moderate)";
    if (score >= 20) return "var(--gauge-warning)";
    return "var(--gauge-critical)";
  }

  function getScoreLabel(score) {
    if (score === null || score === undefined) return "N/A";
    if (score >= 75) return "Strong";
    if (score >= 55) return "Moderate";
    if (score >= 40) return "Weakening";
    if (score >= 20) return "Stressed";
    return "Critical";
  }

  function formatValue(val, fmt) {
    if (val === null || val === undefined) return "—";
    switch (fmt) {
      case "currency":
        return val >= 1000 ? "$" + (val / 1000).toFixed(1) + "K" : "$" + val.toLocaleString();
      case "currency_b":
        return "$" + val.toLocaleString() + "B";
      case "percent":
        return val.toFixed(1) + "%";
      case "decimal":
        return val.toFixed(2);
      case "number":
        return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
      default:
        return val.toLocaleString();
    }
  }

  function trendArrow(pct) {
    if (pct === null || pct === undefined) return '<span class="trend-flat">—</span>';
    var cls = pct > 0.5 ? "trend-up" : pct < -0.5 ? "trend-down" : "trend-flat";
    var arrow = pct > 0.5 ? "▲" : pct < -0.5 ? "▼" : "●";
    return '<span class="' + cls + '">' + arrow + " " + Math.abs(pct).toFixed(1) + "%</span>";
  }

  function destroyCharts() {
    Object.values(charts).forEach(function (c) {
      if (c && typeof c.destroy === "function") c.destroy();
    });
    charts = {};
  }

  function getChartColors() {
    var style = getComputedStyle(document.documentElement);
    return {
      text: style.getPropertyValue("--color-text").trim(),
      muted: style.getPropertyValue("--color-text-muted").trim(),
      faint: style.getPropertyValue("--color-text-faint").trim(),
      primary: style.getPropertyValue("--color-primary").trim(),
      grid: style.getPropertyValue("--color-divider").trim(),
      surface: style.getPropertyValue("--color-surface").trim(),
      success: style.getPropertyValue("--color-success").trim(),
      warning: style.getPropertyValue("--color-warning").trim(),
      error: style.getPropertyValue("--color-notification").trim(),
      blue: style.getPropertyValue("--color-blue").trim(),
      purple: style.getPropertyValue("--color-purple").trim(),
      orange: style.getPropertyValue("--color-orange").trim(),
    };
  }

  // ---- Domain icon SVGs ----
  var DOMAIN_ICONS = {
    economic_vitality: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M12 2a1 1 0 01.894.553l2.382 4.762 5.248.764a1 1 0 01.553 1.706l-3.796 3.7.896 5.228a1 1 0 01-1.45 1.054L12 17.27l-4.694 2.468a1 1 0 01-1.45-1.054l.896-5.228L2.923 9.785a1 1 0 01.553-1.706l5.248-.764L11.106 2.553A1 1 0 0112 2z"/></svg>',
    debt_monetary: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.798 7.45c.512-.67 1.135-.95 1.702-.95s1.19.28 1.702.95c.51.667.798 1.578.798 2.55s-.287 1.883-.798 2.55c-.512.67-1.135.95-1.702.95s-1.19-.28-1.702-.95C8.287 11.883 8 10.972 8 10s.287-1.883.798-2.55z" clip-rule="evenodd"/></svg>',
    family_demographics: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z"/></svg>',
    political_function: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9.674 2.075a.75.75 0 01.652 0l7.25 3.5A.75.75 0 0117.5 6.5v.628c0 .09-.017.176-.049.256l.01-.008A1.5 1.5 0 0118 8.5v.75a.75.75 0 01-.75.75h-.003A.75.75 0 0116.5 10v5.5h.25a.75.75 0 010 1.5H3.25a.75.75 0 010-1.5h.25V10a.75.75 0 01-.747 0H2.75A.75.75 0 012 9.25V8.5a1.5 1.5 0 01.538-1.122l.01.008A.745.745 0 012.5 7.128V6.5a.75.75 0 01-.076-.924l7.25-3.5zM10 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
    generational: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>',
    social_trust: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 17v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z"/></svg>',
    institutional_health: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zm5.303 1.697a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zm-9.546 1.06a.75.75 0 011.06 0l1.061 1.061a.75.75 0 01-1.06 1.06L5.757 4.818a.75.75 0 010-1.06zM10 7a3 3 0 100 6 3 3 0 000-6zm-6.25 3a.75.75 0 01-.75-.75h-1.5a.75.75 0 010 1.5h1.5A.75.75 0 013.75 10zm14.5-.75a.75.75 0 00-1.5 0 .75.75 0 001.5 0zm-3.193 4.182a.75.75 0 011.06 1.06l-1.06 1.061a.75.75 0 01-1.06-1.06l1.06-1.061zm-9.053 1.06a.75.75 0 011.06-1.06l1.061 1.06a.75.75 0 11-1.06 1.061l-1.061-1.06zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" clip-rule="evenodd"/></svg>',
    moral_cultural: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>',
    elite_dynamics: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.404 14.596A6.5 6.5 0 1116.5 10a1.25 1.25 0 01-2.5 0 4 4 0 10-.571 2.06A2.75 2.75 0 0018 10a8 8 0 10-2.343 5.657.75.75 0 00-1.06-1.06 6.5 6.5 0 01-9.193 0zM10 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z" clip-rule="evenodd"/></svg>',
    system_complexity: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>',
    external_position: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM3.101 8.743A7.02 7.02 0 003 10c0 .74.115 1.453.328 2.122a5.516 5.516 0 011.9-1.49A7.949 7.949 0 015 9c0-.74.101-1.456.29-2.136a5.533 5.533 0 01-2.19 1.879zM10 3a7.02 7.02 0 00-3.88 1.167c.529.428.98.95 1.328 1.539A5.963 5.963 0 0110 5c.953 0 1.852.222 2.652.618a5.512 5.512 0 011.36-1.564A7.02 7.02 0 0010 3z" clip-rule="evenodd"/></svg>',
    ecological: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V1.75A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06a.75.75 0 11-1.061 1.061L5.05 4.111a.75.75 0 010-1.06zM14.95 3.05a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a1 1 0 011-1h2.268A7.462 7.462 0 008.5 4.768V4.5a1 1 0 012 0v.268A7.462 7.462 0 0012.732 7H15a1 1 0 110 2h-2.268A7.462 7.462 0 0010.5 11.232v.268a1 1 0 01-2 0v-.268A7.462 7.462 0 006.268 9H4a1 1 0 01-1-1z"/><path d="M6 14.5a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5A.75.75 0 016 14.5zM8 17a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5A.75.75 0 018 17z"/></svg>',
    energy_entropy: '<svg class="nav-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z"/></svg>',
  };

  // ---- Build Sidebar Nav ----
  function buildNav() {
    if (!DATA) return;
    var container = document.getElementById("navDomains");
    container.innerHTML = "";
    var domainOrder = ["economic_vitality", "debt_monetary", "external_position", "family_demographics", "political_function", "generational", "social_trust", "institutional_health", "moral_cultural", "elite_dynamics", "system_complexity", "ecological", "energy_entropy"];
    domainOrder.forEach(function (dk) {
      var d = DATA.domains[dk];
      if (!d) return;
      var a = document.createElement("a");
      a.className = "nav-item";
      a.dataset.view = "domain";
      a.dataset.domain = dk;
      a.href = "#" + dk;
      a.innerHTML =
        (DOMAIN_ICONS[dk] || "") +
        "<span>" + d.name + "</span>" +
        '<span class="nav-score" style="color:' + getScoreColor(d.score) + '">' + (d.score !== null ? d.score.toFixed(0) : "—") + "</span>";
      container.appendChild(a);
    });

    navComposite.textContent = DATA.composite_score !== null ? DATA.composite_score.toFixed(0) : "—";
    navComposite.style.color = getScoreColor(DATA.composite_score);
  }

  // ---- Nav click handler ----
  document.addEventListener("click", function (e) {
    var navItem = e.target.closest(".nav-item");
    if (!navItem) return;
    e.preventDefault();
    sidebar.classList.remove("open");

    document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
    navItem.classList.add("active");

    var view = navItem.dataset.view;
    var domain = navItem.dataset.domain || null;
    currentView = view;
    currentDomain = domain;
    renderCurrentView();
  });

  // ---- Domain card click ----
  document.addEventListener("click", function (e) {
    var card = e.target.closest(".domain-card");
    if (!card) return;
    var dk = card.dataset.domain;
    currentView = "domain";
    currentDomain = dk;

    document.querySelectorAll(".nav-item").forEach(function (n) { n.classList.remove("active"); });
    var navLink = document.querySelector('.nav-item[data-domain="' + dk + '"]');
    if (navLink) navLink.classList.add("active");

    renderCurrentView();
  });

  // ---- Render Router ----
  function renderCurrentView() {
    destroyCharts();
    if (currentView === "overview") {
      headerTitle.textContent = "Composite Index";
      renderOverview();
    } else if (currentView === "domain" && currentDomain) {
      var d = DATA.domains[currentDomain];
      headerTitle.textContent = d ? d.name : "Domain";
      renderDomainDetail(currentDomain);
    } else if (currentView === "methodology") {
      headerTitle.textContent = "Methodology";
      renderMethodology();
    }
    mainEl.scrollTop = 0;
  }

  // ---- OVERVIEW VIEW ----
  function renderOverview() {
    var cs = DATA.composite_score;
    var html = "";

    // Composite hero
    html += '<div class="composite-hero fade-in">';
    html += '  <div class="gauge-container">';
    html += buildGaugeSVG(cs);
    html += '    <div class="gauge-value">';
    html += '      <div class="gauge-number" style="color:' + getScoreColor(cs) + '">' + (cs !== null ? cs.toFixed(1) : "\u2014") + "</div>";
    html += '      <div class="gauge-label">' + getScoreLabel(cs) + "</div>";
    html += "    </div>";
    html += "  </div>";
    html += '  <div class="composite-details">';
    html += "    <h2>US Societal Health Index</h2>";
    html += '    <p class="composite-subtitle">Composite score across 13 domains, 47 indicators. All 3 waves live.</p>';
    html += '    <div class="pillar-bars">';

    // Pillar groupings
    var pillars = [
      { name: "Economic & Financial", domains: ["economic_vitality", "debt_monetary", "external_position"] },
      { name: "Social Fabric", domains: ["family_demographics", "generational", "social_trust", "moral_cultural"] },
      { name: "Structural & Political", domains: ["political_function", "institutional_health", "elite_dynamics", "system_complexity"] },
      { name: "Biophysical", domains: ["ecological", "energy_entropy"] },
    ];

    pillars.forEach(function (p) {
      var scores = p.domains.map(function (dk) { return DATA.domains[dk] ? DATA.domains[dk].score : null; }).filter(function (s) { return s !== null; });
      var avg = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : null;
      var pct = avg !== null ? avg : 0;
      html += '<div class="pillar-bar">';
      html += '  <span class="pillar-bar-label">' + p.name + "</span>";
      html += '  <div class="pillar-bar-track"><div class="pillar-bar-fill" style="width:' + pct + "%;background:" + getScoreColor(avg) + '"></div></div>';
      html += '  <span class="pillar-bar-value" style="color:' + getScoreColor(avg) + '">' + (avg !== null ? avg.toFixed(0) : "—") + "</span>";
      html += "</div>";
    });

    html += "    </div>";
    html += "  </div>";
    html += "</div>";

    // Domain cards
    html += '<div class="domain-grid">';
    var domainOrder = ["economic_vitality", "debt_monetary", "external_position", "family_demographics", "political_function", "generational", "social_trust", "institutional_health", "moral_cultural", "elite_dynamics", "system_complexity", "ecological", "energy_entropy"];
    domainOrder.forEach(function (dk, i) {
      var d = DATA.domains[dk];
      if (!d) return;
      html += '<div class="domain-card fade-in" data-domain="' + dk + '" style="animation-delay:' + (i * 60) + 'ms">';
      html += '  <div class="domain-card-header">';
      html += '    <div>';
      html += '      <div class="domain-card-name">' + d.name + "</div>";
      html += '      <div class="domain-card-pillar">' + d.pillar + "</div>";
      html += "    </div>";
      html += '    <div style="text-align:right">';
      html += '      <div class="domain-card-score" style="color:' + getScoreColor(d.score) + '">' + (d.score !== null ? d.score.toFixed(1) : "—") + "</div>";
      html += '      <div class="domain-card-trend">' + getScoreLabel(d.score) + "</div>";
      html += "    </div>";
      html += "  </div>";
      html += '  <div class="domain-card-sparkline"><canvas id="spark-' + dk + '"></canvas></div>';
      html += '  <div class="domain-card-indicators">' + d.indicator_count + " indicators</div>";
      html += "</div>";
    });
    html += "</div>";

    // Methodology note
    html += '<div class="methodology-note fade-in">';
    html += "  <h3>About This Index</h3>";
    html += "  <p>Scores range 0 – 100 (100 = peak historical health). Each indicator is normalized against its own historical range (1960–present) using min-max scaling. ";
    html += "Domains are equally weighted. All 13 domains are live across 3 waves, using FRED, Census, World Bank, WIPO, SIPRI, EIA, GSS, Gallup, Pew, CDC, and Global Footprint Network data.</p>";
    html += "</div>";

    mainEl.innerHTML = html;

    // Render sparklines
    setTimeout(function () {
      domainOrder.forEach(function (dk) {
        renderDomainSparkline(dk);
      });
    }, 100);
  }

  // ---- GAUGE SVG ----
  function buildGaugeSVG(score) {
    var val = score !== null ? Math.max(0, Math.min(100, score)) : 0;
    // Use a semicircular gauge from -180deg to 0deg (left to right)
    var r = 70;
    var cx = 90;
    var cy = 95;
    var startAngle = Math.PI; // 180 deg = leftmost
    var endAngle = 0;         // 0 deg = rightmost
    var sweepAngle = startAngle - (val / 100) * Math.PI; // value arc end

    function toXY(angle) {
      return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
    }

    // Background arc: full semicircle from left to right
    var bgStart = toXY(Math.PI);
    var bgEnd = toXY(0);
    var bgPath = "M " + bgStart.x + " " + bgStart.y + " A " + r + " " + r + " 0 1 1 " + bgEnd.x + " " + bgEnd.y;

    // Value arc: from left to the score position
    var valEndPt = toXY(sweepAngle);
    var valSweepDeg = (val / 100) * 180;
    var largeArc = valSweepDeg > 180 ? 1 : 0;
    var valPath = "M " + bgStart.x + " " + bgStart.y + " A " + r + " " + r + " 0 " + largeArc + " 1 " + valEndPt.x + " " + valEndPt.y;

    var svg = '<svg viewBox="0 0 180 110">';
    svg += '<path d="' + bgPath + '" fill="none" stroke="var(--color-surface-dynamic)" stroke-width="12" stroke-linecap="round"/>';
    if (val > 0) {
      svg += '<path d="' + valPath + '" fill="none" stroke="' + getScoreColor(score) + '" stroke-width="12" stroke-linecap="round"/>';
    }

    // Tick marks at 0, 25, 50, 75, 100
    [0, 25, 50, 75, 100].forEach(function (tick) {
      var a = Math.PI - (tick / 100) * Math.PI;
      var inner = { x: cx + (r - 8) * Math.cos(a), y: cy - (r - 8) * Math.sin(a) };
      var outer = { x: cx + (r + 4) * Math.cos(a), y: cy - (r + 4) * Math.sin(a) };
      svg += '<line x1="' + inner.x + '" y1="' + inner.y + '" x2="' + outer.x + '" y2="' + outer.y + '" stroke="var(--color-text-faint)" stroke-width="1.5"/>';
    });

    svg += "</svg>";
    return svg;
  }

  // ---- SPARKLINE for domain card ----
  function renderDomainSparkline(dk) {
    var d = DATA.domains[dk];
    if (!d) return;
    var canvas = document.getElementById("spark-" + dk);
    if (!canvas) return;

    // Get first indicator's sparkline data
    var firstInd = d.indicators[0];
    var indData = DATA.indicators[firstInd];
    if (!indData || !indData.sparkline || !indData.sparkline.length) return;

    var labels = indData.sparkline.map(function (p) { return p.date; });
    var values = indData.sparkline.map(function (p) { return p.value; });

    var colors = getChartColors();
    var domainColors = {
      economic_vitality: colors.primary,
      debt_monetary: colors.warning,
      family_demographics: colors.blue,
      political_function: colors.purple,
      generational: colors.orange,
      social_trust: colors.success,
      institutional_health: colors.blue,
      moral_cultural: colors.error,
      elite_dynamics: colors.purple,
      system_complexity: colors.orange,
      external_position: colors.primary,
      ecological: colors.success,
      energy_entropy: colors.orange,
    };
    var lineColor = domainColors[dk] || colors.primary;

    charts["spark-" + dk] = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            borderColor: lineColor,
            borderWidth: 2,
            fill: true,
            backgroundColor: lineColor + "18",
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        animation: { duration: 800 },
      },
    });
  }

  // ---- DOMAIN DETAIL VIEW ----
  function renderDomainDetail(dk) {
    var d = DATA.domains[dk];
    if (!d) return;

    var html = "";

    // Header
    html += '<div class="detail-panel fade-in">';
    html += '  <div class="detail-panel-header">';
    html += '    <div>';
    html += '      <h2 class="detail-panel-title">' + d.name + "</h2>";
    html += '      <span style="font-size:var(--text-xs);color:var(--color-text-muted)">' + d.pillar + " · " + d.indicator_count + " indicators</span>";
    html += "    </div>";
    html += '    <div style="text-align:right">';
    html += '      <div class="detail-panel-score" style="color:' + getScoreColor(d.score) + '">' + (d.score !== null ? d.score.toFixed(1) : "—") + "</div>";
    html += '      <div style="font-size:var(--text-xs);color:var(--color-text-muted)">' + getScoreLabel(d.score) + "</div>";
    html += "    </div>";
    html += "  </div>";

    // Indicator table
    html += '  <table class="indicator-table">';
    html += "    <thead><tr><th>Indicator</th><th>Source</th><th>Latest</th><th>Trend</th><th>Score</th></tr></thead>";
    html += "    <tbody>";

    d.indicators.forEach(function (indId) {
      var ind = DATA.indicators[indId];
      if (!ind) return;
      var scoreBg = ind.score !== null ? getScoreColor(ind.score) + "20" : "transparent";
      html += "<tr>";
      html += '  <td><span class="indicator-name">' + ind.name + "</span></td>";
      html += "  <td><span class=\"indicator-source\">" + (ind.series_id || "—") + "</span></td>";
      html += "  <td>" + formatValue(ind.latest_value, ind.fmt) + "</td>";
      html += "  <td>" + trendArrow(ind.trend_pct) + "</td>";
      html += '  <td><span class="score-badge" style="background:' + scoreBg + ";color:" + getScoreColor(ind.score) + '">' + (ind.score !== null ? ind.score.toFixed(0) : "—") + "</span></td>";
      html += "</tr>";
    });

    html += "    </tbody>";
    html += "  </table>";
    html += "</div>";

    // Time series chart
    html += '<div class="detail-panel fade-in" style="animation-delay:100ms">';
    html += '  <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:var(--space-2)">Historical Trends</h3>';
    html += '  <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-bottom:var(--space-4)">Key indicators over time. Normalized for comparison.</p>';
    html += '  <div class="chart-container"><canvas id="domain-chart"></canvas></div>';
    html += "</div>";

    mainEl.innerHTML = html;

    // Render chart
    setTimeout(function () {
      renderDomainChart(dk);
    }, 150);
  }

  function renderDomainChart(dk) {
    var d = DATA.domains[dk];
    if (!d) return;
    var canvas = document.getElementById("domain-chart");
    if (!canvas) return;

    var colors = getChartColors();
    var chartColors = [colors.primary, colors.orange, colors.blue, colors.purple, colors.success, colors.error];

    var datasets = [];
    d.indicators.forEach(function (indId, i) {
      var ind = DATA.indicators[indId];
      if (!ind || !ind.time_series || ind.time_series.length < 2) return;

      // Normalize 0-100 for comparison
      var mn = ind.full_min;
      var mx = ind.full_max;
      var range = mx - mn || 1;
      var normData = ind.time_series.map(function (p) {
        var norm = ((p.value - mn) / range) * 100;
        if (ind.direction === "negative") norm = 100 - norm;
        return { x: p.date, y: Math.round(norm * 10) / 10 };
      });

      datasets.push({
        label: ind.name,
        data: normData,
        borderColor: chartColors[i % chartColors.length],
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
      });
    });

    charts["domain-chart"] = new Chart(canvas, {
      type: "line",
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: colors.muted,
              font: { family: "'Satoshi', sans-serif", size: 11 },
              boxWidth: 12,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: colors.surface,
            titleColor: colors.text,
            bodyColor: colors.muted,
            borderColor: colors.faint,
            borderWidth: 1,
            cornerRadius: 6,
            padding: 10,
            titleFont: { family: "'Satoshi', sans-serif", size: 12, weight: "600" },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
          },
        },
        scales: {
          x: {
            type: "category",
            ticks: { color: colors.faint, font: { size: 10, family: "'Satoshi', sans-serif" }, maxRotation: 0, maxTicksLimit: 8 },
            grid: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: colors.faint,
              font: { size: 10, family: "'JetBrains Mono', monospace" },
              callback: function (v) { return v; },
              stepSize: 25,
            },
            grid: { color: colors.grid, lineWidth: 0.5 },
            title: { display: true, text: "Health Score (0–100)", color: colors.faint, font: { size: 10, family: "'Satoshi', sans-serif" } },
          },
        },
        animation: { duration: 1000, easing: "easeOutQuart" },
      },
    });
  }

  // ---- METHODOLOGY VIEW ----
  function renderMethodology() {
    var html = '<div class="detail-panel fade-in">';
    html += '  <h2 class="detail-panel-title">Scoring Methodology</h2>';
    html += '  <div style="font-size:var(--text-sm);color:var(--color-text-muted);line-height:1.8;margin-top:var(--space-4)">';
    html += "    <h3 style=\"font-size:var(--text-base);font-weight:600;color:var(--color-text);margin:var(--space-4) 0 var(--space-2)\">Source Framework</h3>";
    html += "    <p>This index draws from four foundational works on societal cycles and collapse:</p>";
    html += '    <ul style="list-style:disc;padding-left:var(--space-6);margin:var(--space-2) 0">';
    html += "      <li><strong>The Fourth Turning</strong> (Strauss & Howe) — generational cycles and institutional trust</li>";
    html += "      <li><strong>Immoderate Greatness</strong> (Ophuls) — complexity, entropy, and resource depletion</li>";
    html += "      <li><strong>Ages of Discord</strong> (Turchin) — elite overproduction, popular immiseration, political instability</li>";
    html += "      <li><strong>Principles for Dealing with the Changing World Order</strong> (Dalio) — debt cycles, reserve currency, competitive standing</li>";
    html += "    </ul>";

    html += "    <h3 style=\"font-size:var(--text-base);font-weight:600;color:var(--color-text);margin:var(--space-4) 0 var(--space-2)\">Scoring</h3>";
    html += "    <p>Each indicator is scored 0–100 using historical min-max normalization against its own time series (typically 1960–present). ";
    html += "A score of 100 represents the peak observed value in the direction of societal health; 0 represents the worst. ";
    html += "Indicators where higher values signal weakness (e.g., debt-to-GDP, polarization) are inverted.</p>";

    html += "    <h3 style=\"font-size:var(--text-base);font-weight:600;color:var(--color-text);margin:var(--space-4) 0 var(--space-2)\">Weighting</h3>";
    html += "    <p>All indicators within a domain are equally weighted. All domains are equally weighted in the composite. ";
    html += "This is a deliberate starting point — domain-specific weights may be refined in future versions based on predictive analysis.</p>";

    html += "    <h3 style=\"font-size:var(--text-base);font-weight:600;color:var(--color-text);margin:var(--space-4) 0 var(--space-2)\">Data Sources</h3>";
    html += '    <p>All three waves use publicly available data from <a href="https://fred.stlouisfed.org" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary)">FRED</a>, ';
    html += '<a href="https://info.worldbank.org/governance/wgi/" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary)">World Bank</a>, ';
    html += '<a href="https://www.wipo.int" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary)">WIPO</a>, ';
    html += '<a href="https://www.sipri.org" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary)">SIPRI</a>, ';
    html += '<a href="https://www.eia.gov" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary)">EIA</a>, ';
    html += 'GSS, Gallup, Pew, CDC, Census, Global Footprint Network, USDA, Bridgewater, and DW-NOMINATE. Data refreshes on dashboard rebuild.</p>';

    html += "    <h3 style=\"font-size:var(--text-base);font-weight:600;color:var(--color-text);margin:var(--space-4) 0 var(--space-2)\">Implementation Waves</h3>";
    html += '    <table class="indicator-table" style="margin-top:var(--space-2)">';
    html += "      <thead><tr><th>Wave</th><th>Domains</th><th>Status</th></tr></thead>";
    html += "      <tbody>";
    html += '        <tr><td><strong>Wave 1</strong></td><td>Economic Vitality, Debt & Monetary, Family & Demographics, Political Function, Generational Dynamics</td><td><span class="score-badge" style="background:var(--color-success-soft);color:var(--color-success)">Live</span></td></tr>';
    html += '        <tr><td><strong>Wave 2</strong></td><td>External Competitive Position, Ecological & Resource Base, Energy & Entropy</td><td><span class="score-badge" style="background:var(--color-success-soft);color:var(--color-success)">Live</span></td></tr>';
    html += '        <tr><td><strong>Wave 3</strong></td><td>Social Trust & Cohesion, Institutional Health, Moral & Cultural Health, Elite Dynamics, System Complexity</td><td><span class="score-badge" style="background:var(--color-success-soft);color:var(--color-success)">Live</span></td></tr>';
    html += "      </tbody>";
    html += "    </table>";

    html += "  </div>";
    html += "</div>";

    mainEl.innerHTML = html;
  }

  // ---- INIT ----
  function init() {
    fetch("./data.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        DATA = data;
        var genDate = new Date(data.generated_at);
        headerMeta.textContent = "Updated " + genDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        buildNav();
        renderCurrentView();
      })
      .catch(function (err) {
        mainEl.innerHTML = '<div class="detail-panel"><h2>Error Loading Data</h2><p style="color:var(--color-text-muted)">Could not load data.json: ' + err.message + "</p></div>";
      });
  }

  init();
})();
