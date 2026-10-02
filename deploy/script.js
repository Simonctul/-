/* =========================================================
   VICTORIA — логика сайта. Данные (контакты, прайс, мастера) лежат в data.js.
   ========================================================= */
/* Служебные тексты, которые собирает скрипт */
const T = {
  openMenu: "Открыть меню", closeMenu: "Закрыть меню",
  chooseService: "Выберите услугу", anyMaster: "Любой мастер", time: "Время",
  needConsent: "Нужно согласие на обработку данных.", checkFields: "Проверьте выделенные поля.",
  sendFail: "Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.",
  success: (n, d, t) => `${n}, ждём вас ${d} в ${t}. Мы позвоним для подтверждения. Для отмены напишите в WhatsApp ${CONFIG.phone}.`,
  waText: (s, m, d, t, n) => `Здравствуйте! Запись: ${s}, мастер: ${m}, ${d} в ${t}. Меня зовут ${n}.`,
  openWork: "Открыть работу: ", openIg: "Открыть Instagram", stars: n => `Оценка ${n} из 5`,
};

/* =========================================================
   Хелперы
   ========================================================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const tt = k => T[k];
const fill = s => s.replace(/\{\{(phone|hours|address)\}\}/g, (_, k) => CONFIG[k]);
const waLink = (text = "") => `https://wa.me/${CONFIG.whatsapp}${text ? "?text=" + encodeURIComponent(text) : ""}`;

/* ---------- Фото-заглушки: скрыть подсказку, если файл найден ---------- */
function watchPhoto(node) {
  const m = /url\(["']?([^"')]+)["']?\)/.exec(node.getAttribute("style") || "");
  if (!m) return;
  const img = new Image();
  img.onload = () => node.classList.add("has-img");
  img.src = m[1];
}
const watchPhotos = () => $$(".ph[style*='--img']:not(.has-img)").forEach(watchPhoto);

/* ---------- Подстановка контактов из CONFIG ---------- */
function renderContacts() {
  $$("[data-cfg]").forEach(n => {
    const k = n.dataset.cfg;
    const v = k === "igHandle" ? "@" + CONFIG.instagram : CONFIG[k];
    if (v) { n.textContent = v; n.hidden = false; } else n.hidden = true;
  });
  $$("[data-tel]").forEach(a => a.href = "tel:" + CONFIG.phoneHref);
  $$("[data-tel2]").forEach(a => a.href = "tel:" + CONFIG.phone2Href);
  $$("[data-wa]").forEach(a => a.href = waLink());
  $$("[data-ig]").forEach(a => { a.href = CONFIG.instagramUrl; a.rel = "noopener nofollow"; });
  $$("[data-map]").forEach(a => a.href = "https://yandex.ru/maps/?text=" + encodeURIComponent(CONFIG.address));
  $$("[data-route]").forEach(a => a.href = "https://yandex.ru/maps/?rtext=~" + encodeURIComponent(CONFIG.address) + "&rtt=auto");

  /* Карта: если src не задан, собираем виджет по адресу. Схема-заглушка остаётся под ним на случай, если он не загрузится. */
  const embed = $("#mapEmbed");
  if (embed) {
    embed.src = CONFIG.mapEmbed || "https://yandex.ru/map-widget/v1/?z=16&text=" + encodeURIComponent(CONFIG.address);
    embed.hidden = false;
  }

  /* Блок Instagram показываем только если есть пометка (юридическое требование) */
  const ig = $("#instagram");
  if (ig) ig.hidden = !CONFIG.instagramNotice;
}

/* =========================================================
   Рендер блоков
   ========================================================= */
const masterGrid = $("#masterGrid");
function renderMasters() {
  masterGrid.innerHTML = "";
  MASTERS.forEach((m, i) => {
    const b = el("button", "master");
    b.type = "button";
    b.dataset.master = m.name;
    const photo = m.photo ? ` style="--img:url(${esc(m.photo)})"` : "";
    b.innerHTML = `<div class="avatar ph a${(i % 4) + 1}"${photo}><b>${esc(m.name[0])}</b></div>
      <h3>${esc(m.name)}</h3><p>${esc(m.role)}<br>${esc(m.area)}</p><span class="more">Записаться</span>`;
    masterGrid.append(b);
  });
}

