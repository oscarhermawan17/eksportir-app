# UI_PROMPT — BaliTrade (Google Stitch)

Kumpulan prompt untuk Google Stitch. Konteks bisnis lengkap ada di `BRAINSTORMING.md`.

**Alat utama: Google Stitch** (diputuskan 2026-10-17). Hasil AI Studio (pembanding) sudah dihapus dari repo.

## Cara pakai

1. Kerjakan **satu halaman per prompt** (hasil Stitch lebih bagus).
2. Setiap prompt halaman **sudah menyertakan blok DESIGN SYSTEM** di awal — copy seluruh isi blok kode prompt apa adanya.
3. Prompt ditulis dalam **bahasa Inggris** (Stitch lebih akurat), desain menampilkan teks **English** (bahasa default app).
4. Setelah generate, review bersama → catat revisi di bagian "Catatan revisi" halaman tersebut → update status di tabel progress.
5. Simpan hasil generate di `design-ui/google-stitch/` (mis. `01.html`, `02.html`) dan hasil AI Studio di `design-ui/google-studios/`.
6. **Aturan kerja (keputusan 2026-10-21):** desain Stitch = acuan alur & struktur, bukan hasil akhir. Per halaman: 1× generate + maksimal 1× revisi, dan revisi hanya jika **alur/struktur** salah. Kesalahan teks/copy kecil tidak direvisi di Stitch — dicatat di "Catatan implementasi" dan diperbaiki saat coding.

## Progress

Status: `Belum` · `Prompt siap` · `Sudah di-generate` · `Direvisi` · `Final`

| # | Halaman | Status | Catatan |
|---|---|---|---|
| 1 | Design system | Final | Stitch: `design-ui/google-stitch/01-v4.html` (acuan); versi lama 01, 01-v2, 01-v3; AI Studio: `design-ui/google-studios/` (pembanding) |
| 2 | Landing page | Final (versi lengkap) | Stitch: `design-ui/google-stitch/02-lengkap.html` (acuan); versi ringkas (Prompt B) dilewati |
| 3 | Katalog / pencarian produk | Final | Stitch: `design-ui/google-stitch/03.html` (acuan alur); ada pergeseran tema visual, lihat catatan bagian 3 |
| 4 | Detail produk (+ chat bertiga) | Final | Stitch: `design-ui/google-stitch/04.html`; lihat catatan bagian 4. Keputusan cart & varian sudah diambil (BRAINSTORMING 5a) |
| 5 | Profil penjual | Final | Stitch: `design-ui/google-stitch/05.html` (acuan alur); lihat catatan bagian 5 |
| 6 | Form Request (sourcing) | Final | Stitch: `design-ui/google-stitch/06.html` (acuan alur); lihat catatan bagian 6 |
| 7a | Keranjang & kirim order request (+ status konfirmasi penjual) | Final | Stitch: `design-ui/google-stitch/07-a.html`; lihat catatan bagian 7a |
| 7b | Pembayaran & upload bukti | Final | Stitch: `design-ui/google-stitch/07-b.html`; lihat catatan bagian 7b |
| 8 | Detail order (approval QC, tagihan ongkir, tracking, terima barang) | Final | Stitch: `design-ui/google-stitch/08.html`; lihat catatan bagian 8. **Tahap desain Stitch selesai.** |
| 9 | Ruang chat | Dilewati (dibuat saat implementasi) | Komponen sudah ada di chat drawer halaman 4 |
| 10 | Dashboard penjual | Dilewati (dibuat saat implementasi) | Pola standar: listing, status approval, respons order request (accept/decline/propose change), QC |
| 11 | Dashboard admin | Dilewati (dibuat saat implementasi) | Pola standar: approve listing/penjual, verifikasi pembayaran, upload laporan QC, tagihan ongkir, update tracking, kurs harian |
| 12 | How It Works (halaman penjelasan lengkap: alur, QC, pembayaran, FAQ lengkap) | Dilewati (dibuat saat implementasi) | Isi diambil dari landing versi lengkap |

---

## Catatan implementasi (ringkasan — WAJIB dibaca sebelum coding UI)

Hal yang sengaja tidak direvisi di Stitch dan harus dibereskan saat implementasi. Detail per halaman ada di bagian "Catatan implementasi" masing-masing.

- **Sumber kebenaran visual = design system `01-v4.html`** (token warna, font, radius 12px, ikon Lucide, badge, kartu, chat bubble). Halaman lain hanya acuan alur/struktur.
- **Navbar & footer = 1 komponen standar** untuk semua halaman (sesuai design system): navbar Products / Request a Product / How It Works / Sell on BaliTrade / Log in / Sign up; footer About, For Buyers, For Sellers, Support (FAQ, Contact, Terms of Service, Privacy Policy). Abaikan variasi link karangan di tiap halaman Stitch.
- **Jangan pakai kata "escrow"** di UI → "Payment protection" / "Payment held by BaliTrade until delivery".
- **Tanpa janji yang belum diputuskan**: SLA respons/verifikasi, waktu kirim, jadwal mingguan/Jumat, rute langsung, dokumen bea cukai negara tujuan, sertifikasi.
- Halaman 2 (landing): hapus "weekly"/"customs documents" di For Sellers; sesuaikan teks "custom sourcing"; pertimbangkan meringkas (trust strip duplikat). Teks FAQ QC gagal ganti jadi: "We'll first help you find a replacement. If you prefer, you can get a full refund."
- Halaman 3 (katalog): tema Stitch bergeser ke Material (bg `#f8f9ff`, primary `#003441`, radius 4px, Material Symbols) → pakai token design system; filter kabupaten lengkap 9 (tambah Klungkung, Jembrana). **Pergeseran tema Material yang sama terjadi juga di halaman 5 & 6** (tampaknya pengaturan tema project Stitch, tidak hilang walau dilarang di prompt).
- Halaman 5–6: hapus klaim/angka karangan ("Certified Export Clearing Agent", "guarantees", "140+ Verified Artisans", "sea freight", "escrow" di footer); state sukses request jangan menyebut nama pembeli sebagai "sourcing officer".
- Halaman 7a–7b (keranjang & pembayaran): tema Material juga. Hapus SLA "Sellers usually confirm within 2 to 6 business hours", "Quality Guarantee / 100% refund / immediate replacements" (pakai: "we help find a replacement or give a full refund"), jendela penerbangan "Nov 14–16", "Departing Friday", rute "direct lanes to SVO, ALA, TAS", "Denpasar Hub / laser sizing", "Three-Party Custody", "Direct Cooperative Mill #042", label "Global Escrow" di opsi USDT, "escrow" di top bar & footer, "English / USD" di footer. Helper nama: hanya "As shown on your ID" (tanpa "business registration"). "Stock reserved during active request session" & "door/courier delivery" → belum diputuskan, jangan ditampilkan dulu.
- Halaman 8 (detail order): tema Material; hapus "TRC20", SLA "Estimated report", fasilitas/depot karangan, pelabuhan laut di footer; baris "Export documentation & phytosanitary" di tagihan ongkir menunggu keputusan.
- Halaman 4 (detail produk): hapus klaim berlebihan (Lab Verified, QC Pass Rate 100%, Organic, "fully handled" dokumen, "Live AWB"), hapus label "Verified Buyer", tampilkan estimasi total (subtotal + QC fee, ongkir menyusul), state guest → login dulu sebelum Buy/Ask.

---

## Blok DESIGN SYSTEM (referensi — sudah tertanam di setiap prompt di bawah)

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

## 1. Design system (style guide screen)

Tujuan: memastikan Stitch "mengunci" gaya visual sebelum membuat halaman.

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. H1 40–48px bold, H2 28–32px semibold, H3 20px semibold, body 16px, small 14px, caption 12px.

Balinese touch: very subtle low-opacity ornament line pattern or thin gold divider, only in hero and footer.

