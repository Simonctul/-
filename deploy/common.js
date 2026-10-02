/* =========================================================
   VICTORIA — общее для всех страниц: Яндекс.Метрика (только с согласием на cookie)
   и регистрация service worker. Нужен data.js (CONFIG) перед этим файлом.
   ========================================================= */
(() => {
  const ID = String(CONFIG.metrikaId || "").trim();
  const KEY = "victoria_cookie_consent";
  const read = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const write = v => { try { localStorage.setItem(KEY, v); } catch (_) {} };
  let loaded = false;

  function loadMetrika() {
    if (loaded || !ID) return;
    loaded = true;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    window.ym(Number(ID), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }

  /* Цель в Метрике. Без id или без согласия ничего не делает. */
  window.goal = name => { if (loaded && window.ym) window.ym(Number(ID), "reachGoal", name); };

  /* Цели по кликам: «Записаться», телефон, «Построить маршрут» */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-book],[data-goal-book],a[href^='tel:'],[data-route]");
    if (!t) return;
    if (t.matches("[data-book],[data-goal-book]")) window.goal("book_click");
    else if (t.matches("a[href^='tel:']")) window.goal("phone_click");
    else if (t.matches("[data-route]")) window.goal("route_click");
  });

  /* Баннер cookie показываем, только если есть что включать (задан metrikaId) */
  function banner() {
    const b = document.createElement("div");
    b.className = "cookie-banner";
    b.setAttribute("role", "dialog");
    b.setAttribute("aria-label", "Согласие на cookie");
    b.innerHTML = `<p>Мы используем cookie и сервис «Яндекс.Метрика», чтобы понимать, как посетители пользуются сайтом. Вы можете отказаться. <a href="/privacy/">Подробнее</a></p>
      <div><button type="button" class="btn btn-small" data-cookie="yes">Принять</button>
      <button type="button" class="btn btn-small btn-ghost" data-cookie="no">Отказаться</button></div>`;
    b.addEventListener("click", e => {
      const v = e.target.closest("[data-cookie]")?.dataset.cookie;
      if (!v) return;
      write(v); b.remove();
      if (v === "yes") loadMetrika();
    });
    document.body.append(b);
  }
  if (ID) {
    const c = read();
    if (c === "yes") loadMetrika();
    else if (c !== "no") banner();
  }

  /* Service worker: только по https (и на localhost) */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
})();
