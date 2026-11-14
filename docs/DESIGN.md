# DESIGN — BaliTrade

Panduan UI. Visual source of truth: `design-ui/google-stitch/01-v4.html` (token sudah ada di `apps/web/src/app/globals.css`); halaman Stitch lain
(`02-lengkap`, `03`–`08`) hanya acuan **alur dan struktur**. Dokumen ini dulunya `UI_PROMPT.md` (prompt Google Stitch + log revisi, 98 KB); prompt lengkap dan
log revisinya masih ada di riwayat git (`git log -- UI_PROMPT.md`; versi terakhir: `git show 3d9ebce:UI_PROMPT.md`). Yang dipertahankan di sini: progres, aturan implementasi, design system,
dan spesifikasi layar (`TASK`) per halaman untuk halaman yang belum dibuat.

## Progress

Status: `Belum` · `Prompt siap` · `Sudah di-generate` · `Direvisi` · `Final`

| # | Halaman | Status | Catatan |
|---|---|---|---|
| 1 | Design system | Final | Stitch: `design-ui/google-stitch/01-v4.html` (acuan); draf lama 01, 01-v2, 01-v3 dan 02 dihapus 2026-10-30, masih ada di riwayat git; hasil AI Studio (pembanding) sudah dihapus dari repo |
| 2 | Landing page | **Dibubarkan 2026-11-06 (T16b)** | Halaman depan `/` sekarang **adalah katalog** (lihat baris 3). Yang dulu ada di sini pindah ke `/how-it-works` (baris 12): 4 kartu kepercayaan, cara kerja 6 langkah, FAQ, ajakan jadi penjual. Hero, kolase foto, dan kisi kategori dihapus. Sisa di halaman depan: satu baris tipis berisi 3 butir kepercayaan + tautan "How it works" dan "Sell on BaliTrade". Spesifikasi lama ada di riwayat git |
| 3 | Katalog / pencarian produk | Final (jadi halaman depan 2026-11-06) | Stitch: `design-ui/google-stitch/03.html` (acuan alur); ada pergeseran tema visual, lihat catatan bagian 3. Sejak T16b katalog berada di `/` (bukan `/products`), kolom pencarian pindah ke navbar, dan filter kategori jadi baris chip |
| 4 | Detail produk (+ chat bertiga) | Final | Stitch: `design-ui/google-stitch/04.html`; lihat catatan bagian 4. Keputusan cart & varian sudah diambil (BRAINSTORMING 5a) |
| 5 | Profil penjual | Final | Stitch: `design-ui/google-stitch/05.html` (acuan alur); lihat catatan bagian 5 |
| 6 | Form Request (sourcing) | Final | Stitch: `design-ui/google-stitch/06.html` (acuan alur); lihat catatan bagian 6 |
| 7a | Keranjang & kirim order request (+ status konfirmasi penjual) | Final | Stitch: `design-ui/google-stitch/07-a.html`; lihat catatan bagian 7a |
| 7b | Pembayaran & upload bukti | Final | Stitch: `design-ui/google-stitch/07-b.html`; lihat catatan bagian 7b |
| 8 | Detail order (approval QC, tagihan ongkir, tracking, terima barang) | Final | Stitch: `design-ui/google-stitch/08.html`; lihat catatan bagian 8. **Tahap desain Stitch selesai.** |
| 9 | Ruang chat | Dilewati (dibuat saat implementasi) | Komponen sudah ada di chat drawer halaman 4 |
| 10 | Dashboard penjual | **Ditulis ulang 2026-11-14 (T28)** | Area `/seller` punya chrome sendiri: **sidebar terang** 240px di `lg` ke atas, **bottom tab bar** di bawahnya, top bar (judul halaman · pencarian listing sendiri · bahasa · lonceng · avatar). Menu: Dasbor · Pesanan · Produk · Chat BaliTrade (nonaktif, T29) · Profil Toko. Dasbor = header toko + kartu kelengkapan profil + 4 tile "perlu tindakan Anda" + 4 tile "toko Anda" + panel pesanan menunggu jawaban + panel listing terbaru. Sebelumnya (T16c) hanya 3 kartu angka tanpa sidebar |
| 11 | Dashboard admin | **Dibuat 2026-11-06 (T17b)** | Layout `/admin` sendiri: sidebar teal gelap 240px + top bar polos, tanpa navbar/footer toko dan tanpa pencarian produk. Menu: Ringkasan · Penjual · Listing · Pesanan · Kurs (mengikuti peran). Pembayaran, QC, pengiriman, pencairan menyusul di T17–T20 sebagai entri baru di `ADMIN_NAV` |
| 12 | How It Works (halaman penjelasan lengkap: alur, QC, pembayaran, FAQ lengkap) | **Dibuat 2026-11-06 (T16b)** | `/how-it-works`: cara kerja 6 langkah, 4 kartu kepercayaan, metode bayar (3 kartu, tanpa detail rekening), pengiriman & pelacakan, FAQ 5 butir, ajakan jadi penjual. Jangkar `#payment` dan `#shipping` dipakai footer |

---

## Catatan implementasi (ringkasan — WAJIB dibaca sebelum coding UI)

Hal yang sengaja tidak direvisi di Stitch dan harus dibereskan saat implementasi. Detail per halaman ada di bagian "Catatan implementasi" masing-masing.

- **Sumber kebenaran visual = design system `01-v4.html`** (token warna, font, radius 12px, ikon Lucide, badge, kartu, chat bubble). Halaman lain hanya acuan alur/struktur.
- **Area penjual punya chrome sendiri sejak T28 (2026-11-14), dan sengaja tidak mirip area admin.** Sidebar penjual **terang**
  (`bg-card` + border, item aktif `bg-primary/5` dengan garis `border-gold` di kiri), bukan teal gelap seperti admin: penjual bukan staf dan
  tidak boleh merasa berada di panel admin. Badge "SELLER" memakai **`text-gold-text`**, bukan `text-gold` — gold #c9a24a di atas putih tidak
  lolos kontras 4,5:1, dan token itu memang ada untuk kasus ini.