const tabsBox = $("#priceTabs"), panelsBox = $("#pricePanels");
let activeTab = PRICES[0].id;
function renderPrices() {
  tabsBox.innerHTML = ""; panelsBox.innerHTML = "";
  PRICES.forEach(cat => {
    const on = cat.id === activeTab;
    const t = el("button", "tab" + (on ? " active" : ""), esc(cat.title));
    Object.assign(t, { type: "button", id: "tab-" + cat.id });
    t.setAttribute("role", "tab");
    t.setAttribute("aria-selected", String(on));
    t.setAttribute("aria-controls", cat.id);
    t.tabIndex = on ? 0 : -1;
    t.dataset.tab = cat.id;
    tabsBox.append(t);

    const p = el("div", "price-panel" + (on ? " active" : ""));
    p.id = cat.id; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", "tab-" + cat.id);
    const single = cat.groups.length === 1;                      // одна группа — список в две колонки
    p.innerHTML = `<h3>${esc(cat.title)}</h3><div class="price-groups">` +
      cat.groups.map(g => `<div class="price-group${single ? " wide" : ""}">${single ? "" : `<h4>${esc(g.title)}</h4>`}` +
        g.items.map(it => `<div class="price-row"><span>${esc(it.name)}</span><b>${esc(priceText(it))}</b></div>`).join("") + `</div>`).join("") + `</div>`;
    panelsBox.append(p);
  });
}

/* ---------- Контент из content.json: портфолио, «до/после», отзывы, видео ---------- */
let CONTENT = { works: [], beforeAfter: [], reviews: [], reviewLinks: {}, video: {} };
let MANIFEST = {};                       // размеры и размытые превью фото; его пишет npm run optimize
const CATEGORY_LABELS = { nails: "Ногти", men: "Мужской зал", women: "Женский зал", color: "Окрашивание" };
const CATEGORY_ORDER = ["nails", "men", "women", "color"];

async function loadContent() {
  const get = async url => { try { const r = await fetch(url, { cache: "no-cache" }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const [c, m] = await Promise.all([get("content.json"), get("media/manifest.json")]);
  if (c) CONTENT = { ...CONTENT, ...c };
  if (m) MANIFEST = m;
}

/** <img> с двумя размерами (800 и 1600), заданными заранее width/height и размытым превью: страница не прыгает */
function photo(folder, file, alt, { sizes = "(max-width:640px) 50vw, 25vw", cls = "" } = {}) {
  const base = file.replace(/\.[^.]+$/, ""), dir = encodeURI(`media/${folder}/web/${base}`);
  const { w = 3, h = 4, lqip } = MANIFEST[`${folder}/${file}`] || {};
  return `<img${cls ? ` class="${cls}"` : ""} src="${dir}-800.webp" srcset="${dir}-800.webp 800w, ${dir}-1600.webp 1600w" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(alt)}" loading="lazy" decoding="async"${lqip ? ` style="background:url(${lqip}) center/cover"` : ""}>`;
}

const pGrid = $("#portfolioGrid"), workFilters = $("#workFilters"), baBlock = $("#baBlock"), baGrid = $("#baGrid");
let workFilter = "all", lbItems = [];
const rank = c => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? 99 : i; };

function baCard(p) {
  const { w = 3, h = 4 } = MANIFEST[`works/${p.after}`] || {};
  const cap = p.caption || "Работа";
  return `<div class="ba-card"><figure class="ba" style="--pos:50%;aspect-ratio:${w}/${h}">
      ${photo("works", p.after, cap + " — после", { sizes: "(max-width:640px) 100vw, 33vw", cls: "ba-after" })}
      ${photo("works", p.before, cap + " — до", { sizes: "(max-width:640px) 100vw, 33vw", cls: "ba-before" })}
      <span class="ba-tag ba-tag-b">До</span><span class="ba-tag ba-tag-a">После</span><i class="ba-handle" aria-hidden="true"></i>
      <input class="ba-range" type="range" min="0" max="100" value="50" aria-label="Сравнение до и после: потяните ползунок">
    </figure>${p.caption ? `<p class="ba-cap">${esc(p.caption)}</p>` : ""}</div>`;
}

function renderWorks() {
  const singles = CONTENT.works || [], pairs = CONTENT.beforeAfter || [];
  const real = singles.length + pairs.length > 0;

  /* фильтры по категориям (только если есть из чего выбирать) */
  const cats = [...new Set([...singles, ...pairs].map(x => x.category).filter(Boolean))].sort((a, b) => rank(a) - rank(b));
  if (!cats.includes(workFilter)) workFilter = "all";
  workFilters.hidden = !(real && cats.length > 1);
  workFilters.innerHTML = ["all", ...cats].map(c =>
    `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${c === workFilter}">${c === "all" ? "Все" : esc(CATEGORY_LABELS[c] || c)}</button>`).join("");
  const match = x => workFilter === "all" || x.category === workFilter;

  /* «до и после» */
  const showPairs = pairs.filter(match);
  baBlock.hidden = !showPairs.length;
  baGrid.innerHTML = showPairs.map(baCard).join("");

  /* обычная галерея; пока в content.json нет работ, показываем заглушки */
  pGrid.innerHTML = "";
  if (!real) {
    lbItems = WORKS;
    WORKS.forEach((w, i) => {
      const b = el("button", `work ph ${w.cls}`, `<span>${esc(w.label)}</span>`);
      b.type = "button"; b.dataset.index = i;
      b.style.setProperty("--img", `url(${w.img})`);
      b.setAttribute("aria-label", tt("openWork") + w.label);
      pGrid.append(b);
    });
    pGrid.hidden = false;
    return;
  }
  lbItems = singles.filter(match);
  pGrid.hidden = !lbItems.length;
  lbItems.forEach((w, i) => {
    const label = w.caption || CATEGORY_LABELS[w.category] || "Работа";
    const b = el("button", "work", photo("works", w.photo, label) + (w.category ? `<span>${esc(CATEGORY_LABELS[w.category] || w.category)}</span>` : ""));
    b.type = "button"; b.dataset.index = i;
    b.setAttribute("aria-label", tt("openWork") + label);
    pGrid.append(b);
  });
}

workFilters.addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  workFilter = b.dataset.cat; renderWorks();
});
baGrid.addEventListener("input", e => {
  const r = e.target.closest(".ba-range"); if (!r) return;
  r.closest(".ba").style.setProperty("--pos", r.value + "%");
});

