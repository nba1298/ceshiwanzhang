/**
 * 从 species200.txt 取物种学名，经英文维基 pageimages + 中文名（langlink / Wikidata / 中文维基搜索）生成 data-bulk.json。
 * 运行：node insects/scripts/build-bulk.mjs
 */
import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function httpsGetText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "CeshiwanzhangInsectCatalog/1.0 (https://github.com/; educational insect gallery)",
            Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf8"));
          });
        }
      )
      .on("error", reject);
  });
}

async function httpsGetJson(url, retries = 4) {
  let lastErr;
  for (let a = 0; a < retries; a++) {
    try {
      const body = await httpsGetText(url);
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
      await sleep(900 * (a + 1));
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 是否包含中日韩统一表意文字（用于判断是否为中文常用名） */
function hasCjk(s) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(String(s || ""));
}

function normalizeEnTitle(t) {
  return String(t || "")
    .replace(/_/g, " ")
    .trim();
}

function loadFeaturedBinomials() {
  const dataPath = path.join(root, "data.json");
  const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const set = new Set();
  for (const row of raw) {
    const m = String(row.latin || "").match(/^([A-Z][a-z]+)\s+([a-z]+)/);
    if (m) set.add(`${m[1]} ${m[2]}`);
  }
  return set;
}

function loadSpeciesPool() {
  const txt = fs.readFileSync(path.join(__dirname, "species200.txt"), "utf8");
  const re = /^([A-Z][a-z]+ [a-z]+)$/;
  const seen = new Set();
  const out = [];
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!re.test(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

async function fetchEnBatch(titles) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageimages|langlinks|extracts",
    piprop: "thumbnail",
    pithumbsize: "480",
    exintro: "1",
    explaintext: "1",
    exchars: "320",
    lllang: "zh",
    lllimit: "1",
    titles: titles.join("|"),
  });
  return httpsGetJson(`https://en.wikipedia.org/w/api.php?${params}`);
}

/**
 * 批量：英文维基标题 -> 中文标签（Wikidata）
 * @returns {Map<string, string>} 规范化 en 标题 -> 中文名
 */
async function fetchWikidataZhByEnTitles(enTitles) {
  const map = new Map();
  if (enTitles.length === 0) return map;
  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    sites: "enwiki",
    titles: enTitles.join("|"),
    props: "labels|sitelinks",
    languages: "zh|zh-cn|zh-hans|zh-tw",
  });
  const data = await httpsGetJson(`https://www.wikidata.org/w/api.php?${params}`);
  for (const ent of Object.values(data.entities || {})) {
    if (ent.missing === "" || ent.redirection) continue;
    const enT = ent.sitelinks?.enwiki?.title;
    if (!enT) continue;
    const key = normalizeEnTitle(enT);
    const L = ent.labels || {};
    const zh =
      L.zh?.value ||
      L["zh-cn"]?.value ||
      L["zh-hans"]?.value ||
      L["zh-tw"]?.value;
    if (zh) map.set(key, zh);
  }
  return map;
}

/** 中文维基 opensearch，取第一条标题（多为中文条目标题） */
async function fetchZhWikiTitleHint(latinBinomial) {
  const params = new URLSearchParams({
    action: "opensearch",
    format: "json",
    search: latinBinomial,
    limit: "3",
    namespace: "0",
  });
  const data = await httpsGetJson(`https://zh.wikipedia.org/w/api.php?${params}`);
  const titles = data[1] || [];
  for (const t of titles) {
    if (hasCjk(t)) return t;
  }
  return null;
}

const featured = loadFeaturedBinomials();
let pool = loadSpeciesPool().filter((s) => !featured.has(s));

const bulk = [];
let seq = 1;

for (let i = 0; i < pool.length && bulk.length < 200; i += 28) {
  const titles = pool.slice(i, i + 28);
  if (titles.length === 0) break;
  let data;
  try {
    data = await fetchEnBatch(titles);
  } catch (e) {
    console.error("batch failed", e.message);
    break;
  }
  const pages = data.query?.pages || [];
  const pagesWithThumb = pages.filter((p) => !p.missing && p.thumbnail?.source);
  const enTitlesForWd = pagesWithThumb.map((p) => normalizeEnTitle(p.title));

  let wdMap = new Map();
  try {
    wdMap = await fetchWikidataZhByEnTitles(enTitlesForWd);
  } catch (e) {
    console.error("wikidata batch warn", e.message);
  }

  for (const page of pages) {
    if (bulk.length >= 200) break;
    if (page.missing) continue;
    const thumb = page.thumbnail?.source;
    if (!thumb) continue;
    const latin = normalizeEnTitle(page.title);
    const zhLink = (page.langlinks || []).find((l) => l.lang === "zh");
    const zhLinkTitle = zhLink?.title ? normalizeEnTitle(zhLink.title) : null;
    const wdLabel = wdMap.get(normalizeEnTitle(page.title));

    let nameZh =
      (zhLinkTitle && hasCjk(zhLinkTitle) ? zhLinkTitle : null) ||
      (wdLabel && hasCjk(wdLabel) ? wdLabel : null) ||
      (zhLinkTitle || null) ||
      (wdLabel || null) ||
      latin;

    if (!hasCjk(nameZh)) {
      try {
        const hint = await fetchZhWikiTitleHint(latin);
        if (hint) nameZh = hint;
      } catch (_) {
        /* ignore */
      }
      await sleep(120);
    }
    if (!hasCjk(nameZh)) {
      nameZh = `昆虫物种（学名 ${latin}）`;
    }

    const extract = (page.extract || "").replace(/\s+/g, " ").trim();
    const summaryEn =
      extract.slice(0, 220) + (extract.length > 220 ? "…" : "") ||
      `${latin} 为昆虫纲物种。`;
    const summary = `${nameZh}（${latin}）：${summaryEn}`;

    bulk.push({
      id: `bulk-${String(seq++).padStart(4, "0")}`,
      name: nameZh,
      latin,
      order: "昆虫纲 · 物种条目（维基摘要）",
      summary,
      detail: `${nameZh}（学名 ${latin}）的简介摘录自英文维基百科，分类与分布请以权威文献为准。配图来自维基媒体缩略图，需能访问外网；若图片无法显示可改为本地资源。`,
      image: thumb,
      credit: "维基媒体 · 英文维基百科词条缩略图（详见 Commons 授权）",
      source: "wikipedia",
    });
  }
  console.error("progress", bulk.length);
  await sleep(950);
}

fs.writeFileSync(path.join(root, "data-bulk.json"), JSON.stringify(bulk, null, 0), "utf8");
console.log("wrote", bulk.length, "rows to data-bulk.json");