- **Di bawah `lg` penjual mendapat bottom tab bar, bukan drawer** (T28). Admin bekerja di laptop, penjual di ponsel: navigasi utama di balik
  hamburger salah untuk mereka. Karena itu area penjual **tidak punya drawer sama sekali** — satu state lebih sedikit. Konten dapat `pb-24` dan
  bar-nya `pb-[env(safe-area-inset-bottom)]` supaya baris terakhir tidak tertutup di iPhone. Label bottom bar memakai kunci `navShort` yang
  terpisah: "Pengaturan Profil Toko" tidak muat di tab selebar 75px.
- **Item menu yang fiturnya belum ada dirender sebagai teks, bukan tautan** (`soon` di `SELLER_NAV`): tidak bisa diklik, dilewati Tab, dan
  diberi pill "Segera". Tempatnya terlihat tanpa jadi jalan buntu.
- **Top bar adalah satu-satunya judul halaman di area penjual**, sama seperti area admin sejak 2026-11-12. Halaman di dalamnya tidak menulis
  `h1` dan tidak membuat container sendiri. Dua pengecualian yang sengaja: `/seller` dan `/seller/account` **menulis `h1` saat pengunjungnya
  belum punya peran SELLER**, karena `/seller` juga pintu pendaftaran penjual — orang itu masih pembeli, jadi shell menampilkan chrome toko
  yang memang tidak punya judul halaman.
- **Arti "halaman depan" berbeda per peran (T16c, 2026-11-06):** pembeli → `/` katalog, penjual → `/seller` dasbor, admin → area admin. Login dan logo mengikuti satu aturan di `homePathFor()` (`apps/web/src/lib/home-path.ts`); penjual dan admin punya "Lihat toko" di menu avatar. **Akun admin khusus admin** — menunya tanpa "Pesanan saya" dan "Jual di BaliTrade".
- **Navbar & footer = 1 komponen standar** untuk semua halaman. **Navbar diubah 2026-11-06 (T16b)** dan tidak lagi mengikuti design system di titik ini: isinya hanya logo, kolom pencarian, language switcher, lonceng notifikasi, dan avatar bulat (tanpa satu pun tautan teks permanen — halaman pribadi dan admin ada di menu avatar). Alasannya tercatat di `docs/DECISIONS.md`. Footer tetap: About, For Buyers, For Sellers, Support (FAQ, Contact, Terms of Service, Privacy Policy); abaikan variasi link karangan di tiap halaman Stitch.
- **Jangan pakai kata "escrow"** di UI → "Payment protection" / "Payment held by BaliTrade until delivery".
- **Tanpa janji yang belum diputuskan**: SLA respons/verifikasi, waktu kirim, jadwal mingguan/Jumat, rute langsung, dokumen bea cukai negara tujuan, sertifikasi.
- Halaman 2 (landing): hapus "weekly"/"customs documents" di For Sellers; sesuaikan teks "custom sourcing"; pertimbangkan meringkas (trust strip duplikat). Teks FAQ QC gagal ganti jadi: "We'll first help you find a replacement. If you prefer, you can get a full refund."
- Halaman 3 (katalog): tema Stitch bergeser ke Material (bg `#f8f9ff`, primary `#003441`, radius 4px, Material Symbols) → pakai token design system; filter kabupaten lengkap 9 (tambah Klungkung, Jembrana). **Pergeseran tema Material yang sama terjadi juga di halaman 5 & 6** (tampaknya pengaturan tema project Stitch, tidak hilang walau dilarang di prompt).
- Halaman 5–6: hapus klaim/angka karangan ("Certified Export Clearing Agent", "guarantees", "140+ Verified Artisans", "sea freight", "escrow" di footer); state sukses request jangan menyebut nama pembeli sebagai "sourcing officer".
- Halaman 7a–7b (keranjang & pembayaran): tema Material juga. Hapus SLA "Sellers usually confirm within 2 to 6 business hours", "Quality Guarantee / 100% refund / immediate replacements" (pakai: "we help find a replacement or give a full refund"), jendela penerbangan "Nov 14–16", "Departing Friday", rute "direct lanes to SVO, ALA, TAS", "Denpasar Hub / laser sizing", "Three-Party Custody", "Direct Cooperative Mill #042", label "Global Escrow" di opsi USDT, "escrow" di top bar & footer, "English / USD" di footer. Helper nama: hanya "As shown on your ID" (tanpa "business registration"). "Stock reserved during active request session" & "door/courier delivery" → belum diputuskan, jangan ditampilkan dulu.
- Halaman 8 (detail order): tema Material; hapus "TRC20", SLA "Estimated report", fasilitas/depot karangan, pelabuhan laut di footer; baris "Export documentation & phytosanitary" di tagihan ongkir menunggu keputusan.
- Halaman 4 (detail produk): hapus klaim berlebihan (Lab Verified, QC Pass Rate 100%, Organic, "fully handled" dokumen, "Live AWB"), hapus label "Verified Buyer", tampilkan estimasi total (subtotal + QC fee, ongkir menyusul), state guest → login dulu sebelum Buy/Ask.

---

## Blok DESIGN SYSTEM (referensi)

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries (Kazakhstan, Uzbekistan, Kyrgyzstan, Armenia, Belarus, etc.). The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce (think Alibaba / Faire level of clarity, but calmer and more premium), with a subtle Balinese touch. Lots of white space, clear hierarchy, card-based layout, rounded corners 12px, soft shadows, no clutter. Desktop-first web layout (1440px, max content width 1280px) that is fully responsive for mobile (390px).

Colors:
- Primary: deep teal #0F4C5C (main buttons, navbar accents, links, active states)
- Primary hover/dark: #0B3A46
- Accent: warm gold #C9A24A (highlights, badges like "Verified", small decorative lines, star ratings)
- Secondary: terracotta #B5563A (secondary emphasis, "Made to order" badge, small illustrations)
- Background: warm off-white #FAF7F2; cards: white #FFFFFF; borders: #E7E2D9
- Text: charcoal #1F2937; muted text: #6B7280
- Status: success #2E7D5B, warning #D99A2B, error #C0392B, info #2F6F8F