const igGrid = $("#igGrid");
function renderInstagram() {
  igGrid.innerHTML = "";
  IG_PHOTOS.forEach((src, i) => {
    const a = el("a", `ig-tile ph ${IG_CLASSES[i]}`);
    a.dataset.ig = ""; a.target = "_blank"; a.rel = "noopener nofollow";
    a.href = CONFIG.instagramUrl;
    a.setAttribute("aria-label", tt("openIg"));
    a.style.setProperty("--img", `url(${src})`);
    igGrid.append(a);
  });
}

const reviewSection = $("#reviews"), reviewGrid = $("#reviewGrid");
function renderReviews() {
  const list = CONTENT.reviews || [], links = CONTENT.reviewLinks || {};
  const has = list.length > 0 || !!(links.yandex || links.twogis);       // раздел виден, если есть отзывы или хотя бы одна ссылка
  reviewSection.hidden = !has;
  $$("[data-needs='reviews']").forEach(a => a.hidden = !has);
  reviewGrid.innerHTML = "";
  list.forEach(r => {
    const n = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
    const c = el("figure", "review");
    c.innerHTML = `<div class="stars" role="img" aria-label="${esc(tt("stars")(n))}">${"★".repeat(n)}<span>${"★".repeat(5 - n)}</span></div>
      <blockquote>${esc(r.text)}</blockquote>
      <figcaption><b>${esc(r.name)}</b>${r.source ? `<small>${esc(r.source)}</small>` : ""}</figcaption>`;
    reviewGrid.append(c);
  });
  [["#reviewsYandex", links.yandex], ["#reviews2gis", links.twogis]].forEach(([sel, href]) => {
    const a = $(sel); a.hidden = !href; if (href) a.href = href;
  });
}

