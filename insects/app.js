const grid = document.getElementById("insect-grid");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalBody = document.getElementById("modal-body");
const modalClose = document.getElementById("modal-close");
const searchInput = document.getElementById("insect-search");
const countEl = document.getElementById("insect-count");

/** @type {Array<Object>} */
let allInsects = [];
/** 当前弹窗展示的条目（用于朗读） */
let modalItem = null;

/**
 * 当前页面所在目录（始终以 / 结尾）。
 * 解决访问 /insects 无尾部斜杠时，相对路径 images/a.svg 被错解析成 /images/a.svg 导致裂图。
 */
function currentPageDir() {
  const path = window.location.pathname;
  if (path.endsWith("/")) return path;
  if (/\.html?$/i.test(path)) return path.replace(/[^/]+$/, "");
  return `${path}/`;
}

function resolveAssetUrl(rel) {
  if (!rel) return rel;
  if (/^https?:\/\//i.test(rel)) return rel;
  if (rel.startsWith("/")) return `${window.location.origin}${rel}`;
  const dir = currentPageDir();
  return `${window.location.origin}${dir}${rel.replace(/^\//, "")}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function pauseModalVideos() {
  modalBody.querySelectorAll("video").forEach((v) => v.pause());
}

function stopSpeech() {
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  } catch (_) {
    /* ignore */
  }
}

/** 拼出用于朗读的中文讲解稿（习性 + 摘要 + 说明） */
function buildHabitSpeechText(item) {
  if (!item) return "";
  const chunks = [
    `${item.name || "本种昆虫"}。`,
    item.latin ? `学名 ${item.latin}。` : "",
    item.order ? `${item.order}。` : "",
    item.summary ? `${item.summary}` : "",
    item.detail ? `习性与生活史：${item.detail}` : "",
    item.note ? `补充说明：${item.note}` : "",
  ];
  return chunks.join("").replace(/\s+/g, " ").trim();
}

function pickChineseVoice() {
  const list = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  return (
    list.find((v) => v.lang === "zh-CN") ||
    list.find((v) => /^zh(-cn)?$/i.test(v.lang)) ||
    list.find((v) => String(v.lang || "").toLowerCase().startsWith("zh")) ||
    null
  );
}

function speakHabitsChinese() {
  if (!modalItem) return;
  if (!window.speechSynthesis) {
    window.alert("当前浏览器不支持语音朗读，请换用 Chrome / Edge 等浏览器。");
    return;
  }
  const text = buildHabitSpeechText(modalItem);
  if (!text) return;
  stopSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  u.rate = 0.92;
  u.pitch = 1;
  const voice = pickChineseVoice();
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

function openModal(item) {
  modalItem = item;
  modalTitle.textContent = item.name;
  const noteHtml = item.note
    ? `<p class="modal-note" style="font-size:0.85rem;color:var(--text-muted);margin:0 0 0.75rem">${escapeHtml(item.note)}</p>`
    : "";
  const poster = escapeHtml(resolveAssetUrl(item.image));
  const videoSrc = item.video ? escapeHtml(resolveAssetUrl(item.video)) : "";
  const videoCredit = item.videoCredit
    ? escapeHtml(item.videoCredit)
    : "Wikimedia Commons（详见各视频在 Commons 上的文件页与授权）";
  const videoHtml = item.video
    ? `<div class="modal-video-wrap">
        <p class="modal-video-label">相关短视频（WebM）</p>
        <video controls playsinline preload="metadata" poster="${poster}">
          <source src="${videoSrc}" type="video/webm" />
        </video>
        <p class="modal-video-credit">视频来源：${videoCredit}</p>
      </div>`
    : "";
  modalBody.innerHTML = `
    <div class="modal-image-wrap">
      <img src="${poster}" alt="${escapeHtml(item.name)}" loading="lazy" width="800" height="600" />
    </div>
    ${videoHtml}
    <div class="modal-meta">
      <span class="latin">${escapeHtml(item.latin)}</span>
      <span>${escapeHtml(item.order)}</span>
    </div>
    ${noteHtml}
    <p class="modal-detail">${escapeHtml(item.detail)}</p>
    <div class="modal-speech" role="group" aria-label="中文语音讲解">
      <p class="modal-speech-hint">使用本机中文语音引擎朗读下方摘要与习性（非预录文件，无需下载）。</p>
      <div class="modal-speech-actions">
        <button type="button" class="modal-speak-btn" data-speech-action="speak">朗读习性讲解</button>
        <button type="button" class="modal-speak-btn modal-speak-btn--secondary" data-speech-action="stop">停止朗读</button>
      </div>
    </div>
    <p class="modal-credit">图片来源：${escapeHtml(item.credit)}</p>
  `;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  pauseModalVideos();
  stopSpeech();
  modalItem = null;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function applyFilter() {
  const q = (searchInput?.value || "").trim().toLowerCase();
  const filtered = !q
    ? allInsects
    : allInsects.filter(
        (it) =>
          String(it.name || "")
            .toLowerCase()
            .includes(q) ||
          String(it.latin || "")
            .toLowerCase()
            .includes(q) ||
          String(it.summary || "")
            .toLowerCase()
            .includes(q)
      );
  if (countEl) {
    countEl.textContent =
      q.length === 0
        ? `共 ${allInsects.length} 条`
        : `显示 ${filtered.length} 条 / 全部 ${allInsects.length} 条`;
  }
  renderCards(filtered);
}

function renderCards(items) {
  grid.innerHTML = items
    .map(
      (item) => `
    <article class="card">
      <button type="button" class="card-trigger" data-id="${escapeHtml(item.id)}" aria-label="查看 ${escapeHtml(item.name)} 详情${item.video ? "（含视频）" : ""}">
        <div class="card-image-wrap">
          ${item.video ? `<span class="card-video-badge">含视频</span>` : ""}
          <img src="${escapeHtml(resolveAssetUrl(item.image))}" alt="${escapeHtml(item.name)}" loading="lazy" width="400" height="300" />
        </div>
        <div class="card-body">
          <h2>${escapeHtml(item.name)}</h2>
          <p class="card-latin">${escapeHtml(item.latin)}</p>
          <p class="card-order">${escapeHtml(item.order)}</p>
          <p class="card-summary">${escapeHtml(item.summary)}</p>
          ${item.note ? `<p class="card-hint">${escapeHtml(item.note)}</p>` : `<p class="card-hint">点击查看完整讲解</p>`}
        </div>
      </button>
    </article>
  `
    )
    .join("");

  grid.querySelectorAll(".card-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const item = items.find((i) => i.id === id);
      if (item) openModal(item);
    });
  });
}

modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  const speechBtn = e.target.closest("[data-speech-action]");
  if (speechBtn && modal.classList.contains("is-open")) {
    const act = speechBtn.getAttribute("data-speech-action");
    if (act === "speak") speakHabitsChinese();
    if (act === "stop") stopSpeech();
    return;
  }
  if (e.target === modal) closeModal();
});

if (window.speechSynthesis) {
  speechSynthesis.addEventListener("voiceschanged", () => {});
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
});

Promise.all([
  fetch(resolveAssetUrl("data.json")).then((r) => {
    if (!r.ok) throw new Error("无法加载主数据 data.json");
    return r.json();
  }),
  fetch(resolveAssetUrl("data-bulk.json")).then((r) => (r.ok ? r.json() : [])),
])
  .then(([featured, bulk]) => {
    allInsects = [...featured, ...Array.isArray(bulk) ? bulk : []];
    applyFilter();
  })
  .catch((err) => {
    grid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);text-align:center;">加载失败：${escapeHtml(err.message)}</p>`;
  });

if (searchInput) {
  searchInput.addEventListener("input", () => applyFilter());
}