Typography: "Plus Jakarta Sans" for everything. H1 40–48px bold, H2 28–32px semibold, H3 20px semibold, body 16px, small 14px, caption 12px. Prices in bold tabular numbers.

Balinese touch: a VERY subtle, low-opacity line pattern inspired by Balinese ornaments (or a thin gold divider line) used only in the hero section background and footer. Photography: natural, warm, real products (coffee beans, woven bags, handicrafts, apparel), no stock-model clichés.

Components:
- Buttons: primary (teal fill, white text), secondary (white with teal border), ghost (text only). Height 44px, radius 10px.
- Badges (pill): "Ready stock" (teal light bg), "Made to order" (terracotta light bg), "Verified seller" (gold icon + text), "QC included" (green check), "Auto-translated" (gray).
- Product card: image 4:3, product name, seller name + regency location (e.g. "Gianyar, Bali"), price in USD (e.g. "$4.20 / kg"), MOQ (minimum order), listing type badge.
- Inputs with labels above, helper text below, clear error states.
- Icons: simple outline icon set (Lucide style).

Global navbar (all buyer-facing pages): logo "BaliTrade" (text logo with a small gold leaf/frangipani mark) on the left; menu: Products, Request a Product, How It Works, Sell on BaliTrade; on the right: search icon, language switcher (EN / ID / RU, shows a globe icon + "EN"), "Log in" (ghost) and "Sign up" (primary). On mobile: hamburger menu, logo, search and language switcher.

Global footer: dark teal background #0B3A46, white text, subtle Balinese pattern. Columns: About BaliTrade, For Buyers (How it works, Request a product, Payment methods, Shipping & tracking), For Sellers (Sell on BaliTrade, Seller guidelines), Support (FAQ, Contact, Terms of Service, Privacy Policy). Bottom row: language switcher (English / Bahasa Indonesia / Русский), "© BaliTrade", note: "Bali, Indonesia → Russia & CIS".

Currency: all prices shown in USD.
Languages: UI available in English (default), Indonesian, Russian. Show English text in designs.
```

---

## Layout admin (diputuskan 2026-10-30, dibangun di T17b)

Area `/admin` tampil **terpisah dari toko**, supaya jelas sedang di mana dan muat banyak menu. Token tema tetap sama (teal, gold, Plus Jakarta Sans, radius 12px, ikon Lucide).

- **Sidebar kiri** 240px, teal gelap `#0B3A46` (warna footer), teks putih. Menu aktif: latar sedikit lebih terang + garis gold `#C9A24A` di kiri. Atas: logo "BaliTrade" dengan penanda **ADMIN**. Bawah: tautan "← Back to site".
- **Top bar** di area konten: judul halaman, language switcher, **ikon pesan (✉, hanya di sini — jangan diduplikat di sidebar)** dan menu avatar bulat (nama, logout). **Tanpa navbar dan footer toko.** Latar konten off-white `#FAF7F2`, isi dalam kartu putih seperti halaman lain. Dikonfirmasi pemilik 2026-11-06.
- **Tanpa pencarian produk di area admin.** Pencarian toko hanya mengembalikan produk APPROVED dari penjual APPROVED — kebalikan dari yang dikerjakan admin. Tiap daftar admin punya filternya sendiri; pencarian admin lintas data ditambahkan nanti kalau memang dibutuhkan.
- **Halaman Overview** (menu pertama): angka pekerjaan yang menunggu — penjual belum disetujui, listing belum ditinjau, order perlu tindakan — masing-masing bisa diklik ke daftar yang sudah terfilter, plus kurs yang berlaku. Tanpa halaman kelola pembeli: pembeli tidak disetujui atau dimoderasi.
- **Menu mengikuti peran** dan hanya memuat halaman yang sudah ada: `ADMIN_OPS` melihat penjual, listing (nanti QC dan tracking); `ADMIN_FINANCE` melihat pembayaran; `ADMIN_OWNER` melihat semuanya plus kurs dan pencairan.
- **Satu wadah konten untuk seluruh area admin** (dirapikan 2026-11-12): `admin-shell.tsx` memberi `max-w-[1120px]` dengan
  `px-4 py-8 sm:px-6 sm:py-10`, dan **halaman tidak boleh memasang wadahnya sendiri lagi**. Rata kiri, bukan `mx-auto`, karena top bar
  di atasnya full-width dengan gutter yang sama — jadi tepi kiri isi sejajar dengan judul halaman, tidak melayang ke tengah di layar lebar.
  Sebelumnya tiap halaman mengarang sendiri: tiga lebar berbeda (3xl/4xl/5xl), tiga padding vertikal, dan halaman Kategori tanpa padding
  sama sekali — itulah yang membuatnya terasa tidak seragam. Formulir sempit membatasi **kartunya sendiri** (mis. `max-w-3xl` di halaman
  kurs), bukan halamannya. Komponen order dipakai bersama toko, jadi wadahnya ada di call site: halaman toko membungkus, halaman admin tidak.
- **Aksi berisiko di halaman admin: dua pengaman berbeda, sesuai sifat aksinya** (diputuskan pemilik 2026-11-13, di
  `/admin/categories`). Centang "Tampil di toko" itu klik yang sering dan mudah salah, jadi **ditunda**: tampilan berubah,
  tapi tidak ada yang dikirim ke API sampai tombol **Simpan perubahan** ditekan, lengkap dengan badge "akan disembunyikan"
  per baris dan tombol Batalkan. Mengarsipkan itu jarang dan memindahkan baris keluar dari daftar, jadi sebaliknya:
  **tanya dulu lewat dialog, lalu simpan seketika** — menundanya berarti ada baris menunggu di bagian yang salah karena
  Simpan tidak ditekan. Daftarnya dipisah jadi **Aktif** dan **Arsip** supaya admin langsung tahu mana yang tampil di toko.
  Pola ini layak dipakai ulang di halaman admin berikutnya: tunda yang sering dan ringan, konfirmasi yang jarang dan besar.