/* ---------- Видео: обложка, загрузка по клику, без звука ---------- */
function renderVideo() {
  const v = CONTENT.video || {}, sec = $("#video"), box = $("#videoBox");
  sec.hidden = !v.file;
  if (!v.file) return;
  $("#videoTitle").textContent = v.title || "Видео";
  const info = v.poster ? MANIFEST[`video/${v.poster}`] || {} : {};
  const ratio = info.w && info.h ? `${info.w}/${info.h}` : "16/9";
  const base = v.poster ? encodeURI(`media/video/web/${v.poster.replace(/\.[^.]+$/, "")}`) : "";
  box.style.aspectRatio = ratio;
  box.innerHTML = `<button class="video-play" type="button" aria-label="Смотреть видео: ${esc(v.title || "салон и мастера")}">` +
    (base ? `<img src="${base}-1600.webp" srcset="${base}-800.webp 800w, ${base}-1600.webp 1600w" sizes="(max-width:900px) 100vw, 900px" width="${info.w || 16}" height="${info.h || 9}" alt="" loading="lazy" decoding="async"${info.lqip ? ` style="background:url(${info.lqip}) center/cover"` : ""}>` : "") +
    `<span class="play-ic" aria-hidden="true"></span></button>`;
  box.querySelector(".video-play").addEventListener("click", () => {
    const video = document.createElement("video");
    video.src = encodeURI(`media/video/${v.file}`);
    if (base) video.poster = `${base}-1600.webp`;
    Object.assign(video, { controls: true, muted: true, playsInline: true, autoplay: true, preload: "auto" });
    video.setAttribute("aria-label", v.title || "Видео");
    box.replaceChildren(video);
    video.play?.().catch(() => {});
    window.goal?.("video_play");
  }, { once: true });
}

const faqList = $("#faqList");
function renderFaq() {
  const openIdx = $$("details", faqList).findIndex(d => d.open);
  faqList.innerHTML = "";
  FAQ.forEach((f, i) => {
    const d = el("details", "faq-item");
    d.open = i === openIdx;
    d.innerHTML = `<summary>${esc(f.q)}</summary><p>${esc(fill(f.a))}</p>`;
    faqList.append(d);
  });
}

/* Лаванда (декор) — один раз */
(() => {
  const g = $("#lav"); if (!g) return;
  const NS = "http://www.w3.org/2000/svg";
  [[100,140,0],[40,210,-8],[164,220,8]].forEach(([cx, top, rot]) => {
    for (let i = 0; i < 16; i++) {
      [-1, 1].forEach(side => {
        const e = document.createElementNS(NS, "ellipse");
        e.setAttribute("cx", cx + side * (7 + (i % 3)));
        e.setAttribute("cy", top + i * 15);
        e.setAttribute("rx", 5); e.setAttribute("ry", 9);
        e.setAttribute("transform", `rotate(${side * 28 + rot} ${cx} ${top + i * 15})`);
        g.append(e);
      });
    }
  });
})();

/* =========================================================
   Меню, шапка, подсветка пункта
   ========================================================= */
const header = $(".header"), burger = $(".burger"), nav = $("#nav");
function setMenu(open) {
  document.body.classList.toggle("menu-open", open);
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? tt("closeMenu") : tt("openMenu"));
}
burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
$$("a", nav).forEach(a => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
const onScroll = () => header.classList.toggle("scrolled", scrollY > 10);
onScroll(); addEventListener("scroll", onScroll, { passive: true });

const links = $$("a", nav);
if ("IntersectionObserver" in window) {
  const targets = $$("main > section").filter(s => s.id || s.dataset.spy);
  const spy = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const id = en.target.dataset.spy || en.target.id;
    const map = id === "about" ? "top" : id;
    links.forEach(a => a.classList.toggle("current", a.getAttribute("href") === "#" + map));
  }), { rootMargin: "-45% 0px -50% 0px" });
  targets.forEach(s => spy.observe(s));

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); o.unobserve(e.target); } }), { threshold: 0.06 });
    $$(".section, .hero-copy").forEach(s => io.observe(s));
  }
}

/* =========================================================
   Вкладки прайса
   ========================================================= */
