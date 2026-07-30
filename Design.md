# Coffee POS — Design System

ธีม: **"ทุกอย่างคือใบเสร็จ"** — ระบบ POS ของร้านกาแฟที่หยิบเอาความรู้สึกของใบเช็ค/ใบสั่งกาแฟจริงมาใช้ทั่วทั้งแอป
ตะกร้าสินค้า, การ์ดออเดอร์ในครัว, และแถวยอดขายใน dashboard ล้วนมีลุคใบเสร็จแบบเดียวกัน (ขอบปะ, จุดฉีก, ฟอนต์ตัวเลขแบบเครื่องพิมพ์)
เพื่อให้แอปรู้สึกเป็นหนึ่งเดียวและ "จับต้องได้" แม้จะเป็นดิจิทัล

---

## 1. Color Tokens

| Token | Hex | ใช้ตรงไหน |
|---|---|---|
| `--foam` | `#FBF3E9` | พื้นหลังหลัก (โทนครีมอมชมพูอ่อน ไม่ใช่ครีมล้วน) |
| `--grounds` | `#4A2E2A` | Navbar, header, ตัวหนังสือหลัก (น้ำตาลกาแฟเข้มอมม่วง ไม่ใช่น้ำตาลเอสเปรสโซ่ธรรมดา) |
| `--marigold` | `#E8A33D` | สีหลัก (ปุ่มยืนยัน, badge, accent) — ส้มทองอิ่มตัวสูง ไม่ใช่ terracotta |
| `--matcha` | `#4F8B6E` | สำเร็จ/completed, ยอดขายเป็นบวก |
| `--cherry` | `#D1483B` | แจ้งเตือน/ลบ/error |
| `--paper` | `#FFFFFF` | พื้นการ์ด/ตั๋ว บนพื้น foam |

```js
// tailwind.config.js — theme.extend.colors
colors: {
  foam: '#FBF3E9',
  grounds: '#4A2E2A',
  marigold: '#E8A33D',
  matcha: '#4F8B6E',
  cherry: '#D1483B',
}
```

ห้ามใช้สีนอกเหนือจากตารางนี้ในหน้าใหม่ ถ้าต้องการเฉด ให้ใช้ opacity/tint ของสีเดิม (เช่น `bg-marigold/10`)

---

## 2. Typography

| Role | Font | ใช้ตรงไหน |
|---|---|---|
| Display | **Fraunces** (serif, wght 400–600, มี optical size) | ราคาตัวใหญ่, หัวข้อหน้า, ตัวเลขยอดขายใน dashboard |
| Body / UI | **Plus Jakarta Sans** | ปุ่ม, label, เมนู, ข้อความทั่วไป |
| Data / Ticket | **Space Mono** | เลขออเดอร์ (`ORD-00219481`), เวลา, แถวใน receipt |

```html
<!-- index.html -->
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

```js
fontFamily: {
  display: ['Fraunces', 'serif'],
  sans: ['Plus Jakarta Sans', 'sans-serif'],
  mono: ['Space Mono', 'monospace'],
}
```

กฎ: ราคา/ตัวเลขเงินใหญ่ → `font-display`. เลขออเดอร์/เวลา → `font-mono`. ทุกอย่างอื่น → `font-sans` (default)

---

## 3. Signature Component — "Ticket Card"

ใช้ 3 ที่: ตะกร้าสินค้า (Menu), การ์ดออเดอร์ (Orders board), แถวยอดขาย (Dashboard)

```css
.ticket {
  background: var(--paper);
  border-radius: 4px;
  position: relative;
  box-shadow: 0 2px 8px rgba(74, 46, 42, 0.08);
}
.ticket::before {
  /* ขอบบนแบบปะ (perforation) */
  content: '';
  position: absolute;
  top: -1px; left: 0; right: 0;
  height: 8px;
  background-image: radial-gradient(circle, var(--foam) 3px, transparent 3px);
  background-size: 12px 8px;
  background-position: 0 -4px;
}
```

- มุมโค้งเล็ก (4px) ไม่ใช่ปัดโค้งมนแบบ card ทั่วไป — ให้ความรู้สึกกระดาษ ไม่ใช่แอปมือถือทั่วไป
- เลขออเดอร์วางบนสุดด้วย `font-mono text-grounds/60 text-sm`
- เส้นแบ่งรายการสินค้าใช้ `border-dashed border-grounds/15` แทนเส้นทึบ

---

## 4. Layout ต่อหน้า

### Order (หน้าสั่งสินค้า — public, ไม่ต้อง login)
```
┌─────────────────────────────┬──────────────┐
│ [pill tabs: กาแฟสด|เย็น|ปั่น]   │  🧾 ตะกร้า    │
│                              │  (ticket)     │
│  [การ์ดเมนู] [การ์ดเมนู] [การ์ดเมนู] │  รายการ...    │
│  [การ์ดเมนู] [การ์ดเมนู] [การ์ดเมนู] │  ─ ─ ─ ─ ─   │
│                              │  รวม 155 ฿    │
│                              │ [ยืนยันสั่ง]   │
└─────────────────────────────┴──────────────┘
```
- การ์ดเมนู: กดแล้ว `scale-95` ทันที (ความรู้สึกกดปุ่มจริง) + ตัวเลข badge จำนวนเด้ง (`animate-bounce` ครั้งเดียว) มุมขวาบนเมื่อเพิ่มของ
- ตะกร้าเป็น ticket ที่ sticky ด้านขวา ราคาตัวรวมใช้ `font-display text-3xl`

### Orders (บอร์ดครัว — admin เท่านั้น, มีปุ่มยืนยัน "เสร็จแล้ว")
```
[ticket ORD-001] [ticket ORD-002] [ticket ORD-003] →  scroll แนวนอน
   รายการ...         รายการ...        รายการ...
   [เสร็จแล้ว]        [เสร็จแล้ว]       [เสร็จแล้ว]