- **Judul halaman hanya ada di top bar** (dirapikan 2026-11-12), dan itu satu-satunya `<h1>` di area admin. Body halaman **tidak
  mengulangnya**; ia langsung mulai dari paragraf penjelas atau dari isinya. Sebelumnya campur aduk: `h1` di Penjual/Listing/Kurs/Pesanan,
  `h2` dengan ukuran sama di Ringkasan/Pembayaran, dan Kategori tanpa judul sama sekali — tiga tag untuk satu peran visual, plus "Orders"
  tertulis dua kali di `/admin/orders` (wart lama yang ini menutupnya). Halaman **detail** boleh punya judul sendiri karena menyebut sesuatu
  yang lebih spesifik dari nama seksi (nama produk, kode order), dan itu `<h2>`. Elemen pertama di body tidak boleh membawa `mt-*` sisa judul,
  atau tiap halaman mulai di ketinggian berbeda. Komponen order dipakai bersama toko, jadi judulnya ada di halaman toko, bukan di komponennya.
- **Layar kecil:** sidebar menjadi laci yang dibuka dari tombol menu; fokus keyboard terlihat; menu aktif diberi `aria-current`.
- Rencana teknis: pisahkan chrome toko dan admin lewat route group atau pembungkus yang menyembunyikan navbar/footer di `/admin`; pilih yang paling kecil risikonya saat mengerjakan.
- Wireframe (▓ = teal gelap, ▌ = penanda gold menu aktif):

```
┌────────────┬───────────────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓│  Sellers              EN   Oscar ▾│
│▓ BaliTrade▓├───────────────────────────────────┤
│▓ ADMIN    ▓│                                   │
│▓▓▓▓▓▓▓▓▓▓▓▓│  ┌─────────────────────────────┐  │
│▓ Overview ▓│  │ Seller applications         │  │
│▓▌Sellers  ▓│  │ [Pending] [Approved] [All]  │  │
│▓ Listings ▓│  │                             │  │
│▓ Rates    ▓│  │  card ... card ... card     │  │
│▓▓▓▓▓▓▓▓▓▓▓▓│  └─────────────────────────────┘  │
│▓ ← Site   ▓│                                   │
└────────────┴───────────────────────────────────┘
```

---

## 1. Design system

Final: `design-ui/google-stitch/01-v4.html` (12 bagian: logo, palet, tipografi, tombol, badge, form, kartu produk, kartu penjual, chat 3 pihak, banner, language switcher, navbar & footer). Token tertanam di `globals.css`. Blok design system tertulis di atas.

## 2. Landing page

Acuan: `design-ui/google-stitch/02-lengkap.html`

```
TASK: Design the public LANDING PAGE for BaliTrade (desktop 1440px, plus a mobile 390px version). Sections from top to bottom:

1. NAVBAR as described.

2. HERO (off-white background with very subtle Balinese ornament pattern on one side, and a large warm photo collage on the right: green coffee beans in a sack, woven rattan bags, wooden handicrafts, folded apparel):
   - Small eyebrow label in gold: "Bali → Russia & CIS"
   - H1: "Source authentic products from Bali — inspected, packed and shipped for you"
   - Subtext: "BaliTrade connects you with verified Bali sellers. Our team checks every order before it ships, and your payment is held safely until your goods arrive."
   - Primary button "Browse products", secondary button "Request a product"
   - Search bar under buttons: placeholder "Search coffee, bags, socks, handicrafts…" with search button
   - Under the search bar, 3 small trust checkmarks inline: "Quality control on every order", "Payment held until delivery", "Air cargo to Russia & CIS"

3. TRUST STRIP (4 white cards in a row with outline icons):
   - "Quality Control" — "We inspect goods and send you photos & videos before shipping."
   - "Protected payment" — "Your money is held by BaliTrade and released to the seller only after delivery."
   - "Talk to everyone" — "Every chat includes you, the seller and the BaliTrade team."
   - "Door to airport" — "We handle packing, export documents and air cargo."

4. HOW IT WORKS (horizontal 6-step timeline with numbered gold circles, connected by a thin line):
   1 "Find or request" — browse ready-stock products or request anything you need
   2 "Discuss" — chat with the seller and our team, agree on details
   3 "Pay securely" — bank transfer or USDT, held by BaliTrade
   4 "Quality check" — we inspect and send you a photo/video report to approve
   5 "Ship" — we pack and send by air cargo with tracking
   6 "Receive" — confirm arrival, then the seller gets paid
   Link below: "Learn more about how it works →"

5. BROWSE BY CATEGORY (grid of 6 image tiles with label overlay): Coffee & Tea, Apparel & Accessories (socks, hats, t-shirts), Bags & Rattan, Handicrafts & Wood, Home Decor, Spices & Food. Plus a 7th dashed-border tile: "Can't find it? Request it →".

6. FEATURED PRODUCTS (section title "Ready to ship from Bali" + "View all" link; 4-column grid of 8 product cards). Each card: photo, product name, seller name + regency (e.g. "Ubud Weavers · Gianyar, Bali"), "Verified" gold badge, price in USD (e.g. "$6.80 / kg", "$1.90 / pair", "$12.50 / piece"), "MOQ 50 pcs", and a listing-type badge ("Ready stock" or "Made to order"). Example products: Kintamani Arabica Green Beans, Bali Robusta Roasted Beans, Hand-woven Ata Grass Bag, Rattan Round Bag, Cotton Batik Socks, Bucket Hat Batik Pattern, Carved Wooden Bowl, Coconut Shell Bowl Set.

7. REQUEST A PRODUCT BANNER (full-width teal card with subtle pattern, white text):
   - Title: "Looking for something specific or a bigger quantity?"
   - Text: "Tell us what you need — product, quantity, budget and deadline. Our team will search across Bali and get back to you with an offer."
   - Primary button (gold background, dark text): "Submit a request"
   - Small text: "Example: 200 kg Arabica coffee, 1,000 pairs of socks, custom-logo hats."

8. QC & DOCUMENTATION PREVIEW (two columns): left text — title "See your goods before they ship", bullets: "Photo & video report of your actual goods", "Weight, quantity and packaging checked", "You approve before we ship", "QC fee depends on seller location in Bali — shown before you pay". Right: a mock UI card of a "QC Report" showing 3 photo thumbnails, a video thumbnail with play icon, checklist items with green checks (Quantity: 200 pcs ✓, Packaging: OK ✓, Matches description ✓) and two buttons "Approve shipment" and "Ask a question".

9. PAYMENT METHODS (simple row of 2 cards):
   - "Bank transfer (IDR)" — "Transfer to our Indonesian bank account and upload your receipt."
   - "USDT" — "Send USDT to our wallet and submit the transaction hash and screenshot."
   - Note under cards: "All payments are verified by our team and held until your order is delivered."

10. FOR SELLERS (split section, warm photo of a Balinese artisan at work on the left): title "Sell your Bali products to Russia & CIS", text "Register, get verified by our team, and list your products. We handle buyers, quality control, export and shipping.", button "Become a seller".

11. FAQ (accordion, 5 items): "How does BaliTrade protect my payment?", "What if the goods don't pass quality control?", "Can I order more than the stock shown?", "Which countries do you ship to?", "How long does shipping take?".

12. FOOTER as described.

Mobile version: single column, hero photo below text, trust strip as 2x2 grid, how-it-works as vertical timeline, product grid 2 columns, sticky bottom is NOT needed on landing.
```