function activateTab(btn, focus = false) {
  activeTab = btn.dataset.tab;
  $$(".tab").forEach(b => { const on = b === btn; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  $$(".price-panel").forEach(p => p.classList.toggle("active", p.id === activeTab));
  if (focus) btn.focus();
}
tabsBox.addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) activateTab(b); });
tabsBox.addEventListener("keydown", e => {
  const list = $$(".tab"), i = list.indexOf(document.activeElement);
  if (i < 0) return;
  if (e.key === "ArrowRight") activateTab(list[(i + 1) % list.length], true);
  if (e.key === "ArrowLeft") activateTab(list[(i - 1 + list.length) % list.length], true);
});
$$("[data-open-tab]").forEach(c => c.addEventListener("click", () => {
  const t = $$(".tab").find(x => x.dataset.tab === c.dataset.openTab); if (t) activateTab(t);
}));

/* =========================================================
   Онлайн-запись
   ========================================================= */
const dlg = $("#bookingDialog"), form = $("#bookingForm"), success = $("#formSuccess");
const fMaster = $("#fMaster"), fDate = $("#fDate"), fTime = $("#fTime");
const fName = $("#fName"), fPhone = $("#fPhone"), fConsent = $("#fConsent"), fWebsite = $("#fWebsite"), fSubmit = $("#fSubmit"), formError = $("#formError");
const svcGroups = $("#svcGroups"), svcSummary = $("#svcSummary"), svcBox = $("#svcPicker"), slotBox = $("#slotBox"), slotPlan = $("#slotPlan"), masterHint = $("#masterHint");

/* Адрес «свободного времени» берём из адреса приёма заявок: …/booking → …/slots */
const SLOTS_URL = /\/booking\/?$/.test(CONFIG.bookingEndpoint || "") ? CONFIG.bookingEndpoint.replace(/\/booking\/?$/, "/slots") : "";

let pickedKeys = [];      // ключи выбранных услуг, в порядке выбора
let chosen = null;        // выбранный слот { start, plan }
let manual = false;       // свободное время не загрузилось — клиент пишет желаемое время сам
let slotReq = 0, slotTimer = 0;

const pickedItems = () => pickedKeys.map(k => SERVICE_BY_KEY[k]).filter(Boolean);
const durText = m => (m >= 60 ? `${Math.floor(m / 60)} ч` : "") + (m >= 60 && m % 60 ? " " : "") + (m % 60 ? `${m % 60} мин` : "");
function totals(items) {
  const min = items.reduce((a, s) => a + s.min, 0);
  const from = items.reduce((a, s) => a + s.from, 0);
  const open = items.some(s => s.kind === "from");
  const to = open ? null : items.reduce((a, s) => a + (s.to ?? s.from), 0);
  const price = to === null ? `от ${fmt(from)} ₽` : to === from ? `${fmt(from)} ₽` : `от ${fmt(from)} до ${fmt(to)} ₽`;
  return { min, price };
}

function renderSelects() {
  svcGroups.innerHTML = PRICES.map(cat => {
    const rows = cat.groups.flatMap(g => g.items.map(it =>
      `<label class="svc"><input type="checkbox" value="${esc(it.key)}"><span>${esc(it.label)}</span><em>${esc(priceText(it))}</em></label>`)).join("");
    return `<details class="svc-cat" data-cat="${cat.id}"><summary><span>${esc(cat.title)}</span><b class="svc-count" hidden></b></summary><div class="svc-list">${rows}</div></details>`;
  }).join("");
  fTime.innerHTML = `<option value="">${esc(tt("time"))}</option>` + CONFIG.slots.map(s => `<option>${s}</option>`).join("");
  updatePicker();
}

/* Обновляет сводку, счётчики по разделам, список мастеров и свободное время после любого изменения выбора */
function updatePicker() {
  const items = pickedItems();
  svcBox.classList.remove("invalid");
  if (items.length) {
    const t = totals(items);
    svcSummary.innerHTML = `Выбрано: <b>${items.length}</b> · около <b>${esc(durText(t.min))}</b> · <b>${esc(t.price)}</b>`;
  } else svcSummary.textContent = "Выберите одну или несколько услуг";
  $$(".svc-cat", svcGroups).forEach(d => {
    const n = items.filter(s => s.cat === d.dataset.cat).length, b = $(".svc-count", d);
    b.hidden = !n; b.textContent = n;
  });
  updateMasters();
  scheduleSlots();
}

