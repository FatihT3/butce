// =====================================================
// Bütçe — çevrimdışı çalışma (service worker)
// Uygulama dosyalarını telefonda saklar; internet yokken de açılır.
//
// - Uygulama sayfası: önce internetten (en güncel sürüm gelsin), internet yoksa
//   ya da 4 sn içinde cevap gelmezse telefondaki kopyadan.
// Kayıtlar bu dosyayla ilgili değildir; onlar localStorage'da durur.
// =====================================================
const ONBELLEK = "butce-v1";
const UYGULAMA_DOSYALARI = ["./", "./index.html", "./icon.png"];

// Kurulum: uygulama dosyalarını sakla
self.addEventListener("install", olay => {
  olay.waitUntil(caches.open(ONBELLEK).then(c => c.addAll(UYGULAMA_DOSYALARI)));
  self.skipWaiting();
});

// Etkinleşme: eski sürüm önbelleklerini sil
self.addEventListener("activate", olay => {
  olay.waitUntil(
    caches.keys()
      .then(adlar => Promise.all(adlar.filter(a => a !== ONBELLEK).map(a => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

// İnternetten dene; süre dolarsa ya da hata olursa saklanan kopyayı ver
function oncelikInternet(istek) {
  return new Promise(tamam => {
    let bitti = false;
    const yedegeDon = () => {
      if (bitti) return;
      caches.match(istek, { ignoreSearch: true }).then(kopya => {
        if (kopya && !bitti) { bitti = true; tamam(kopya); }
      });
    };
    const zamanlayici = setTimeout(yedegeDon, 4000);

    fetch(istek).then(cevap => {
      clearTimeout(zamanlayici);
      if (cevap && cevap.ok) {
        const kopya = cevap.clone();
        caches.open(ONBELLEK).then(c => c.put(istek, kopya));
      }
      if (!bitti) { bitti = true; tamam(cevap); }
    }).catch(() => {
      clearTimeout(zamanlayici);
      caches.match(istek, { ignoreSearch: true }).then(kopya => {
        if (!bitti) { bitti = true; tamam(kopya || Response.error()); }
      });
    });
  });
}

self.addEventListener("fetch", olay => {
  const istek = olay.request;
  if (istek.method !== "GET") return;
  if (new URL(istek.url).origin === self.location.origin) {
    olay.respondWith(oncelikInternet(istek));
  }
});