Catatan implementasi (diperbaiki saat coding, tidak direvisi di Stitch):
- Bagian For Sellers masih menyebut "customs documents, and weekly …" → hapus "weekly" & "customs documents" (jadwal belum diputuskan).
- "Custom Concierge Sourcing", "custom-labeled batik hats" → sesuaikan dengan layanan yang benar-benar ada.
- Pertimbangkan meringkas landing saat implementasi (trust strip duplikat dengan checkmark di hero; QC preview & payment methods bisa dipindah ke halaman How It Works).

---

## 3. Katalog / pencarian produk

Acuan: `design-ui/google-stitch/03.html`

Sudah diimplementasikan: `/products` (T12). Spesifikasi layar aslinya ada di riwayat git; yang berlaku sekarang adalah kode dan catatan di bawah.

Catatan implementasi (tidak direvisi di Stitch):
- **Pergeseran tema visual**: Stitch memakai tema Material — background `#f8f9ff` (bukan `#FAF7F2`), primary `#003441` (bukan `#0F4C5C`), radius default 4px (bukan 12px), ikon Material Symbols (bukan Lucide). Saat coding pakai token dari design system `01-v4.html`. Prompt halaman 4+ sudah ditambah larangan tema Material.
- Footer tidak sama dengan design system (link karangan: "Ocean & Air Cargo", "Export Certification", "Freight Broker Desk", "Import Regulations"; tanpa FAQ/Contact/Terms/Privacy). Saat coding pakai footer standar (1 komponen untuk semua halaman).
- Kata "escrow" muncul di top bar & footer → ganti "Payment protection".
- Filter kabupaten belum memuat Klungkung & Jembrana → tampilkan 9 kabupaten.

---

## 4. Detail produk (+ chat bertiga)

Acuan: `design-ui/google-stitch/04.html`

Sudah diimplementasikan: `/products/[id]` (T12). Spesifikasi layar aslinya ada di riwayat git; yang berlaku sekarang adalah kode dan catatan di bawah.

Catatan implementasi (tidak direvisi di Stitch):
- Klaim berlebihan: "Lab Verified Parameters", "QC Pass Rate 100%", "Inspected farm facility", "Organic" (produk terkait), "Physical QC guarantee" (footer), "All phytosanitary certificates, certificate of origin… fully handled", "Live AWB updates" (tracking diupdate manual) → hapus/sesuaikan.
- Navbar: label "Verified Buyer (Almaty)" belum diputuskan (tidak ada verifikasi pembeli) → cukup nama.
- Langkah 6 "Seller is released funds" → "Seller gets paid".
- Tampilkan estimasi total dekat tombol Buy: "Subtotal $340 + QC fee $15 · shipping calculated later".
- State guest (belum login): Buy now / Ask → arahkan ke login/daftar dulu.
- Footer lagi-lagi beda (link karangan) → pakai footer standar.

Pertanyaan alur untuk owner (lihat BRAINSTORMING bagian 15): keranjang (cart) vs hanya "Buy now"; varian produk (ukuran/warna).

---

## 5. Profil penjual

Acuan: `design-ui/google-stitch/05.html`

Sudah diimplementasikan: `/sellers/[id]` (T12). Spesifikasi layar aslinya ada di riwayat git; yang berlaku sekarang adalah kode dan catatan di bawah.

Catatan implementasi:
- Tema Stitch lagi-lagi Material (bg `#f8f9ff`, primary `#003441`, radius 4px, Material Symbols) walau prompt melarang → tampaknya pengaturan tema project Stitch. Pakai token design system saat coding.
- Klaim: "Certified Export Clearing Agent" (footer), "inspection and payment clearance guarantees" (empty state penjual baru), "Denpasar QC team", "verified reviews", "BaliTrade cargo clearance" → hapus/netralkan.

---

## 6. Form Request (sourcing)

Acuan: `design-ui/google-stitch/06.html`