function updateMasters() {
  const items = pickedItems();
  const eligible = items.length ? MASTERS.filter(m => items.every(s => m.categories.includes(s.cat))) : MASTERS;
  const prev = fMaster.value;
  if (items.length && !eligible.length) {
    // услуги у разных мастеров (например маникюр + стрижка): запишем подряд
    fMaster.innerHTML = `<option value="">Подберём автоматически</option>`; fMaster.disabled = true;
    masterHint.textContent = "Эти услуги выполняют разные мастера — запишем вас к ним подряд.";
    masterHint.hidden = false;
  } else {
    fMaster.disabled = false; masterHint.hidden = true;
    fMaster.innerHTML = `<option value="">${esc(tt("anyMaster"))}</option>` + eligible.map(m => `<option value="${esc(m.name)}">${esc(m.name)} — ${esc(m.role)}</option>`).join("");
    if (eligible.some(m => m.name === prev)) fMaster.value = prev;
  }
}

/* ---------- свободное время ---------- */
function slotMsg(text, loading = false) {
  slotBox.innerHTML = `<p class="slot-msg${loading ? " loading" : ""}">${loading ? '<span class="spin" aria-hidden="true"></span>' : ""}${esc(text)}</p>`;
  slotPlan.hidden = true; fTime.hidden = true;
}
function goManual() {
  manual = true; chosen = null;
  slotMsg("Не удалось загрузить свободное время. Укажите желаемое — мы подтвердим его по телефону.");
  fTime.hidden = false;
}
function scheduleSlots() { clearTimeout(slotTimer); slotTimer = setTimeout(() => loadSlots(), 150); }

let lastSlotKey = "";
async function loadSlots(force = false) {
  clearTimeout(slotTimer);                                 // прямой вызов отменяет отложенный, чтобы не грузить дважды
  const items = pickedItems(), date = fDate.value;
  const key = items.map(s => s.key).join("|") + "@" + date + "@" + (fMaster.disabled ? "" : fMaster.value);
  if (!force && key === lastSlotKey && (chosen || slotData.length)) return;     // выбор не менялся: не сбрасываем выбранное время
  lastSlotKey = key;
  chosen = null; slotData = []; manual = false; slotBox.classList.remove("invalid");
  if (!items.length || !date) return slotMsg("Выберите услуги и дату");
  if (!SLOTS_URL) return goManual();                       // нет сервера записи (демо): время вводится вручную
  const my = ++slotReq;
  slotMsg("Ищем свободное время…", true);
  const qs = new URLSearchParams();
  items.forEach(s => qs.append("s", s.key));
  qs.set("date", date);
  if (fMaster.value && !fMaster.disabled) qs.set("master", fMaster.value);
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(SLOTS_URL + "?" + qs, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    if (my !== slotReq) return;                            // пришёл устаревший ответ
    renderSlots(data.slots || []);
  } catch (e) { if (my === slotReq) { console.warn("[VICTORIA] слоты недоступны:", e.message); goManual(); } }
  finally { clearTimeout(timer); }
}

let slotData = [];
function renderSlots(slots) {
  slotData = slots;
  if (!slots.length) return slotMsg("На эту дату свободного времени нет — выберите другую дату.");
  slotBox.innerHTML = slots.map(s => `<button type="button" class="slot" data-start="${s.start}" aria-pressed="false">${s.start}</button>`).join("");
  slotPlan.hidden = true;
}
slotBox.addEventListener("click", e => {
  const b = e.target.closest(".slot"); if (!b) return;
  $$(".slot", slotBox).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  chosen = slotData.find(s => s.start === b.dataset.start) || null;
  slotBox.classList.remove("invalid");
  if (chosen && chosen.plan.length > 1) {
    slotPlan.textContent = "Подряд: " + chosen.plan.map(p => `${p.master} ${p.start}–${p.end}`).join(" → ");
    slotPlan.hidden = false;
  } else slotPlan.hidden = true;
});

svcGroups.addEventListener("change", e => {
  const cb = e.target.closest("input[type=checkbox]"); if (!cb) return;
  pickedKeys = cb.checked ? [...pickedKeys, cb.value] : pickedKeys.filter(k => k !== cb.value);
  updatePicker();
});
fMaster.addEventListener("change", () => loadSlots());
fDate.addEventListener("change", () => loadSlots());