```
- ออเดอร์ใหม่ที่เพิ่งสั่งเข้ามา: เล่น animation ตั๋ว "เด้งเข้ามา" จากด้านล่าง + หมุนเอียงเล็กน้อย (-2deg → 0deg) เหมือนกระดาษเพิ่งพิมพ์ออกมาจากเครื่อง
- กด "เสร็จแล้ว" → ปั๊มตรา ✓ สีเขียว (`--matcha`) กลางตั๋วก่อน แล้วค่อย fade+slide ออกใน 400ms

### Dashboard (ยอดขาย — admin เท่านั้น)
```
┌──────────┐ ┌──────────┐ ┌──────────┐
│ วันนี้    │ │ เดือนนี้  │ │ ปีนี้     │
│ ฿ 4,250  │ │ ฿ 82,100 │ │ ฿ 940,300│  ← count-up animation ตอนโหลด
└──────────┘ └──────────┘ └──────────┘
รายการล่าสุด (ticket rows แนวตั้ง แบบ list ใบเสร็จ)
```
- ตัวเลขยอดขาย: นับขึ้นจาก 0 ด้วย ease-out ~800ms ตอน mount (ใช้ `requestAnimationFrame`, ไม่ใช้ library หนักๆ)
- เส้นใต้ตัวเลขบางๆ สี `marigold` ใต้การ์ดที่ active/สูงสุดของวันนั้น

---

## 5. Motion Guidelines

| Interaction | Animation |
|---|---|
| กดปุ่ม/การ์ดเมนู | `active:scale-95 transition-transform duration-100` |
| เพิ่มของลงตะกร้า | badge `animate-bounce` 1 รอบ (~400ms) |
| ออเดอร์ใหม่เข้าบอร์ด | slide-up + rotate(-2deg → 0) ~350ms ease-out |
| ยืนยันออเดอร์เสร็จ | stamp scale-in (0 → 1.1 → 1) 250ms แล้วค่อย fade-out ตั๋วทั้งใบ 400ms |
| ตัวเลขยอดขาย dashboard | count-up 800ms ease-out ตอน mount ครั้งเดียว |

**กฎสำคัญ:** ทุก animation ต้องเช็ค `prefers-reduced-motion: reduce` แล้วตัด count-up/slide/stamp ออก เหลือแค่เปลี่ยน state ทันที
ห้ามใส่ animation เพิ่มนอกตารางนี้ — ความสม่ำเสมอสำคัญกว่าลูกเล่นเยอะ

---

## 6. สิ่งที่ห้ามทำ (กัน AI-generated look)
- ห้ามใช้ palette ครีม + terracotta (#D97757) ตรงๆ — ใช้ marigold/grounds ตามตารางด้านบนแทน
- ห้ามใช้ card ปัดมุมมนเยอะ (`rounded-2xl` ทั่วหน้า) — ใช้มุม 4px ของ ticket แทนเพื่อความรู้สึกกระดาษ
- ห้ามใส่ gradient พื้นหลังลอยๆ ที่ไม่มีความหมาย
- เลข 01/02/03 หรือ numbered marker จะใช้เฉพาะตอนมีลำดับจริง (เช่น step การ setup) ไม่ใช่ตกแต่งเฉยๆ

---

## 7. รูปเมนู + Fallback

**รูปจริง:** ทุกรูปถูก crop เป็นสี่เหลี่ยมจัตุรัสและ resize เป็น 600×600 (webp) ฝั่ง backend ตั้งแต่ตอนอัปโหลด
→ ฝั่ง UI แสดงในกรอบ **อัตราส่วน 1:1 เสมอ** (`aspect-square object-cover`) ไม่ต้องกลัวรูปยืด/ล้น layout

**การ์ดเมนู (Order page):** รูป/fallback อยู่บนสุดของการ์ด เต็มความกว้าง เป็นสี่เหลี่ยมจัตุรัส ตามด้วยชื่อ (`font-sans`) และราคา (`font-display`)

**Fallback เมื่อไม่มีรูป** (`image_url` = null): แทนที่ช่องรูปด้วยบล็อกสีตามหมวด + emoji กลางบล็อก (ไม่โชว์ไอคอนรูปเสีย)

| หมวด | Emoji | สีพื้นบล็อก | สี emoji/ตัวอักษร |
|---|---|---|---|
| กาแฟสด | ☕ | `bg-grounds/10` | `text-grounds` |
| เย็น | 🧊 | `bg-matcha/10` | `text-matcha` |
| ปั่น | 🥤 | `bg-marigold/15` | `text-marigold` |

- emoji ขนาดใหญ่กลางบล็อก (`text-5xl`), บล็อกใช้ radius 4px เท่ากับ ticket
- ในหน้า **Menu Manage** ช่องอัปโหลดที่ยังไม่มีรูปให้แสดง fallback เดียวกันนี้ + ปุ่ม "อัปโหลดรูป" ทับมุม เพื่อให้ preview ตรงกับหน้าจริง