```
TASK: Design the REQUEST A PRODUCT page (desktop 1440px + mobile 390px), plus a success state and a "My requests" list frame.

1. NAVBAR. Breadcrumb: "Home / Request a Product".

2. PAGE HEADER: H1 "Request a product"; subtext "Tell us what you need. Our team searches across Bali and sends you a quotation you can accept, change or decline."

3. TWO-COLUMN LAYOUT:

   LEFT (65%) — FORM in a white card, grouped into 3 numbered sections:
   Section 1 "What do you need?"
   - "Product name" text input (required), placeholder "e.g. Arabica green coffee beans"
   - "Category" select (Coffee & Tea, Apparel & Accessories, Bags & Rattan, Handicrafts & Wood, Home Decor, Spices & Food, Other)
   - "Description & specifications" textarea (required), placeholder "Quality, size, color, material, packaging, logo, anything important…"
   - "Reference photos (optional)" upload dropzone "Drag photos here or browse — JPG, PNG, up to 5 photos", with 2 example uploaded thumbnails and remove "×".
   - Optional prefilled chip (show it filled): "Related product: Kintamani Arabica Green Beans — Grade 1 ×" with a small note "You came from this product page."
   Section 2 "Quantity & budget"
   - "Quantity" number input + "Unit" select (kg, pcs, pairs, sets, boxes) side by side (required)
   - "Target price per unit (USD, optional)" input with "$" prefix, helper "Helps us find the right seller. You can leave it empty."
   - "Needed by (optional)" date picker
   Section 3 "Where should it go?"
   - "Destination country" select (Russia, Kazakhstan, Uzbekistan, Kyrgyzstan, Armenia, Belarus, Other), helper "You'll add the full delivery address after you accept a quotation. Our team arranges the air cargo route."
   - "Anything else? (optional)" textarea
   - Checkbox: "I understand this is a request, not an order. I'll receive a quotation to accept or decline."
   - Primary button "Submit request", secondary ghost "Save as draft".

   RIGHT (35%) — sticky "How requests work" card:
   - 4 numbered steps with icons: "1 Submit your request", "2 We search across Bali", "3 Receive a quotation — price, quantity, lead time, QC fee and validity date", "4 Accept, ask for changes, or decline".
   - Light gold note box: "Questions? After you submit, a 3-party chat opens with our team. Please write in English."
   - Small muted line: "Payment is only needed after you accept a quotation and the seller confirms."

4. SUCCESS STATE (separate frame, centered card): green check icon, H2 "Request submitted", text "Request #RQ-1042 · Arabica green coffee beans · 200 kg", "Our team will review it and reply in your request chat.", buttons "Open request chat" (primary) and "View my requests" (secondary).

5. MY REQUESTS LIST (separate frame): table/list with columns Request, Quantity, Destination, Status, Updated, Action. 4 example rows with status pills: "Submitted" (gray), "Searching" (info blue), "Quotation ready" (gold, action button "Review quotation"), "Accepted" (green), plus one "Declined" (muted). Empty state text: "No requests yet. Can't find a product? Request it."

6. FOOTER.

Mobile version: single column; the "How requests work" card moves above the form as a collapsible panel; sticky bottom "Submit request" button.
```

Catatan implementasi:
- Tema Material (sama seperti halaman 3 & 5).
- Angka karangan "Bali Co-op Network · 140+ Verified Artisans" → hapus.
- State sukses menyebut "sourcing officer Dmitry I." padahal Dmitry I. adalah pembeli yang login → cukup "BaliTrade team".
- Footer: "backed by secure escrow and consolidated air & sea freight" → hapus escrow & sea freight (hanya air cargo).

---

## 7a. Keranjang & kirim order request

Acuan: `design-ui/google-stitch/07-a.html`

```
TASK: Design the CART & ORDER REQUEST page (desktop 1440px + mobile 390px), plus an "Order request sent — waiting for sellers" status frame.

1. NAVBAR. Breadcrumb: "Home / Cart". H1 "Your cart" + muted "3 items from 2 sellers".

2. INFO BANNER (info color, top of page): "How it works: send your order request → sellers confirm → you pay. You won't be charged until sellers confirm."

3. TWO-COLUMN LAYOUT:

   LEFT (65%) — SELLER GROUPS (one white card per seller):
   Group card 1 — header: seller avatar, "Kopi Bali Asli", "Verified seller" badge, "Bangli, Bali", right side "QC fee (Bangli area): $15", link "Ask Kopi Bali Asli & BaliTrade" (chat icon).
   - Item row: thumbnail, "Kintamani Arabica Green Beans — Grade 1", "Ready stock" badge, "$6.80 / kg", quantity stepper (value 50, unit kg) with helper "Min 20 kg · Available 100 kg", line total "$340.00", remove icon.
   - Under the item: "Note to seller (optional)" small textarea, filled: "Please pack in 20 kg jute sacks with GrainPro liner." helper "Size, color, packing or other details. The seller can accept, decline or suggest a change."
   - Group footer: "Group subtotal $340.00 · QC fee $15.00".
   Group card 2 — header: "Ubud Weavers", "Verified seller", "Gianyar, Bali", "QC fee (Gianyar area): $12", chat link.
   - Item row: "Cotton Batik Socks", "$1.90 / pair", stepper 200 pairs, helper "Min 100 pairs · Available 600 pairs", total "$380.00"; note filled: "Sizes: 100 pairs M, 100 pairs L. Navy and brown."
   - Item row: "Bucket Hat Batik Pattern", "$4.50 / piece", stepper 50 pcs, helper "Min 30 pcs · Available 150 pcs", total "$225.00"; note empty with placeholder.
   - Group footer: "Group subtotal $605.00 · QC fee $12.00".
   - Small muted note under all groups: "Made-to-order items are ordered through a quotation. Request a quote →"

   SHIPPING PREFERENCE card (below groups): radio cards
   - "Ship together (recommended)" — "One shipment when all sellers' goods pass QC. One shipping cost." (selected)
   - "Ship separately" — "Each seller's goods are shipped when ready. Shipping is charged per shipment."

   DELIVERY ADDRESS card: "Full name" (helper "As shown on your ID"), "Phone (WhatsApp/Telegram)", "Country" select (Russia selected), "City", "Postal code", "Street address". Helper: "Our team arranges the air cargo route to your address."

   RIGHT (35%) — sticky ORDER SUMMARY card:
   - Items subtotal $945.00
   - QC fees (2 sellers) $27.00
   - Shipping: "Calculated after packing & weighing" (muted, info icon tooltip "Billed before shipment")
   - Divider; "Estimated total (excl. shipping)" bold "$972.00"
   - Muted line: "Prices in USD. You pay after sellers confirm."
   - Checkbox: "I agree to the Terms of Service, including that BaliTrade Admin takes part in all chats."
   - Primary full-width button "Send order request"
   - Trust lines with icons: "Payment held by BaliTrade until delivery", "QC report for each seller before shipping — you approve", "If QC fails, we help find a replacement or give a full refund".

4. SEPARATE FRAME — "ORDER REQUEST SENT" status (same page layout):
   - Header: "Order request #OR-2051 sent" with status pill "Waiting for sellers".
   - Group card Kopi Bali Asli: status pill "Accepted" (green), text "Seller confirmed your items and note."
   - Group card Ubud Weavers: status pill "Change proposed" (gold). Inside: seller message box "Bucket Hat: only 40 pcs available now. Proposed: 40 pcs ($180.00)." with buttons "Accept change" (primary), "Remove item" (secondary), "Ask BaliTrade to find a replacement" (ghost). Under it the socks item shows "Accepted".
   - Also show a small example row of a "Declined" item with text "Seller can't provide this item" and buttons "Remove item" / "Ask BaliTrade to find a replacement".
   - Summary card updated: "Waiting for 1 response" and a disabled primary button "Continue to payment" with helper "Available when all sellers have responded."

5. FOOTER.

Mobile version: groups stacked full width; summary collapses into a sticky bottom bar showing "Estimated total $972.00 (excl. shipping)" and the "Send order request" button.
```