function resetPicker() {
  pickedKeys = []; chosen = null; manual = false; lastSlotKey = "";
  $$("input[type=checkbox]", svcGroups).forEach(c => c.checked = false);
  $$("details", svcGroups).forEach(d => d.open = false);
  updatePicker();
}

const today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
fDate.min = today.toISOString().slice(0, 10);

function openBooking({ master = "" } = {}) {
  form.hidden = false; success.hidden = true; formError.hidden = true; fSubmit.disabled = false;
  $$(".invalid", form).forEach(n => n.classList.remove("invalid"));
  if (master) fMaster.value = master;
  if (!dlg.open) dlg.showModal();
}
$$("[data-book]").forEach(b => b.addEventListener("click", () => { setMenu(false); openBooking(); }));
masterGrid.addEventListener("click", e => { const m = e.target.closest(".master"); if (m) openBooking({ master: m.dataset.master }); });
$$("[data-close]", dlg).forEach(b => b.addEventListener("click", () => dlg.close()));
dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });

/* маска телефона */
fPhone.addEventListener("input", () => {
  let d = fPhone.value.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  let r = "+7";
  if (d.length > 1) r += " (" + d.slice(1, 4);
  if (d.length >= 5) r += ") " + d.slice(4, 7);
  if (d.length >= 8) r += "-" + d.slice(7, 9);
  if (d.length >= 10) r += "-" + d.slice(9, 11);
  fPhone.value = r;
});

/* Отправка заявки. Без bookingEndpoint — демо-режим (заявка остаётся в браузере).
   Ответ 409: время только что заняли — бросаем ошибку с ближайшими свободными стартами. */
async function sendBooking(b) {
  if (!CONFIG.bookingEndpoint) {
    console.warn("[VICTORIA] bookingEndpoint не задан — заявка сохранена только в этом браузере.");
    try { const all = JSON.parse(localStorage.getItem("victoria_bookings") || "[]"); all.push(b); localStorage.setItem("victoria_bookings", JSON.stringify(all)); } catch (_) {}
    return;
  }
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(CONFIG.bookingEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b), signal: ctrl.signal });
    if (r.status === 409) { const data = await r.json().catch(() => ({})); throw Object.assign(new Error("taken"), { taken: true, alternatives: data.alternatives || [] }); }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json().catch(() => ({}));                  // { ok, visit, plan } у нового сервера; у старого может быть пусто
  } finally { clearTimeout(timer); }
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (fSubmit.disabled) return;
  const bad = [];
  const mark = (node, ok, focusNode = node) => { node.classList.toggle("invalid", !ok); if (!ok) bad.push(focusNode); };
  mark(svcBox, pickedKeys.length > 0, $("input", svcGroups));
  mark(fDate, fDate.value !== "");
  if (manual) mark(fTime, fTime.value !== ""); else mark(slotBox, !!chosen, slotBox);
  mark(fName, fName.value.trim() !== "");
  mark(fPhone, fPhone.value.replace(/\D/g, "").length === 11);
  if (bad.length || !fConsent.checked) {
    formError.textContent = !fConsent.checked && !bad.length ? tt("needConsent") : tt("checkFields");
    formError.hidden = false;
    const first = bad[0] || fConsent;
    first.scrollIntoView?.({ block: "center", behavior: "smooth" });
    if (first.focus && first !== slotBox) first.focus({ preventScroll: true });
    return;
  }
  formError.hidden = true;

  const items = pickedItems();
  const start = manual ? fTime.value : chosen.start;
  const booking = {
    services: items.map(s => s.key), serviceLabels: items.map(s => s.label),
    date: fDate.value, start, master: fMaster.disabled ? "" : fMaster.value, manual,
    name: fName.value.trim(), phone: fPhone.value, createdAt: new Date().toISOString(),
    consent: true,                                             // согласие на обработку данных (чекбокс обязателен)
    website: fWebsite.value,                                   // ловушка для ботов: у людей пусто
    // совместимость со старой версией приёма заявок (Supabase): она читает service/time
    service: items.map(s => s.label).join("; ").slice(0, 150), time: start,
  };

  fSubmit.disabled = true; fSubmit.setAttribute("aria-busy", "true");
  let reply = {};
  try { reply = (await sendBooking(booking)) || {}; }
  catch (err) {
    fSubmit.disabled = false; fSubmit.removeAttribute("aria-busy");
    if (err.taken) {
      formError.textContent = err.alternatives.length
        ? `Это время только что заняли. Свободно рядом: ${err.alternatives.join(", ")}. Выберите другое.`
        : "Это время только что заняли. Выберите другое время или дату.";
      formError.hidden = false; loadSlots(true); return;
    }
    console.error("[VICTORIA] не удалось отправить заявку:", err);
    formError.textContent = tt("sendFail"); formError.hidden = false;
    return;
  }
  fSubmit.removeAttribute("aria-busy");

  const d = new Date(booking.date + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  $("#successText").textContent = tt("success")(booking.name, d, booking.start);
  const wa = $("#successWa");
  if (CONFIG.whatsapp) {
    wa.href = waLink(tt("waText")(booking.service, booking.master || "Любой", d, booking.start, booking.name)); wa.hidden = false;
  } else wa.hidden = true;
  // Telegram-бот: клиент нажимает ссылку и получает подтверждение и напоминания
  const tgBtn = $("#successTg"), tgNote = $("#successTgNote");
  const tgOn = !!(CONFIG.telegramBot && reply.visit);
  tgBtn.hidden = tgNote.hidden = !tgOn;
  if (tgOn) tgBtn.href = `https://t.me/${CONFIG.telegramBot}?start=booking_${reply.visit}`;
  form.hidden = true; success.hidden = false; form.reset(); resetPicker();
  window.goal?.("booking_sent");
});

