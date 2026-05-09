const CONF_LABELS = {
  ALL: "全部",
  UEFA: "欧洲（UEFA）",
  CONMEBOL: "南美（CONMEBOL）",
  CONCACAF: "中北美（CONCACAF）",
  AFC: "亚洲（AFC）",
  CAF: "非洲（CAF）",
};

let teams = [];
let activeConf = "ALL";
let searchQuery = "";

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function matchesTeam(team, q) {
  if (!q) return true;
  const hay = [
    team.nameZh,
    team.nameEn,
    team.nickname,
    team.confederation,
    team.confederationZh,
    team.keyPlayers.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function renderFilters(container) {
  container.innerHTML = "";
  const keys = ["ALL", "UEFA", "CONMEBOL", "CONCACAF", "AFC", "CAF"];
  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-chip" + (activeConf === key ? " is-active" : "");
    btn.textContent = CONF_LABELS[key];
    btn.dataset.conf = key;
    btn.addEventListener("click", () => {
      activeConf = key;
      renderFilters(container);
      renderGrid();
    });
    container.appendChild(btn);
  });
}

function renderGrid() {
  const grid = document.getElementById("team-grid");
  const empty = document.getElementById("empty-state");
  const q = normalize(searchQuery);

  const filtered = teams.filter((t) => {
    const confOk = activeConf === "ALL" || t.confederation === activeConf;
    return confOk && matchesTeam(t, q);
  });

  grid.innerHTML = "";
  filtered.forEach((team) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "team-card";
    card.dataset.id = team.id;

    const winsLabel =
      team.worldCupWins > 0 ? `${team.worldCupWins} 次夺冠` : "未夺冠";

    card.innerHTML = `
      <div class="card-flag" aria-hidden="true">${team.flag}</div>
      <h3 class="card-name">${team.nameZh}</h3>
      <p class="card-name-en">${team.nameEn}</p>
      <div class="card-meta">
        <span class="tag">${team.confederationZh}</span>
        <span class="tag ${team.worldCupWins > 0 ? "tag--gold" : ""}">${winsLabel}</span>
        <span class="tag">${team.nickname}</span>
      </div>
    `;
    card.addEventListener("click", () => openModal(team));
    grid.appendChild(card);
  });

  empty.classList.toggle("hidden", filtered.length > 0);
}

function openModal(team) {
  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("modal-body");

  const factsHtml = team.funFacts.map((f) => `<li>${f}</li>`).join("");
  const playersHtml = team.keyPlayers.map((p) => `<li>${p}</li>`).join("");

  body.innerHTML = `
    <div class="modal-header">
      <span class="modal-flag" aria-hidden="true">${team.flag}</span>
      <div class="modal-title-block">
        <h2 id="modal-title">${team.nameZh}（${team.nameEn}）</h2>
        <p>${team.nickname} · ${team.confederationZh}</p>
      </div>
    </div>
    <div class="modal-stats">
      <div class="stat">
        <div class="stat-label">世界杯夺冠</div>
        <div class="stat-value">${team.worldCupWins} 次</div>
      </div>
      <div class="stat">
        <div class="stat-label">决赛次数</div>
        <div class="stat-value">${team.worldCupFinals} 次</div>
      </div>
      <div class="stat">
        <div class="stat-label">参赛届数</div>
        <div class="stat-value">${team.appearances}</div>
      </div>
      <div class="stat">
        <div class="stat-label">最佳战绩</div>
        <div class="stat-value" style="font-size:0.85rem;line-height:1.3">${team.bestResult}</div>
      </div>
    </div>
    <div class="modal-section">
      <h3>概况</h3>
      <p>${team.fifaRankingNote}</p>
    </div>
    <div class="modal-section">
      <h3>战术与比赛风格</h3>
      <p>${team.style}</p>
    </div>
    <div class="modal-section">
      <h3>历史与大赛脉络</h3>
      <p>${team.history}</p>
    </div>
    <div class="modal-section">
      <h3>足球文化与社会语境</h3>
      <p>${team.culture}</p>
    </div>
    <div class="modal-section">
      <h3>代表性球员（参考）</h3>
      <ul>${playersHtml}</ul>
    </div>
    <div class="modal-section">
      <h3>花絮与知识点</h3>
      <ul>${factsHtml}</ul>
    </div>
  `;

  modal.showModal();
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = document.getElementById("detail-modal");
  modal.close();
  document.body.style.overflow = "";
}

async function loadTeams() {
  const url = new URL("data/teams.json", window.location.href);
  const res = await fetch(url);
  if (!res.ok) throw new Error("无法加载球队数据");
  teams = await res.json();
}

function setupNav() {
  const toggle = document.querySelector(".nav-toggle");
  const list = document.getElementById("nav-menu");
  if (toggle && list) {
    toggle.addEventListener("click", () => {
      const open = list.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.querySelector(".logo")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function setupModalClose() {
  const modal = document.getElementById("detail-modal");
  modal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => closeModal());
  });
  modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.open) closeModal();
  });
}

function setupSearch() {
  const input = document.getElementById("q");
  input.addEventListener("input", () => {
    searchQuery = input.value;
    renderGrid();
  });
}

async function init() {
  document.getElementById("year").textContent = String(new Date().getFullYear());
  setupNav();
  setupModalClose();
  setupSearch();
  await loadTeams();
  renderFilters(document.getElementById("conf-filters"));
  renderGrid();
}

init().catch((err) => {
  console.error(err);
  document.getElementById("team-grid").innerHTML = "";
  document.getElementById("empty-state").textContent =
    "加载数据失败，请确认通过本地服务器或 GitHub Pages 打开（不能直接双击 file:// 打开以加载 JSON）。";
  document.getElementById("empty-state").classList.remove("hidden");
});