Catatan implementasi: lihat ringkasan di atas (bagian halaman 7a–7b).

---

## 7b. Pembayaran & upload bukti

Acuan: `design-ui/google-stitch/07-b.html`

> **Pembaruan 2026-10-30:** halaman ini memakai **3 metode bayar**, bukan 2: transfer bank IDR (BCA), USDT (wallet Binance), dan **Exchange** (pembeli yang hanya punya rubel membayar ke exchange mitra di Indonesia). Desain Stitch hanya menggambar dua kartu; tambahkan kartu ketiga dengan gaya yang sama. Teks petunjuk untuk Exchange menunggu keputusan owner; jangan menampilkan nama jaringan USDT sebelum diputuskan.

```
TASK: Design the PAYMENT page (desktop 1440px + mobile 390px), plus a "Payment submitted — waiting for verification" frame.

1. NAVBAR. Breadcrumb: "Home / Orders / #OR-2051 / Payment". H1 "Pay for order #OR-2051". Status pill "All sellers confirmed".

2. TWO-COLUMN LAYOUT:

   LEFT (60%):
   STEP 1 — "Choose payment method" (two large radio cards):
   - "Bank transfer (IDR)" — "Transfer from an Indonesian bank account and upload the receipt."
   - "USDT" — "Send USDT to our wallet and submit the transaction hash and a screenshot." (show bank transfer selected in the main frame)

   STEP 2 — "Transfer details" (for bank transfer, white card):
   - Big amount: "Amount to transfer: Rp 14,832,000" with copy button; muted line "= $927.00 at today's rate 1 USD = Rp 16,000 (rate locked for this payment)".
   - Rows with copy buttons: "Bank: [Bank name]", "Account number: [Account number]", "Account holder: [Account holder]", "Payment reference: OR-2051" (helper "Write this in the transfer note").
   - Warning box (warning color): "Transfer the exact amount in one transaction. Do not split the payment."

   STEP 3 — "Upload proof" :
   - "Sender name (account holder)" input, helper "If someone else pays for you, enter their name here."
   - Upload dropzone "Upload payment receipt — JPG, PNG, PDF", with one example uploaded file "receipt_OR-2051.jpg ×".
   - Checkbox "I confirm this payment is for order #OR-2051."
   - Primary button "Submit payment proof".

   ALTERNATIVE FRAME for USDT selected (separate small frame of steps 2–3):
   - "Amount to send: 927.00 USDT" with copy; "Wallet address: [USDT wallet address]" with copy button and a QR code placeholder box; warning "Send only USDT to this address. Sending other coins may result in loss of funds."
   - Inputs: "Transaction hash" (monospace placeholder "0x… or transaction ID"), "Sender wallet address", upload "Screenshot of the transfer".
   - Primary button "Submit payment proof".

   RIGHT (40%) — sticky ORDER SUMMARY:
   - Group "Kopi Bali Asli · Bangli": Kintamani Arabica 50 kg $340.00, QC fee $15.00.
   - Group "Ubud Weavers · Gianyar": Cotton Batik Socks 200 pairs $380.00, Bucket Hat 40 pcs $180.00, QC fee $12.00.
   - Divider; "Due now" bold "$927.00"; "Shipping (Ship together): billed after packing & weighing".
   - Delivery: "Anna K. · Moscow, Russia" with "Edit" link.
   - Trust box (light gold): "Payment held by BaliTrade until delivery", "QC report for each seller before shipping", "If QC fails, we help find a replacement or give a full refund".
   - Link "Questions about payment? Open order chat".

   Keep all numbers consistent: hat changed to 40 pcs ($180.00), due now = $340 + $15 + $380 + $180 + $12 = $927.00 = Rp 14,832,000 at Rp 16,000 per USD.

3. SEPARATE FRAME — "PAYMENT SUBMITTED": centered card with clock icon, H2 "Payment proof submitted", text "Our team will verify your payment and notify you here. Then quality control starts for each seller.", status pill "Waiting for verification", order timeline preview: Order request ✓ → Sellers confirmed ✓ → Payment submitted (current) → Payment verified → QC → Your approval → Shipped → Delivered. Buttons "View order" (primary), "Open order chat" (secondary).

4. FOOTER.

Mobile version: steps stacked; order summary collapsible at top ("Due now $927.00 ▾"); sticky bottom "Submit payment proof".
```

Catatan implementasi: lihat ringkasan di atas (bagian halaman 7a–7b).

---

## 8. Detail order (approval QC, tagihan ongkir, tracking, terima barang)

Acuan: `design-ui/google-stitch/08.html`