/* =========================================================
   Лайтбокс портфолио
   ========================================================= */
const lb = $("#lightbox"), lbStage = $("#lbStage"), lbCap = $("#lbCaption"), lbImg = $("#lbImg");
let lbIndex = 0;
function showWork(i) {
  if (!lbItems.length) return;
  lbIndex = (i + lbItems.length) % lbItems.length;
  const w = lbItems[lbIndex];
  if (w.photo) {                                           // настоящее фото из content.json
    lbStage.className = "lb-stage photo";
    lbStage.style.removeProperty("--img");
    lbImg.src = encodeURI(`media/works/web/${w.photo.replace(/\.[^.]+$/, "")}-1600.webp`);
    lbImg.alt = w.caption || "";
    lbImg.hidden = false;
    lbCap.textContent = w.caption || "";
  } else {                                                 // заглушка
    lbStage.className = `lb-stage ph ${w.cls}`;
    lbStage.style.setProperty("--img", `url(${w.img})`);
    lbStage.removeAttribute("data-hint");
    lbImg.hidden = true; lbImg.removeAttribute("src");
    lbCap.textContent = w.label;
  }
}
pGrid.addEventListener("click", e => { const b = e.target.closest(".work"); if (!b) return; showWork(+b.dataset.index); lb.hidden = false; $(".lb-close", lb).focus(); document.body.style.overflow = "hidden"; });
const closeLb = () => { lb.hidden = true; document.body.style.overflow = ""; };
$(".lb-close", lb).addEventListener("click", closeLb);
$(".lb-prev", lb).addEventListener("click", () => showWork(lbIndex - 1));
$(".lb-next", lb).addEventListener("click", () => showWork(lbIndex + 1));
lb.addEventListener("click", e => { if (e.target === lb) closeLb(); });
document.addEventListener("keydown", e => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLb();
  if (e.key === "ArrowLeft") showWork(lbIndex - 1);
  if (e.key === "ArrowRight") showWork(lbIndex + 1);
});

/* =========================================================
   Первый рендер
   ========================================================= */
renderContacts(); renderMasters(); renderPrices(); renderInstagram();
renderFaq(); renderSelects();
watchPhotos();
/* Портфолио, отзывы и видео зависят от content.json: рисуем, когда он загрузится (если его нет — остаются заглушки) */
loadContent().then(() => { renderWorks(); renderReviews(); renderVideo(); watchPhotos(); });

/* Страницы услуг ведут на главную со ссылкой /?book=1 — сразу открываем форму записи */
if (new URLSearchParams(location.search).has("book")) {
  history.replaceState(null, "", location.pathname + location.hash);
  openBooking();
}