TASK: Create a single "Design System / Style Guide" screen for BaliTrade showing:
1. Logo area: text logo "BaliTrade" with a small gold frangipani/leaf mark, on light and on dark teal background.
2. Color palette swatches with names and hex codes (primary, accent, secondary, background, text, status colors).
3. Typography scale (H1, H2, H3, body, small, caption) with sample text.
4. Buttons: primary, secondary, ghost, disabled, with loading state; small and large sizes.
5. Badges/pills: "Ready stock", "Made to order", "Verified seller", "QC included", "Auto-translated", "New seller", and order status pills: "Awaiting payment", "Payment verified", "In QC", "Awaiting your approval", "Shipped", "Delivered".
6. Form elements: text input, textarea, select dropdown, quantity stepper, file upload dropzone ("Upload payment proof — JPG, PNG, PDF"), checkbox, radio, with default, focus, error and helper text states.
7. Product card example (coffee: "Kintamani Arabica Green Beans", seller "Kopi Bali Asli · Bangli, Bali", "$6.80 / kg", "MOQ 20 kg", badge "Ready stock").
8. Seller mini-card (avatar, name, location, Verified badge, rating, "No reviews yet" empty-state variant).
9. Chat message bubbles for 3 participants: Buyer (right, teal), Seller (left, white), BaliTrade Admin (left, light gold background with "Admin" label), plus a message with photo attachment. All chat messages are in English (no translate link); the composer shows the hint "Please write in English so everyone can understand."
10. Alert/banner styles: info, success, warning, error. Example info banner: "BaliTrade Admin is part of this conversation to keep your transaction safe."
11. Language switcher component (EN / ID / RU dropdown with globe icon).
12. Navbar and footer samples as described.
Arrange it as a clean, well-labeled documentation page on the off-white background.
```

Hasil: Stitch → `design-ui/google-stitch/01.html`; AI Studio (prompt sama) → `design-ui/google-studios/` (React + Vite, jalankan `bun run dev`). Generate pertama 2026-10-17.

Perbandingan AI Studio vs Stitch (halaman 1):
- Sama-sama mengarang fakta (Inc., alamat Kuta & kantor Sheremetyevo, nomor telepon, "100% Escrow", SWIFT, NIB/NPWP verified, klaim kontras WCAG yang salah) → masalah di prompt, sudah ditambah CONTENT RULES untuk halaman 2+.
- AI Studio lebih sesuai: tombol Translate per pesan di chat, tombol "Post RFQ" di navbar (= Request a Product), foto produk asli, interaktif (modal, upload, toast).
- AI Studio kurang: navbar tanpa Log in/Sign up, footer tanpa FAQ/Contact; ada fitur yang belum diputuskan ("Request Sample", "Lab Cert", field nama perusahaan OOO); butuh Node/bun untuk dibuka; framework sudah dipilihkan (React 19, Vite 8, Tailwind 4) padahal belum tahap teknis; gambar memakai path `/src/assets/...` (hanya jalan di mode dev).
- Build & typecheck AI Studio lulus (`bun run build`, `tsc --noEmit`).

Catatan revisi (review generate pertama):
- OK: warna & font sesuai, semua 12 komponen ada, chat 3 pihak + label Admin, empty state penjual baru, banner admin.
- Konten karangan Stitch (harus dihapus): "Citibank Jakarta escrow", "PT BaliTrade Global Ekspor", "BaliTrade Inc.", SIUP #8120, alamat Kuta & kantor Moskow, "Denpasar HQ/Inspection Lab", "Escrow Guarantee", "Encrypted 256-bit", "© 2025".
- Tidak sesuai keputusan: input SWIFT reference & dropzone "bank swift document" (seharusnya bukti transfer IDR / USDT hash), radio "RUB Local Invoice" & "Language & Currency Switcher" (hanya USD), chat "AI Translate Active"/auto-translate (keputusan terbaru: chat wajib bahasa Inggris, tanpa fitur terjemahan), product card ready stock pakai tombol "Request Quote" & "Direct Chat with Seller".
- Navbar sampel tidak ada "Request a Product" & "Sell on BaliTrade" (fitur inti); footer tidak ada FAQ, Contact, Terms of Service, kolom For Sellers.
- Badge: "Made to order" jadi gold (seharusnya terracotta, agar beda dari status "Awaiting approval").
- Aksesibilitas: teks gold #C9A24A & warning #D99A2B di atas latar terang kontras ±2,4:1 (gagal WCAG AA 4,5:1). Klaim "contrast ratios verified" di halaman tidak benar.
- Teknis kecil (hanya mockup): CSS `background-opacity` tidak valid, emoji bendera tampil sebagai huruf di Windows, top bar navbar tidak responsif di mobile.

Prompt revisi (paste sebagai chat lanjutan di Stitch, di project yang sama):

```
Revise this design system page with these corrections:
1. Remove all invented facts: "Citibank" and any bank names, "PT BaliTrade Global Ekspor", "BaliTrade Inc.", SIUP/license numbers, the Kuta and Moscow addresses, "Denpasar HQ", "Inspection Lab", "Escrow Guarantee", "Encrypted 256-bit". Footer copyright: "© 2026 BaliTrade".
2. Replace the word "escrow" everywhere with "payment held by BaliTrade" (e.g. badge "Payment protected", button "Confirm & pay").
3. Payments: remove the SWIFT reference input and the RUB radio. Show two payment options as radio cards: "Bank transfer (IDR) — upload receipt photo" and "USDT — upload screenshot + transaction hash". Dropzone text: "Upload payment proof — JPG, PNG, PDF". Error example: "Transaction hash looks invalid. Please check and paste it again."
4. Language switcher: language only (English, Bahasa Indonesia, Русский), no currency. Use text codes EN / ID / RU instead of flag emojis.
5. Chat: remove "AI Translate Active", "Auto-translated to Indonesian for seller" and any "Translate" buttons. All three participants write in English — rewrite the seller and buyer messages in English. Add a small hint under the chat input: "Please write in English so everyone can understand." Seller label "Seller", admin label "BaliTrade Admin".
6. Product card (ready stock): primary button "View product", icon button tooltip "Ask seller & BaliTrade" (3-party chat). Rating on card must match seller card.
7. "Made to order" badge must use terracotta (#B5563A on #F9ECE8), not gold.
8. Navbar sample menu: Products, Request a Product, How It Works, Sell on BaliTrade; right side: search, language switcher (EN), Log in, Sign up. Remove "Air Cargo Rates & Calculator". Keep the top info bar but text: "Next consolidated shipment: Friday" and make it collapse on mobile.
9. Footer columns: About BaliTrade; For Buyers (How it works, Request a product, Payment methods, Shipping & tracking); For Sellers (Sell on BaliTrade, Seller guidelines); Support (FAQ, Contact, Terms of Service, Privacy Policy).
10. Accessibility: gold text on light backgrounds must use dark gold #9A7426; warning text use #9A6A12. Remove the "contrast ratios verified" claim.
Keep everything else (colors, typography, layout, components) as is.
```

### Review revisi 1 → `design-ui/google-stitch/01-v2.html` (2026-10-17)

Catatan: Stitch membuat layar baru (bukan menimpa) — itu normal; simpan sebagai `01-v2.html`, `01-v3.html`, dst.

Sudah beres: semua fakta karangan utama hilang (Citibank, PT/Inc., SIUP, alamat, Inspection Lab, 256-bit), kata escrow → "payment protected/held by BaliTrade", SWIFT & RUB hilang, opsi IDR + USDT (screenshot + hash) ada, bendera emoji hilang, chat English + hint, product card "View product" + "Ask seller", Made to order terracotta, navbar & footer sesuai, © 2026, teks gold pakai #9A7426.

Masih perlu diperbaiki:
- Badge "Auto-translated" ikut terhapus (kesalahan dari prompt revisi kita yang menyuruh hapus semua "Translate"). Badge ini tetap dibutuhkan untuk deskripsi produk.
- Masih ada janji yang belum diputuskan: "First order covered by BaliTrade Payment Protection", "Sanitary certificate included".
- Klaim penerbangan langsung: "Direct Air Cargo from Bali to CIS", "SVO … (Direct)", "Direct air cargo departures".
- Teks samar "Air cargo logistics hub open" di top bar.
- Badge "New seller" warnanya sama dengan "Made to order" (terracotta) → bisa membingungkan.
- Perlu keputusan owner: jaringan USDT (tertulis "TRC-20 / ERC-20"), field "Company Tax ID / Registration", dan dropdown bandara tujuan.

Prompt revisi 2 (paste sebagai chat lanjutan di Stitch):

```
Revise the latest design system screen with these small corrections, keep everything else exactly as is:
1. Restore the "Auto-translated · View original" badge (gray pill with a languages icon) in the badges section. It is used only for product descriptions written by sellers — chat stays English-only with no translation.
2. Remove promises that are not part of our policy: "First order covered by BaliTrade Payment Protection" (replace with "No reviews yet" only) and "Sanitary certificate included" (replace with "Packed in 20 kg jute sacks").
3. Remove the word "Direct" from flight/cargo texts: "Air Cargo from Bali to Russia & CIS", destination option "SVO — Moscow Sheremetyevo", helper text "Air cargo from Bali (DPS)".
4. In the top info bar remove "Air cargo logistics hub open"; keep only "Next consolidated shipment: Friday" and "Payment protected".
5. Give the "New seller" badge a neutral info style (#2F6F8F text on #EBF3F7 with a sparkles icon) so it is different from the terracotta "Made to order" badge.
```

### Review revisi 2 → `design-ui/google-stitch/01-v3.html` (2026-10-17)

Kelima poin revisi 2 beres: badge "Auto-translated · View original" kembali (abu-abu), janji "First order covered…" & "Sanitary certificate included" hilang, klaim "Direct" flight hilang, badge "New seller" warna info (beda dari Made to order). Sisa kata "Direct communication"/"airport logistics hub" di teks contoh tidak masalah. Tinggal revisi 3 (USDT network, Tax ID, bandara).

Prompt revisi 3 (jalankan SETELAH revisi 2 selesai, berdasarkan keputusan owner 2026-10-17):

```
Revise the latest design system screen with these corrections, keep everything else exactly as is:
1. USDT payment option: remove "TRC-20 / ERC-20" and any blockchain network name. Text: "USDT — upload screenshot + transaction hash. Payment is held by BaliTrade until goods arrive."
2. Remove the "Company Tax ID / Registration" input. Replace it with a "Full name" text input (label above, helper text "As shown on your ID").
3. Remove the "Destination Airport" dropdown — buyers do not choose airports. Replace it with a "Delivery address" textarea (helper text "Street, city, postal code, country. Our team arranges the air cargo route."), and a "Country" select with options Russia, Kazakhstan, Uzbekistan, Kyrgyzstan, Armenia, Belarus, Other.
```

### Review revisi 3 → `design-ui/google-stitch/01-v4.html` (2026-10-17) — FINAL

Stitch kali ini meng-update layar yang sama (tidak membuat layar baru); file tetap di-export sebagai `01-v4.html`. Ketiga poin beres: "TRC-20 / ERC-20" hilang, Tax ID diganti "Full name" (helper "As shown on your ID"), dropdown bandara diganti "Delivery address" + "Country". Struktur 12 bagian tidak berubah, perbaikan revisi 1–2 tetap ada, tidak ada fakta karangan baru. File lebih besar karena format ulang (whitespace), bukan konten baru.
Catatan kecil (tidak perlu revisi, cukup jaga di halaman berikutnya): teks contoh "Minimum order: 20 kg (6 sacks)" tidak konsisten (1 karung = 20 kg).

---

## 2. Landing page

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B.

Typography: Plus Jakarta Sans. Prices bold.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges (Ready stock teal/green, Made to order terracotta, New seller info blue, Auto-translated gray, Verified seller), product card, seller mini-card, chat bubbles, alerts, language switcher, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Balinese touch: very subtle low-opacity ornament line pattern or thin gold divider, only in hero and footer.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product, How It Works, Sell on BaliTrade; right: search icon, language switcher (globe + "EN", options EN/ID/RU), "Log in" ghost button, "Sign up" primary button. Mobile: hamburger.

Footer: dark teal #0B3A46, white text, subtle Balinese pattern; columns About, For Buyers, For Sellers, Support (FAQ, Contact, Terms of Service, Privacy Policy); bottom row language switcher (English / Bahasa Indonesia / Русский), "© BaliTrade", "Bali, Indonesia → Russia & CIS".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company legal names, license/registration numbers, street addresses, offices, bank names, partner logos, flight schedules, certifications or guarantees — omit them or use neutral placeholders like "[Bank name]". Say "Payment held by BaliTrade" instead of "escrow account". Payment methods are ONLY: bank transfer in IDR (upload receipt photo) and USDT (upload screenshot + transaction hash; do not mention any blockchain network such as TRC-20/ERC-20) — no SWIFT, no cards, no RUB, no currency switcher. Buyers are mostly individuals: never ask for company tax ID or business registration. Buyers do not choose airports or shipping routes — BaliTrade decides; buyers only enter a delivery address. Every chat always has 3 participants (buyer, seller, BaliTrade Admin) — never "direct chat with seller". Chat language is English for everyone (buyer, seller, admin) — there is no translation feature in chat; the chat composer shows a small hint "Please write in English so everyone can understand." Product descriptions are auto-translated and show "Auto-translated · View original". For gold text on light backgrounds use dark gold #9A7426 (accessible contrast); keep #C9A24A for icons, borders, fills and text on dark teal.

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
Hasil: `design-ui/google-stitch/02.html` (2026-10-17). Gaya visual konsisten dengan design system (navbar, badge, kartu produk, footer sesuai).

Review generate pertama:
- Panjang: 12 bagian (top bar, navbar, hero, trust strip, how it works, kategori, produk, request banner, QC preview, payment, for sellers, FAQ, footer). Trust strip mengulang 3 checkmark di hero.
- Kata "escrow" muncul lagi ("Escrow Protection", "🛡️ Escrow Guarantee", link "…escrow", footer).
- Janji/SLA yang belum diputuskan: "Response within 24 business hours", "Instant administrative verification within 2 hours", "Guaranteed Payouts in IDR", transit "5 to 9 business days", "complete customs documentation", "private labeling, custom embroidery".
- Klaim rute: "Direct to CIS logistics", "Friday Cargo DPS-SVO". Jadwal Jumat & konsolidasi masih ide, belum keputusan.
- Bertentangan: "3-way translated negotiation" (chat wajib English, tanpa terjemahan).
- QC gagal: FAQ menyebut "replace or rectify, or fully returned" → sesuai keputusan (refund penuh atau ganti barang), tapi teks final FAQ tetap ditulis owner.
- Pertanyaan UX owner: perlukah FAQ/cara transaksi di landing? (lihat diskusi; menunggu keputusan versi ringkas vs lengkap).

Keputusan (2026-10-21): buat **2 versi untuk dibandingkan** → `02-lengkap.html` dan `02-ringkas.html`. Setelah dibandingkan, pilih satu untuk app; isi yang tidak dipakai di landing dipindah ke halaman "How It Works" (halaman baru di daftar).

Langkah: jalankan **Prompt A dulu** (memperbaiki layar yang ada → simpan `02-lengkap.html`), lalu **Prompt B** (membuat layar baru → simpan `02-ringkas.html`).

Prompt A — versi lengkap (perbaikan isi saja, paste sebagai chat lanjutan pada layar landing page):

```
Revise this landing page. Keep the layout, sections and visual style exactly as they are — only fix the content:
1. Never use the word "escrow". Replace "Escrow Protection", "Escrow Guarantee" and any "escrow" link or footer text with "Payment protection" / "Payment held by BaliTrade until delivery". Remove the shield emoji.
2. Remove promises we have not decided: "Response within 24 business hours", "Instant administrative verification within 2 hours", "Guaranteed Payouts in IDR" (use "Get paid in IDR after delivery"), "5 to 9 business days" (use "Shipping time depends on destination — our team confirms it before you pay"), "complete customs documentation" (use "export documents from Bali"), "private labeling, custom embroidery".
3. Remove route and schedule claims: "Direct to CIS logistics", "Friday Cargo DPS-SVO", "depart weekly on Fridays". Use neutral text: "Air cargo from Bali to Russia & CIS".
4. Remove "3-way translated negotiation". Chat is in English for everyone: use "3-way chat in English: you, the seller and BaliTrade".
5. FAQ answer for failed QC: "If goods fail quality control, you choose: a full refund or a replacement."
```

Prompt B — versi ringkas (DILEWATI 2026-10-21 — owner memilih versi lengkap sebagai acuan; disimpan sebagai referensi bila nanti ingin versi ringkas):

```
Create a NEW screen (do not modify the existing landing page): a shorter version of the BaliTrade landing page, desktop 1440px plus mobile 390px. Use exactly the same visual style, navbar, footer, product cards and components as the existing landing page and the BaliTrade Design System screen. Apply the same content rules: never use the word "escrow" (say "Payment held by BaliTrade until delivery"), no delivery-time or response-time promises, no route/flight claims, chat is English-only with 3 participants (buyer, seller, BaliTrade Admin), payments only bank transfer in IDR and USDT, prices in USD.

Sections, in this order only:
1. NAVBAR (same as existing).
2. HERO: same headline, subtext, "Browse products" and "Request a product" buttons, search bar, and the 3 trust checkmarks ("Quality control on every order", "Payment held until delivery", "Air cargo to Russia & CIS"). No separate trust strip below.
3. FEATURED PRODUCTS: title "Ready to ship from Bali", a row of category chips above the grid (All, Coffee & Tea, Apparel & Accessories, Bags & Rattan, Handicrafts & Wood, Home Decor, Spices & Food), then 8 product cards (same cards as existing), and a "View all products" button.
4. HOW IT WORKS (compact): one row of 6 small steps with icons — Find or request, Discuss, Pay securely, Quality check, Ship, Receive — each with one short line, plus link "See how it works in detail →".
5. REQUEST A PRODUCT BANNER (same teal banner as existing).
6. FAQ (compact): only 4 questions — "How does BaliTrade protect my payment?", "What if the goods don't pass quality control?" (answer: "You choose: a full refund or a replacement."), "Can I order more than the stock shown?", "Which payment methods can I use?" — plus link "View all FAQ →".
7. FOR SELLERS: one slim banner (not a full section): "Are you a Bali seller? Reach buyers in Russia & CIS." + button "Become a seller".
8. FOOTER (same as existing).

Do NOT include: separate trust strip, QC & documentation preview, payment methods section, large for-sellers section.
```

### Review Prompt A → `design-ui/google-stitch/02-lengkap.html` (2026-10-21) — FINAL (acuan)

Semua poin Prompt A beres: "escrow" & emoji hilang, janji SLA/waktu kirim hilang, klaim rute & jadwal Jumat hilang, chat English, jawaban QC gagal = "full refund or a replacement", teks pengganti ("Get paid in IDR", "Shipping time depends…", "export documents from Bali") masuk. Struktur 12 bagian tetap.

Catatan implementasi (diperbaiki saat coding, tidak direvisi di Stitch):
- Bagian For Sellers masih menyebut "customs documents, and weekly …" → hapus "weekly" & "customs documents" (jadwal belum diputuskan).
- "Custom Concierge Sourcing", "custom-labeled batik hats" → sesuaikan dengan layanan yang benar-benar ada.
- Pertimbangkan meringkas landing saat implementasi (trust strip duplikat dengan checkmark di hero; QC preview & payment methods bisa dipindah ke halaman How It Works).

Catatan revisi:
-

---

## 3. Katalog / pencarian produk

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B.

Typography: Plus Jakarta Sans. Prices bold.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges (Ready stock teal/green, Made to order terracotta, New seller info blue, Auto-translated gray, Verified seller), product card, seller mini-card, chat bubbles, alerts, language switcher, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products (active), Request a Product, How It Works, Sell on BaliTrade; right: search icon, language switcher (globe + "EN"), "Log in", "Sign up". Mobile: hamburger.

Footer: dark teal #0B3A46, white text, subtle Balinese pattern; columns About, For Buyers, For Sellers, Support; language switcher; "© BaliTrade".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company legal names, license/registration numbers, street addresses, offices, bank names, partner logos, flight schedules, certifications or guarantees — omit them or use neutral placeholders like "[Bank name]". Say "Payment held by BaliTrade" instead of "escrow account". Payment methods are ONLY: bank transfer in IDR (upload receipt photo) and USDT (upload screenshot + transaction hash; do not mention any blockchain network such as TRC-20/ERC-20) — no SWIFT, no cards, no RUB, no currency switcher. Buyers are mostly individuals: never ask for company tax ID or business registration. Buyers do not choose airports or shipping routes — BaliTrade decides; buyers only enter a delivery address. Every chat always has 3 participants (buyer, seller, BaliTrade Admin) — never "direct chat with seller". Chat language is English for everyone (buyer, seller, admin) — there is no translation feature in chat; the chat composer shows a small hint "Please write in English so everyone can understand." Product descriptions are auto-translated and show "Auto-translated · View original". For gold text on light backgrounds use dark gold #9A7426 (accessible contrast); keep #C9A24A for icons, borders, fills and text on dark teal.

TASK: Design the PRODUCT CATALOG / SEARCH RESULTS page (desktop 1440px + mobile 390px).

1. NAVBAR.

2. PAGE HEADER: breadcrumb "Home / Products / Coffee & Tea"; H1 "Coffee & Tea"; result count "48 products"; large search input with current query "arabica" and a search button.

3. CATEGORY CHIPS row (horizontal scroll): All, Coffee & Tea (active), Apparel & Accessories, Bags & Rattan, Handicrafts & Wood, Home Decor, Spices & Food.

4. LEFT FILTER SIDEBAR (280px, white card, collapsible groups):
   - Listing type: checkboxes "Ready stock", "Made to order"
   - Price (USD): min–max inputs + slider
   - Minimum order (MOQ): radio "Any", "Up to 10 units", "Up to 50 units", "Up to 100 units"
   - Seller location (Bali regency): checkboxes Badung, Denpasar, Gianyar, Bangli, Tabanan, Buleleng, Karangasem, Klungkung, Jembrana
   - Seller: checkbox "Verified sellers only"
   - Buttons: "Apply filters" (primary), "Reset" (ghost)

5. RESULTS AREA:
   - Top bar: active filter chips with "×" (e.g. "Ready stock ×", "Gianyar ×", "Clear all"), sort dropdown on the right ("Sort: Recommended / Newest / Price low to high / Price high to low"), grid/list view toggle.
   - Product grid, 3 columns, 9 cards. Each card: 4:3 photo, listing-type badge on photo corner ("Ready stock" teal / "Made to order" terracotta), product name (2 lines max), seller name + regency ("Kopi Bali Asli · Bangli, Bali") with small gold "Verified" icon, price "$6.80 / kg", "MOQ 20 kg", stock line ("Available: 100 kg" for ready stock, or "Lead time: 14–21 days" for made to order), and a small chat icon button "Ask" next to a "View" button.
   - After the 6th card, insert a full-width inline banner (light gold background): "Need more than what's in stock, or can't find the right product?" + button "Request a product" + small text "Our team will source it for you."
   - Pagination at bottom.

6. EMPTY STATE variant (show as a separate small frame): illustration of an empty basket with Balinese pattern, text "No products match your search", subtext "Try different filters — or let our team find it for you.", buttons "Clear filters" and "Request this product" (primary).

7. FOOTER.

Mobile version: filters open in a bottom sheet via a "Filters" button with count badge; sort as a dropdown next to it; product grid 2 columns; inline request banner kept.
```

### Review → `design-ui/google-stitch/03.html` (2026-10-21) — FINAL (acuan alur)

Alur & struktur sesuai prompt: navbar (Request a Product, Sell on BaliTrade, Log in/Sign up), breadcrumb + judul + search, chip kategori, sidebar filter (listing type, harga USD, MOQ, kabupaten, verified only, Apply/Reset), chip filter aktif + Clear all, sort + toggle grid/list, 9 kartu (6 → banner request → 3) dengan badge Ready stock/Made to order, stok atau lead time, MOQ, tombol Ask + View, pagination, empty state ("Request this product"), mobile: tombol Filters + bottom sheet.

Catatan implementasi (tidak direvisi di Stitch):
- **Pergeseran tema visual**: Stitch memakai tema Material — background `#f8f9ff` (bukan `#FAF7F2`), primary `#003441` (bukan `#0F4C5C`), radius default 4px (bukan 12px), ikon Material Symbols (bukan Lucide). Saat coding pakai token dari design system `01-v4.html`. Prompt halaman 4+ sudah ditambah larangan tema Material.
- Footer tidak sama dengan design system (link karangan: "Ocean & Air Cargo", "Export Certification", "Freight Broker Desk", "Import Regulations"; tanpa FAQ/Contact/Terms/Privacy). Saat coding pakai footer standar (1 komponen untuk semua halaman).
- Kata "escrow" muncul di top bar & footer → ganti "Payment protection".
- Filter kabupaten belum memuat Klungkung & Jembrana → tampilkan 9 kabupaten.

Catatan revisi:
-

---

## 4. Detail produk (+ chat bertiga)

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Every conversation always includes three parties: buyer, seller and BaliTrade admin. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. Prices bold.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges (Ready stock teal/green, Made to order terracotta, New seller info blue, Auto-translated gray, Verified seller), product card, seller mini-card, chat bubbles, alerts, language switcher, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product, How It Works, Sell on BaliTrade; right: search icon, language switcher (globe + "EN"), user avatar (logged-in buyer) with notification bell.

Footer: dark teal #0B3A46, white text, subtle Balinese pattern; columns About, For Buyers, For Sellers, Support; language switcher; "© BaliTrade".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company legal names, license/registration numbers, street addresses, offices, bank names, partner logos, flight schedules, certifications or guarantees — omit them or use neutral placeholders like "[Bank name]". Say "Payment held by BaliTrade" instead of "escrow account". Payment methods are ONLY: bank transfer in IDR (upload receipt photo) and USDT (upload screenshot + transaction hash; do not mention any blockchain network such as TRC-20/ERC-20) — no SWIFT, no cards, no RUB, no currency switcher. Buyers are mostly individuals: never ask for company tax ID or business registration. Buyers do not choose airports or shipping routes — BaliTrade decides; buyers only enter a delivery address. Every chat always has 3 participants (buyer, seller, BaliTrade Admin) — never "direct chat with seller". Chat language is English for everyone (buyer, seller, admin) — there is no translation feature in chat; the chat composer shows a small hint "Please write in English so everyone can understand." Product descriptions are auto-translated and show "Auto-translated · View original". For gold text on light backgrounds use dark gold #9A7426 (accessible contrast); keep #C9A24A for icons, borders, fills and text on dark teal.

TASK: Design the PRODUCT DETAIL page for a ready-stock product (desktop 1440px + mobile 390px), plus a side chat drawer frame.

Product: "Kintamani Arabica Green Beans — Grade 1", seller "Kopi Bali Asli", location "Bangli, Bali".

1. NAVBAR. Breadcrumb: "Home / Products / Coffee & Tea / Kintamani Arabica Green Beans".

2. TOP SECTION, two columns:

   LEFT (55%) — MEDIA GALLERY: large main image, below it a thumbnail row with 5 photos and 1 video thumbnail (play icon + duration "0:42"). Small caption: "Photos and video uploaded by the seller".

   RIGHT (45%) — PURCHASE PANEL (white card, sticky on scroll):
   - Badges row: "Ready stock" (teal), "QC included" (green check), "Verified seller" (gold)
   - H1 product name
   - Small gray badge "Auto-translated from Indonesian · View original" (link)
   - Price: large bold "$6.80 / kg"; under it muted text "Price in USD, updated daily. Your price is locked when you check out."
   - Key facts grid (2 columns, small icons): "Available: 100 kg", "Minimum order: 20 kg", "Origin: Kintamani, Bangli", "Packaging: 20 kg jute sack", "Ships from: Bali (DPS) by air cargo", "Seller location: Bangli, Bali"
   - Quantity stepper with unit "kg" (value 50) and live subtotal "Subtotal: $340.00"
   - Info line (info color): "Shipping cost is calculated after packing and weighing, before shipment."
   - Primary full-width button "Buy now"
   - Secondary full-width button with chat icon "Ask the seller & BaliTrade"
   - Text link with arrow: "Need more than 100 kg? Request extra quantity →" (opens Request form prefilled with this product)
   - Small trust box (light gold background, 3 lines with icons): "Payment held by BaliTrade until delivery", "Photo & video QC report before shipping — you approve", "QC fee for Bangli area: $15 (shown at checkout)"

3. SELLER CARD (full width, white card under the top section): avatar/logo, "Kopi Bali Asli", gold "Verified seller" badge, "Bangli, Bali", "Member since 2026", stats: "Transactions: 12", "Rating: 4.8 ★ (9 reviews)", "Response time: within 1 day"; buttons "View seller profile" and "See all products (8)".
   Also show a small variant frame of this card for a NEW seller: stats replaced by "New seller — no transactions yet" in muted text, no rating stars.

4. TABS (underlined tab style): Description (active), Specifications, Shipping & Quality Control, Reviews.
   - Description: 2 paragraphs about the coffee (altitude 1,200–1,500 m, washed process, harvest 2026) with the "Auto-translated · View original" label at top.
   - Specifications (show as a clean 2-column table in a second small frame): Variety Arabica (Kopyol, S795), Process: Washed, Moisture: 11–12%, Defect: Grade 1, Screen size: 16+, Harvest: 2026, Packaging: 20 kg jute sack with GrainPro liner.
   - Shipping & Quality Control: short explanation of the 6 steps (Pay → QC → Approve → Ship → Track → Receive), note about export documents handled by BaliTrade.
   - Reviews: empty state variant "No reviews yet. Be the first to buy and review."

5. RELATED PRODUCTS: "More from Bali coffee sellers", 4 product cards.

6. FOOTER.

7. SEPARATE FRAME — CHAT DRAWER (opens from the right when clicking "Ask the seller & BaliTrade", 420px wide, over a dimmed product page):
   - Header: title "Product inquiry", product mini-row (thumbnail, name, "$6.80 / kg"), and participant avatars row with labels: "You (Buyer)", "Kopi Bali Asli (Seller)", "BaliTrade Admin" (gold "Admin" tag). Close "×".
   - Info banner (info color, small): "BaliTrade Admin is part of this conversation to keep your transaction safe. Learn more"
   - Messages:
     • Buyer (right, teal bubble): "Hi, can you send a photo of the beans from the current stock? We may need 150 kg."
     • Seller (left, white bubble, name label): "Hello, here are photos of the latest stock. For 150 kg we can prepare it within 10 days."
     • Seller attachment: 2 photo thumbnails and 1 video thumbnail in a grid.
     • Admin (left, light gold bubble, "BaliTrade Admin" label): "Since 150 kg is more than current stock, I can create a request so the seller prepares the extra 50 kg. Shall I proceed?" with two quick-action buttons inside the bubble: "Yes, create request" and "Not now".
   - Composer at bottom: attachment icon (photo/video, hint "Max 50 MB per video"), text input "Write a message in English…", send button, and a small muted hint under it: "Please write in English so everyone can understand."

Mobile version: gallery full width swipeable with dots; purchase panel below gallery; a sticky bottom bar with price "$6.80 / kg", chat icon button "Ask", and primary "Buy now"; the chat opens full-screen.
```

### Review → `design-ui/google-stitch/04.html` (2026-10-21) — FINAL (acuan alur)

Lengkap sesuai prompt & tema konsisten dengan design system (warna `#0F4C5C`/`#FAF7F2`, tanpa Material Symbols). Ada: navbar (buyer login + bell), breadcrumb, galeri 5 foto + 1 video, panel beli (badge, judul, "Auto-translated · View original", $6.80/kg + teks harga dikunci saat checkout, 6 key facts, stepper min 20/maks 100 kg + subtotal, info ongkir dihitung setelah ditimbang, Buy now, "Ask the seller & BaliTrade", link "Need more than 100 kg? Request extra quantity", trust box + QC fee Bangli $15), kartu penjual + varian penjual baru, tab Description/Specifications/Shipping & QC/Reviews (+ empty state), 4 produk terkait, chat drawer 420px (3 peserta, banner admin, pesan English, lampiran foto/video, quick action admin "Yes, create request / Not now", hint English, batas 50 MB), sticky bar mobile (harga, Ask, Buy now).

Catatan implementasi (tidak direvisi di Stitch):
- Klaim berlebihan: "Lab Verified Parameters", "QC Pass Rate 100%", "Inspected farm facility", "Organic" (produk terkait), "Physical QC guarantee" (footer), "All phytosanitary certificates, certificate of origin… fully handled", "Live AWB updates" (tracking diupdate manual) → hapus/sesuaikan.
- Navbar: label "Verified Buyer (Almaty)" belum diputuskan (tidak ada verifikasi pembeli) → cukup nama.
- Langkah 6 "Seller is released funds" → "Seller gets paid".
- Tampilkan estimasi total dekat tombol Buy: "Subtotal $340 + QC fee $15 · shipping calculated later".
- State guest (belum login): Buy now / Ask → arahkan ke login/daftar dulu.
- Footer lagi-lagi beda (link karangan) → pakai footer standar.

Pertanyaan alur untuk owner (lihat BRAINSTORMING bagian 15): keranjang (cart) vs hanya "Buy now"; varian produk (ukuran/warna).

Catatan revisi:
-

- Halaman 4 sudah final; tidak perlu revisi. Catatan: tombol "Buy now" di detail produk nanti menjadi **"Add to cart"** (sesuai keputusan keranjang 2026-10-21) — perbaiki saat implementasi.

---

## Blok HEADER untuk prompt halaman 5 dan seterusnya

Sudah tertanam di setiap prompt di bawah (tidak perlu di-copy terpisah). Isinya = design system + VISUAL REFERENCE + CONTENT RULES + **FLOW RULES** (alur keranjang terbaru).

---

## 5. Profil penjual

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Every conversation always includes three parties: buyer, seller and BaliTrade admin. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. Prices bold.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges (Ready stock teal/green, Made to order terracotta, New seller info blue, Auto-translated gray, Verified seller), product card, seller mini-card, chat bubbles, alerts, language switcher, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product, How It Works, Sell on BaliTrade; right: search icon, cart icon with item count, language switcher (globe + "EN"), notification bell, user avatar (logged-in buyer, name only).

Footer (use exactly this, do not invent links): dark teal #0B3A46, white text, subtle Balinese pattern; columns About BaliTrade; For Buyers (How it works, Request a product, Payment methods, Shipping & tracking); For Sellers (Sell on BaliTrade, Seller guidelines); Support (FAQ, Contact, Terms of Service, Privacy Policy); language switcher; "© 2026 BaliTrade".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company legal names, license/registration numbers, street addresses, offices, bank names, partner logos, flight schedules, certifications, lab results, percentages or guarantees — omit them or use neutral placeholders like "[Bank name]". Never use the word "escrow" — say "Payment held by BaliTrade until delivery". No response-time, verification-time or delivery-time promises. Payment methods are ONLY: bank transfer in IDR (upload receipt photo) and USDT (upload screenshot + transaction hash; do not mention any blockchain network) — no SWIFT, no cards, no RUB, no currency switcher. Buyers are mostly individuals: never ask for company tax ID or business registration, and never show a "Verified buyer" label. Buyers do not choose airports or shipping routes — BaliTrade decides; buyers only enter a delivery address. Every chat always has 3 participants (buyer, seller, BaliTrade Admin) — never "direct chat with seller". Chat language is English for everyone, no translation feature in chat. Product descriptions are auto-translated and show "Auto-translated · View original". For gold text on light backgrounds use dark gold #9A7426.

FLOW RULES: Ready-stock products go into a CART ("Add to cart"); made-to-order products and anything else go through a request/quotation ("Request a quote"). The cart is grouped by seller. Checkout sends an ORDER REQUEST first: each seller accepts, declines or proposes a change for their group (no rating penalty), and the buyer pays only after confirmation. Each seller group has its own quality control (QC), QC fee (based on the seller's area in Bali) and QC report. Buyer chooses "Ship together" (default, one shipment when all groups pass QC) or "Ship separately". Shipping cost is calculated after packing and weighing and billed before shipment. If QC fails, BaliTrade first helps find a replacement; a full refund is available if the buyer prefers. No product variants: each cart item has a "Note to seller" field for size/color/details.

TASK: Design the SELLER PROFILE page as seen by a buyer (desktop 1440px + mobile 390px).

Seller: "Ubud Weavers", location "Gianyar, Bali".

1. NAVBAR. Breadcrumb: "Home / Sellers / Ubud Weavers".

2. PROFILE HEADER (white card, full width):
   - Cover strip with very subtle Balinese pattern (teal, low opacity).
   - Large avatar/logo, seller name "Ubud Weavers", gold "Verified seller" badge.
   - Meta line with icons: "Gianyar, Bali" · "Member since 2026" · categories "Bags & Rattan, Home Decor".
   - Stats row (4 small stat blocks): "Transactions 24", "Rating 4.7 ★ (15 reviews)", "Products 12", "Usual response: within 1 day" (this is calculated from history, not a promise).
   - Buttons: primary "Ask Ubud Weavers & BaliTrade" (chat icon; opens 3-party chat), secondary "Share profile".
   - Small info line (info color): "QC fee for Gianyar area: $12 per order group (shown at checkout)."

3. TABS: Products (active), About, Reviews.

4. PRODUCTS TAB:
   - Left: small filter card — Listing type (Ready stock / Made to order), Category chips, Sort dropdown (Recommended, Newest, Price low–high, Price high–low).
   - Right: product grid, 3 columns, 6 cards (same product card as design system): image, listing badge, name, price in USD per unit, MOQ, stock ("Available: 120 pcs") or lead time ("Lead time: 14–21 days"); buttons: ready stock → "Add to cart" + "View"; made to order → "Request a quote" + "View".
   - Example products: Hand-woven Ata Grass Bag ($9.50 / piece, MOQ 20 pcs, Ready stock), Rattan Round Bag ($11.00 / piece, MOQ 20 pcs, Ready stock), Seagrass Storage Basket ($6.20 / piece, MOQ 30 pcs, Made to order), Rattan Placemat Set ($4.10 / set, MOQ 50 sets, Ready stock), Woven Lamp Shade ($14.00 / piece, MOQ 10 pcs, Made to order), Bamboo Tray ($5.30 / piece, MOQ 30 pcs, Ready stock).

5. ABOUT TAB (show as a second small frame): short story of the workshop in 2 paragraphs with the "Auto-translated · View original" label, a photo row of 4 workshop photos, and a facts list: "Workshop location: Gianyar, Bali", "Main materials: ata grass, rattan, seagrass", "Can produce custom quantities: Yes (via quote)".

6. REVIEWS TAB (show as a third small frame): rating summary (4.7 average, bar chart 5→1 stars), 3 review cards (buyer first name + country only, e.g. "Anna · Kazakhstan", date, stars, short English text, optional photo thumbnail). Note under the summary: "Reviews come from buyers who received their goods."

7. NEW SELLER VARIANT (separate small frame of the header): "New seller" info-blue badge instead of stats, text "New seller — no transactions yet", reviews tab shows empty state "No reviews yet."

8. FOOTER.

Mobile version: header stacks vertically, stats in a 2x2 grid, tabs scroll horizontally, product grid 2 columns, sticky bottom button "Ask Ubud Weavers & BaliTrade".
```

### Review → `design-ui/google-stitch/05.html` (2026-10-21) — FINAL (acuan alur)

Struktur lengkap sesuai prompt: header (avatar, Verified seller, Gianyar, member since, kategori), 4 statistik ("Usual response — calculated from history"), tombol Ask (3 pihak) + Share, info QC fee Gianyar $12 per kelompok order, tab Products/About/Reviews, filter (listing type + jumlah, kategori, sort), 6 kartu dengan "Add to cart" (ready stock) / "Request a quote" (made to order), info "Ordering Process", About (auto-translated + 4 foto + facts), Reviews (ringkasan + distribusi bintang + 3 ulasan nama depan · negara), varian penjual baru, footer standar (kolom sudah benar).

Catatan implementasi:
- Tema Stitch lagi-lagi Material (bg `#f8f9ff`, primary `#003441`, radius 4px, Material Symbols) walau prompt melarang → tampaknya pengaturan tema project Stitch. Pakai token design system saat coding.
- Klaim: "Certified Export Clearing Agent" (footer), "inspection and payment clearance guarantees" (empty state penjual baru), "Denpasar QC team", "verified reviews", "BaliTrade cargo clearance" → hapus/netralkan.

Catatan revisi:
-

---

## 6. Form Request (sourcing)

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Every conversation always includes three parties: buyer, seller and BaliTrade admin. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. Prices bold.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges, form inputs, file upload dropzone, alerts, language switcher, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product (active), How It Works, Sell on BaliTrade; right: search icon, cart icon with item count, language switcher (globe + "EN"), notification bell, user avatar (logged-in buyer, name only).

Footer (use exactly this, do not invent links): dark teal #0B3A46, white text, subtle Balinese pattern; columns About BaliTrade; For Buyers (How it works, Request a product, Payment methods, Shipping & tracking); For Sellers (Sell on BaliTrade, Seller guidelines); Support (FAQ, Contact, Terms of Service, Privacy Policy); language switcher; "© 2026 BaliTrade".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company legal names, license/registration numbers, street addresses, offices, bank names, partner logos, flight schedules, certifications, lab results, percentages or guarantees. Never use the word "escrow" — say "Payment held by BaliTrade until delivery". No response-time, sourcing-time or delivery-time promises. Do not state any fee amounts for sourcing — fees, if any, appear only in the quotation. Buyers are mostly individuals: never ask for company tax ID or business registration. Buyers do not choose airports or shipping routes — buyers only enter a destination country (full address comes later). Every chat always has 3 participants (buyer, seller, BaliTrade Admin). Chat language is English. For gold text on light backgrounds use dark gold #9A7426.

FLOW RULES: A request is used when the buyer cannot find a product, needs more than the stock shown, or wants a made-to-order product. BaliTrade's team searches across Bali and replies with a QUOTATION (price, quantity, lead time, QC fee, validity date) that the buyer can accept, ask to change, or decline. Negotiation happens in a 3-party chat (buyer, seller, BaliTrade Admin).

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

### Review → `design-ui/google-stitch/06.html` (2026-10-21) — FINAL (acuan alur)

Catatan file: hasil export awalnya berisi **2 salinan halaman identik** (2× `<html>`), sudah dirapikan jadi 1 salinan.

Struktur lengkap sesuai prompt: form 3 bagian (produk, kategori, deskripsi, foto referensi, chip "Related product" terisi; quantity + unit, target price opsional, needed by; destination country + helper "full address after quotation", catatan), checkbox "request, not an order", Submit + Save as draft, kartu "How requests work" 4 langkah + catatan chat English + "Payment only after you accept a quotation and the seller confirms", state sukses (#RQ-1042, Open request chat / View my requests), daftar My Requests (Submitted, Searching, Quotation ready → Review quotation, Accepted → View order, Declined → Re-request) + empty state.

Catatan implementasi:
- Tema Material (sama seperti halaman 3 & 5).
- Angka karangan "Bali Co-op Network · 140+ Verified Artisans" → hapus.
- State sukses menyebut "sourcing officer Dmitry I." padahal Dmitry I. adalah pembeli yang login → cukup "BaliTrade team".
- Footer: "backed by secure escrow and consolidated air & sea freight" → hapus escrow & sea freight (hanya air cargo).

Catatan revisi:
-

---

## 7a. Keranjang & kirim order request

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Every conversation always includes three parties: buyer, seller and BaliTrade admin. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. Prices bold, tabular numbers.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges, order status pills, form inputs, quantity stepper, alerts, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product, How It Works, Sell on BaliTrade; right: search icon, cart icon (active) with item count "3", language switcher (globe + "EN"), notification bell, user avatar (logged-in buyer, name only).

Footer (use exactly this, do not invent links): dark teal #0B3A46, white text, subtle Balinese pattern; columns About BaliTrade; For Buyers (How it works, Request a product, Payment methods, Shipping & tracking); For Sellers (Sell on BaliTrade, Seller guidelines); Support (FAQ, Contact, Terms of Service, Privacy Policy); language switcher; "© 2026 BaliTrade".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company legal names, addresses, bank names, flight schedules, certifications, percentages or guarantees. Never use the word "escrow" — say "Payment held by BaliTrade until delivery". No response-time or delivery-time promises. Buyers are mostly individuals: never ask for company tax ID or business registration. Buyers do not choose airports or shipping routes — buyers only enter a delivery address. Every chat always has 3 participants (buyer, seller, BaliTrade Admin). Chat language is English. For gold text on light backgrounds use dark gold #9A7426.

FLOW RULES: Only ready-stock products can be in the cart (made-to-order goes through a quotation). The cart is grouped by seller. "Send order request" does NOT charge the buyer: each seller first accepts, declines or proposes a change for their group (no rating penalty), then the buyer pays. Each seller group has its own QC and QC fee (based on the seller's area in Bali). The buyer chooses "Ship together" (default) or "Ship separately". Shipping cost is calculated after packing and weighing and billed before shipment. No product variants: each item has a "Note to seller" field.

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

### Review → `design-ui/google-stitch/07-a.html` (2026-10-22) — FINAL (acuan alur)

Struktur lengkap: banner "send request → sellers confirm → you pay", 2 kelompok penjual (QC fee per zona, link chat bertiga, stepper + MOQ/stok, note per item, subtotal kelompok), catatan made-to-order → quote, Ship together/separately, alamat, ringkasan ($945 + QC $27 = $972, ongkir setelah ditimbang), checkbox ToS, "Send order request"; frame status: Accepted, Change proposed (50 → 40 pcs, Accept change / Remove item / Ask BaliTrade to find a replacement), Declined (Remove / Find alternative), tombol "Continue to payment" terkunci, total disesuaikan $927. Angka konsisten.
Catatan implementasi: lihat ringkasan di atas (bagian halaman 7a–7b).

Catatan revisi:
-

---

## 7b. Pembayaran & upload bukti

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Every conversation always includes three parties: buyer, seller and BaliTrade admin. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. Prices bold, tabular numbers.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, payment radio cards, file upload dropzone, inputs, order status pills, alerts, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product, How It Works, Sell on BaliTrade; right: search icon, cart icon, language switcher (globe + "EN"), notification bell, user avatar (logged-in buyer, name only).

Footer (use exactly this, do not invent links): dark teal #0B3A46, white text, subtle Balinese pattern; columns About BaliTrade; For Buyers (How it works, Request a product, Payment methods, Shipping & tracking); For Sellers (Sell on BaliTrade, Seller guidelines); Support (FAQ, Contact, Terms of Service, Privacy Policy); language switcher; "© 2026 BaliTrade".

All prices in USD; IDR and USDT amounts are shown only as the amount to transfer. Show English text.

CONTENT RULES (strict): Do not invent bank names, account numbers, wallet addresses, company names, percentages or guarantees — use placeholders "[Bank name]", "[Account number]", "[Account holder]", "[USDT wallet address]". Do not mention any blockchain network name. Never use the word "escrow" — say "Payment held by BaliTrade until delivery". No verification-time promises. Payment methods are ONLY: bank transfer in IDR (upload receipt photo) and USDT (upload screenshot + transaction hash) — no SWIFT, no cards, no RUB. Never ask for company tax ID. Chat language is English. For gold text on light backgrounds use dark gold #9A7426.

FLOW RULES: The buyer reaches this page only after all sellers confirmed the order request. The amount due now = items + QC fees; shipping is billed later, after packing and weighing. BaliTrade verifies each payment manually. The payment should come from the buyer; if someone else pays, the buyer must tell us the payer's name.

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

### Review → `design-ui/google-stitch/07-b.html` (2026-10-22) — FINAL (acuan alur)

Struktur lengkap: status "All sellers confirmed", pilihan IDR/USDT, detail transfer (placeholder bank + copy, Rp 14,832,000 = $927 @ Rp 16,000, rate locked, referensi OR-2051), peringatan "do not split the payment", sender name, upload bukti, checkbox, ringkasan per penjual ($355 + $572 = $927), varian USDT (927.00 USDT, wallet placeholder + QR, peringatan koin lain, hash, sender wallet, screenshot), frame "Payment proof submitted" + timeline 8 langkah. Angka konsisten.
Catatan implementasi: lihat ringkasan di atas (bagian halaman 7a–7b).

Catatan revisi:
-

---

## 8. Detail order (approval QC, tagihan ongkir, tracking, terima barang)

Halaman desain terakhir di Stitch (keputusan 2026-10-22). Halaman 9–12 dibuat langsung saat implementasi.

```
DESIGN SYSTEM — BaliTrade (apply consistently to every screen)

Product: BaliTrade is a B2B export marketplace web app. Sellers are small businesses from Bali, Indonesia. Buyers are mostly individuals and small businesses from Russia and CIS countries. The BaliTrade team (admin) inspects goods (Quality Control), packs them, and ships them by air cargo to Russia/CIS. Buyer payments are held by BaliTrade until goods arrive. Every conversation always includes three parties: buyer, seller and BaliTrade admin. Trust and transparency are the core value.

Style: professional, clean, trustworthy B2B commerce with a subtle Balinese touch. White space, clear hierarchy, card-based layout, 12px rounded corners, soft shadows. Desktop-first (1440px, max content width 1280px), responsive to mobile (390px).

Colors: Primary deep teal #0F4C5C (hover #0B3A46); Accent warm gold #C9A24A; Secondary terracotta #B5563A; Background off-white #FAF7F2; Cards white; Borders #E7E2D9; Text charcoal #1F2937; Muted #6B7280; Success #2E7D5B; Warning #D99A2B; Error #C0392B; Info #2F6F8F.

Typography: Plus Jakarta Sans. Prices bold, tabular numbers.

VISUAL REFERENCE (important): This project already contains the final "BaliTrade Design System / Style Guide" screen. Reuse its exact styles and components — same logo, colors, typography, buttons, badges, order status pills, alerts, chat bubbles, file upload dropzone, navbar and footer. Do not invent new styles; this screen must look like it belongs to the same product. Use exact hex values (page background #FAF7F2, primary #0F4C5C, terracotta #B5563A), 12px radius for cards/inputs, and Lucide-style outline icons — do NOT use Material Symbols or a Material color theme.

Navbar: logo "BaliTrade" (gold frangipani mark) left; menu Products, Request a Product, How It Works, Sell on BaliTrade; right: search icon, cart icon, language switcher (globe + "EN"), notification bell with a dot, user avatar (logged-in buyer "Anna K.", name only). No announcement bar above the navbar.

Footer (use exactly this, do not invent links or taglines): dark teal #0B3A46, white text, subtle Balinese pattern; columns About BaliTrade; For Buyers (How it works, Request a product, Payment methods, Shipping & tracking); For Sellers (Sell on BaliTrade, Seller guidelines); Support (FAQ, Contact, Terms of Service, Privacy Policy); language switcher (English / Bahasa Indonesia / Русский); "© 2026 BaliTrade".

All prices in USD. Show English text.

CONTENT RULES (strict): Do not invent company names, addresses, bank names, wallet addresses, flight numbers, flight dates or schedules, certifications, lab results, percentages, ratings counts or guarantees — use placeholders like "[AWB number]", "[Bank name]". Never use the word "escrow" — say "Payment held by BaliTrade until delivery". No response-time, verification-time or delivery-time promises. Payment methods are ONLY bank transfer in IDR (receipt photo) and USDT (screenshot + transaction hash); do not mention any blockchain network. Never ask for company tax ID; no "Verified buyer" label. Buyers do not choose airports or routes. Every chat has 3 participants (buyer, the seller, BaliTrade Admin), in English only, no translation. For gold text on light backgrounds use dark gold #9A7426.

FLOW RULES: An order can contain several seller groups. Each seller group has its own QC, QC report and buyer approval, and its own 3-party chat. Shipping preference for this order is "Ship together": shipping happens only after every group is approved. After packing and weighing, BaliTrade sends a SHIPPING INVOICE that the buyer pays (same methods: IDR or USDT, upload proof) before shipment. Tracking is a list of milestones updated manually by the BaliTrade team (not live GPS). If QC fails, BaliTrade first offers to find a replacement; a full refund for that group is available if the buyer prefers. After delivery the buyer confirms receipt; then each seller gets paid and the buyer can leave a review per seller.

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

### Review → `design-ui/google-stitch/08.html` (2026-10-22) — FINAL (acuan alur)

Struktur lengkap: header order + status, stepper 9 langkah (QC "1 of 2 ready"), kartu kelompok A dengan laporan QC (5 media + video 0:58, checklist 4 poin, komentar admin, Approve / Ask / Report a problem), kelompok B "In QC", sidebar (pembayaran $900 + QC $27 paid, alamat placeholder, 2 chat bertiga, dokumen), frame QC gagal (6 topi → pengganti direkomendasikan / refund $27), frame tagihan ongkir (4 karton · 61 kg · $244), frame tracking manual (AWB placeholder, milestone), frame barang tiba (Confirm received + ulasan per penjual), sticky action mobile.

Catatan implementasi:
- Tema Material (sama seperti halaman 3, 5–7b).
- Opsi USDT ditulis "USDT TRC20" → hapus nama jaringan (TBA); ikon "credit_card" → bukan metode kartu.
- Tagihan ongkir memecah "Air cargo freight $210 + Export documentation & phytosanitary $34" → komponen biaya dokumen ekspor **belum diputuskan** (lihat BRAINSTORMING bagian 15).
- Hapus: "Estimated report: Today, 18:00" (SLA), fasilitas karangan "Gianyar Consolidated Inspection Facility / hub / depot", "Depot Lead", "direct air cargo route", "dispute protection", "paid from BaliTrade accounts".
- Footer: "Certified Origin & Quality Escrow", link tambahan (Company Profile, Newsroom, Cooperative Portal, dll.), dan **pelabuhan laut** (Tanjung Benoa, Vladivostok, Novorossiysk) → pakai footer standar; kita hanya air cargo.

Catatan revisi:
-