```
TASK: Design the ORDER DETAIL page for the buyer (desktop 1440px + mobile 390px). Main frame = "QC report ready — awaiting your approval". Then 4 smaller state frames.

Order: #OR-2051, buyer Anna K., delivery Moscow, Russia. Groups: (A) Kopi Bali Asli · Bangli — Kintamani Arabica Green Beans 50 kg $340.00 + QC $15.00; (B) Ubud Weavers · Gianyar — Cotton Batik Socks 200 pairs $380.00, Bucket Hat Batik Pattern 40 pcs $180.00 + QC $12.00. Paid: $927.00.

1. NAVBAR. Breadcrumb "Home / My orders / #OR-2051".

2. ORDER HEADER (white card): H1 "Order #OR-2051", status pill "Awaiting your approval" (gold), meta "Placed Oct 21, 2026 · 2 sellers · Ship together · Delivery: Moscow, Russia". Right: buttons "Download invoice" (ghost) and "Help" (ghost).

3. PROGRESS STEPPER (horizontal, 9 steps, with check marks for done steps): Order request ✓ → Sellers confirmed ✓ → Payment verified ✓ → Quality control (current, partially done) → Your approval → Shipping invoice → Shipped → Arrived → Received. Under the stepper, small muted text: "Shipping starts when all sellers' goods are approved."

4. TWO-COLUMN LAYOUT:

   LEFT (65%) — SELLER GROUP CARDS:

   Group A card "Kopi Bali Asli · Bangli, Bali" — status pill "QC report ready" (gold) and the line "Please review and approve".
   - Item row: thumbnail, "Kintamani Arabica Green Beans — Grade 1 · 50 kg", note shown in muted box "Your note: Please pack in 20 kg jute sacks with GrainPro liner."
   - QC REPORT panel (light gold border):
     • Header: "QC report · inspected by BaliTrade · Oct 24, 2026".
     • Media grid: 4 photo thumbnails + 1 video thumbnail with play icon "0:58", "View all".
     • Checklist with green check icons and values: "Quantity: 50 kg (3 sacks: 20 + 20 + 10 kg) ✓", "Packaging as requested: jute sack + GrainPro liner ✓", "Matches product description ✓", "Your note followed ✓".
     • Admin comment bubble (BaliTrade Admin, light gold): "Beans look clean and consistent. Sacks are sealed and labelled with your order number."
     • Buttons: primary "Approve this group", secondary "Ask a question" (opens this group's chat), ghost text button in error color "Report a problem".
     • Muted helper: "Approving confirms the goods can be packed for shipping."

   Group B card "Ubud Weavers · Gianyar, Bali" — status pill "In QC" (info blue), text "Our team is inspecting your items. You'll be notified when the report is ready." Items: Cotton Batik Socks 200 pairs (note: "Sizes: 100 pairs M, 100 pairs L. Navy and brown."), Bucket Hat Batik Pattern 40 pcs. Link "Open chat with Ubud Weavers & BaliTrade".

   RIGHT (35%) — sticky SIDEBAR cards:
   - PAYMENT: "Items + QC fees: $927.00 · Paid ✓ (Bank transfer IDR, verified)"; "Shipping: invoice after packing & weighing"; "Payment held by BaliTrade until delivery".
   - DELIVERY: "Anna K. · [Street address], Moscow, [Postal code], Russia · Phone [+7 …]"; muted "Our team arranges the air cargo route."
   - CHATS (3-party, one per seller): rows "Kopi Bali Asli & BaliTrade" (unread badge 2), "Ubud Weavers & BaliTrade"; each opens the chat drawer.
   - DOCUMENTS: "Order summary (PDF)", "Payment receipt", "QC report — Kopi Bali Asli".

5. STATE FRAME 1 — "QC FAILED" (group card only): Group B status pill "QC issue" (error). Report shows: "Bucket Hat: 6 of 40 pcs have uneven stitching" with 2 photos. Info box: "We can find a replacement for the 6 hats, or you can get a refund for them." Two option cards: "Find a replacement (recommended)" — "Our team sources matching hats; shipping waits for the replacement." and "Refund for these items" — "$27.00 refunded to you after confirmation." Primary button "Confirm choice", ghost "Discuss in chat".

6. STATE FRAME 2 — "SHIPPING INVOICE" (all groups approved): card "Shipping invoice" with status pill "Awaiting shipping payment"; rows "Packed: 4 cartons · 61 kg", "Air cargo to Moscow, Russia: $244.00", "Due now: $244.00"; photo of the packed cartons; button "Pay shipping" (opens the same payment page: IDR or USDT + upload proof). Muted helper: "Your goods ship after this payment is verified."

7. STATE FRAME 3 — "TRACKING" (shipped): vertical timeline, each step with date, short note and optional photo, label "Updated by BaliTrade team": "Handed to air cargo — AWB [AWB number]" (with "Track on airline site" link), "Departed Bali", "Arrived at destination airport", "Customs processing", "With local partner", "Delivered" (future steps gray). Note at top: "Tracking is updated manually by our team at each milestone."

8. STATE FRAME 4 — "ARRIVED — CONFIRM RECEIPT": success-styled card "Your goods have arrived", text "Please check your goods and confirm. After you confirm, each seller gets paid.", buttons "Confirm I received my goods" (primary) and "Report a problem" (error ghost). Below, after confirmation: two small review cards, one per seller ("Rate Kopi Bali Asli", "Rate Ubud Weavers"), 5 stars + short text field + "Add photos" + "Submit review".

9. FOOTER.

Mobile version: header and stepper stack (stepper becomes a vertical compact list with the current step highlighted); group cards full width; sidebar cards move below the groups; sticky bottom bar with the main action of the current state ("Approve this group").
```

Catatan implementasi:
- Tema Material (sama seperti halaman 3, 5–7b).
- Opsi USDT ditulis "USDT TRC20" → hapus nama jaringan (TBA); ikon "credit_card" → bukan metode kartu.
- Tagihan ongkir memecah "Air cargo freight $210 + Export documentation & phytosanitary $34" → komponen biaya dokumen ekspor **belum diputuskan** (lihat BRAINSTORMING bagian 15).
- Hapus: "Estimated report: Today, 18:00" (SLA), fasilitas karangan "Gianyar Consolidated Inspection Facility / hub / depot", "Depot Lead", "direct air cargo route", "dispute protection", "paid from BaliTrade accounts".
- Footer: "Certified Origin & Quality Escrow", link tambahan (Company Profile, Newsroom, Cooperative Portal, dll.), dan **pelabuhan laut** (Tanjung Benoa, Vladivostok, Novorossiysk) → pakai footer standar; kita hanya air cargo.
