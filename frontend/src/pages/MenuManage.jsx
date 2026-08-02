import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import MenuImage from '../components/MenuImage.jsx';

const CATEGORIES = ['กาแฟสด', 'เย็น', 'ปั่น', 'แอลกอฮอล์', 'อื่นๆ'];
const baht = (n) => Number(n).toFixed(2) + ' ฿';

// fieldBase ไม่มีความกว้างในตัว — ใช้กับช่องที่กำหนด w-* เอง (ถ้าพ่วง w-full มาด้วยมันจะชนะ w-28 แล้วดันของข้างๆ ทะลุออก)
const fieldBase =
  'rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ink';
const fieldClass = `w-full ${fieldBase}`;

// ── Modal คลัง Add-on กลาง — เพิ่ม/แก้/ลบ ที่นี่ที่เดียว แล้วแต่ละเมนูค่อยไปติ๊กเลือกใช้ ──
const AddonLibrary = ({ onClose, onChanged }) => {
  const { show } = useToast();
  const confirm = useConfirm();
  const [addons, setAddons] = useState([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState(null); // id ของแถวที่กำลังแก้ inline
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [busy, setBusy] = useState(false);

  // แต่ละ action มีผลทันที (ไม่รอกดบันทึกรวม) — เมนูหลายอันอ้างถึง id เดิม จึงแก้ทีละรายการ
  const load = () => api.getAddons().then(setAddons).catch((e) => show(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim() || price === '') {
      show('กรุณากรอกชื่อและราคา', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.createAddon({ name: name.trim(), price: Number(price) });
      show('เพิ่ม add-on แล้ว');
      setName('');
      setPrice('');
      load();
      onChanged();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditPrice(String(a.price));
  };

  const saveEdit = async (id) => {
    if (!editName.trim() || editPrice === '') {
      show('กรุณากรอกชื่อและราคา', 'error');
      return;
    }
    try {
      await api.updateAddon(id, { name: editName.trim(), price: Number(editPrice) });
      show('บันทึกการแก้ไขแล้ว');
      setEditingId(null);
      load();
      onChanged();
    } catch (err) {
      show(err.message, 'error');
    }
  };

  // ลบจากคลัง = หลุดจากทุกเมนูที่เปิดใช้ด้วย — ออเดอร์เก่าไม่กระทบ (snapshot ไว้แล้ว)
  const remove = async (a) => {
    const ok = await confirm({
      title: 'ลบ add-on',
      message:
        a.menu_count > 0
          ? `ลบ "${a.name}" ออกจากคลัง? จะหายจาก ${a.menu_count} เมนูที่เปิดใช้อยู่ด้วย (ออเดอร์เก่าไม่กระทบ)`
          : `ลบ "${a.name}" ออกจากคลัง? (ยังไม่มีเมนูไหนเปิดใช้)`,
      confirmText: 'ลบ',
      cancelText: 'ไม่ใช่',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAddon(a.id);
      show('ลบ add-on แล้ว');
      load();
      onChanged();
    } catch (err) {
      show(err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4">
      <div className="card w-full max-w-2xl p-6">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-ink">คลัง Add-on</h2>
          <span className="text-xs text-muted">{addons.length} รายการ</span>
        </div>
        <p className="mb-4 text-xs text-muted">
          รายการกลางที่ใช้ร่วมกันทุกเมนู — เพิ่มไว้ที่นี่ แล้วไปติ๊กเลือกในหน้าแก้ไขของแต่ละเมนูว่าจะใช้ตัวไหนบ้าง
        </p>

        <div className="mb-4 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {addons.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">ยังไม่มี add-on — เพิ่มรายการแรกด้านล่าง</p>
          ) : (
            addons.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2.5">
                {editingId === a.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={`min-w-0 flex-1 py-1.5 text-sm ${fieldBase}`}
                      autoFocus
                    />
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className={`w-24 shrink-0 py-1.5 text-sm tabular-nums ${fieldBase}`}
                    />
                    <button
                      onClick={() => saveEdit(a.id)}
                      className="rounded-md bg-amber px-3 py-1.5 text-xs font-medium text-ink transition-transform duration-100 active:scale-95"
                    >
                      บันทึก
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-ink"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm font-medium text-ink">{a.name}</span>
                    {a.menu_count > 0 && (
                      <span className="rounded bg-surface px-1.5 py-0.5 text-xs tabular-nums text-muted">
                        {a.menu_count} เมนู
                      </span>
                    )}
                    <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-ink">
                      +{baht(a.price)}
                    </span>
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded-md border border-line px-3 py-1.5 text-xs text-ink transition-colors hover:bg-surface"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="rounded-md bg-coral px-3 py-1.5 text-xs text-paper transition-transform duration-100 active:scale-95"
                    >
                      ลบ
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* ฟอร์มเพิ่มรายการใหม่เข้าคลัง — จอแคบวางเป็นแนวตั้งไม่ให้ช่องชื่อโดนบีบ */}
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อ add-on เช่น ไข่มุก"
            className={`w-full min-w-0 sm:flex-1 ${fieldBase}`}
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="1"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="ราคา (฿)"
              className={`w-28 shrink-0 tabular-nums ${fieldBase}`}
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-lg bg-amber px-4 py-2 text-sm font-medium text-ink transition-transform duration-100 active:scale-95 disabled:opacity-40"
            >
              + เพิ่ม
            </button>
          </div>
        </form>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-5 py-2 text-sm text-ink transition-colors hover:bg-surface"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Modal ฟอร์มเพิ่ม/แก้เมนู ──
const MenuForm = ({ initial, library, onClose, onSaved }) => {
  const { show } = useToast();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial?.price || '');
  const [category, setCategory] = useState(initial?.category || 'กาแฟสด');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial?.image_url || null);
  const [saving, setSaving] = useState(false);
  // เมนูนี้เปิดใช้ add-on ตัวไหนบ้าง — ติ๊กในฟอร์ม ยังไม่มีผลจนกดบันทึก
  const [addonIds, setAddonIds] = useState(() => (initial?.addons || []).map((a) => a.id));

  const onPick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const toggleAddon = (id) =>
    setAddonIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async (e) => {
    e.preventDefault();
    if (!name || price === '') {
      show('กรุณากรอกชื่อและราคา', 'error');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('price', price);
      fd.append('category', category);
      if (file) fd.append('image', file);

      const saved = editing ? await api.updateMenu(initial.id, fd) : await api.createMenu(fd);
      await api.setMenuAddons(saved.id, addonIds);

      show(editing ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มเมนูแล้ว');
      onSaved();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4">
      <form onSubmit={submit} className="card w-full max-w-md p-6">
        <h2 className="mb-4 text-lg font-bold text-ink">{editing ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}</h2>

        <div className="mb-4 flex gap-4">
          {/* preview รูป — ใช้ fallback เดียวกับหน้าจริง */}
          <div className="w-28 shrink-0">
            <MenuImage imageUrl={preview} category={category} />
            <label className="mt-2 block cursor-pointer text-center text-xs text-ink underline hover:no-underline">
              อัปโหลดรูป
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" />
            </label>
          </div>

          <div className="flex-1 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted">ชื่อเมนู</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">ราคา (฿)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={`tabular-nums ${fieldClass}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">หมวด</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* เลือกจากคลังกลางว่าเมนูนี้ให้ลูกค้าเพิ่มอะไรได้บ้าง */}
        <div className="mb-4 border-t border-line pt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink">เพิ่มพิเศษที่ใช้ได้</span>
            <span className="text-xs text-muted">
              {addonIds.length > 0 ? `เลือก ${addonIds.length} รายการ` : 'ไม่ได้เลือก'}
            </span>
          </div>

          {library.length === 0 ? (
            <p className="py-2 text-xs text-muted">
              คลัง add-on ยังว่าง — ปิดหน้านี้แล้วกดปุ่ม "จัดการ Add-on" เพื่อเพิ่มก่อน
            </p>
          ) : (
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-0.5">
              {library.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => toggleAddon(a.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                    addonIds.includes(a.id)
                      ? 'border-ink bg-surface font-medium text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                        addonIds.includes(a.id) ? 'border-ink bg-ink text-paper' : 'border-line'
                      }`}
                    >
                      {addonIds.includes(a.id) ? '✓' : ''}
                    </span>
                    {a.name}
                  </span>
                  <span className="tabular-nums">+{baht(a.price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-ink">
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber px-5 py-2 text-sm font-medium text-ink transition-transform duration-100 active:scale-95 disabled:opacity-40"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── หน้าจัดการเมนู ──
const MenuManage = () => {
  const { show } = useToast();
  const [items, setItems] = useState([]);
  const [library, setLibrary] = useState([]); // คลัง add-on กลาง (ใช้เป็นตัวเลือกในฟอร์มเมนู)
  const [editing, setEditing] = useState(undefined); // undefined = ปิด, null = เพิ่มใหม่, obj = แก้
  const [showLibrary, setShowLibrary] = useState(false);

  const load = () => api.getAllMenu().then(setItems).catch((e) => show(e.message, 'error'));
  const loadLibrary = () => api.getAddons().then(setLibrary).catch((e) => show(e.message, 'error'));
  useEffect(() => { load(); loadLibrary(); /* eslint-disable-next-line */ }, []);

  const toggleAvailable = async (item) => {
    try {
      const fd = new FormData();
      fd.append('is_available', String(!item.is_available));
      await api.updateMenu(item.id, fd);
      load();
    } catch (e) {
      show(e.message, 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">จัดการเมนู</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLibrary(true)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            จัดการ Add-on
            {library.length > 0 && (
              <span className="ml-1.5 rounded bg-surface px-1.5 text-xs tabular-nums text-muted">
                {library.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setEditing(null)}
            className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-ink transition-transform duration-100 active:scale-95"
          >
            + เพิ่มเมนู
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.id} className={`card p-2 ${item.is_available ? '' : 'opacity-50'}`}>
            <MenuImage imageUrl={item.image_url} category={item.category} />
            <div className="mt-2 line-clamp-1 px-1 text-sm font-medium text-ink">{item.name}</div>
            <div className="flex items-center justify-between px-1">
              <span className="font-bold tabular-nums text-ink">{baht(item.price)}</span>
              <span className="text-xs text-muted">{item.category}</span>
            </div>
            {item.addons?.length > 0 && (
              <div className="line-clamp-1 px-1 pt-0.5 text-xs text-muted">
                - {item.addons.map((a) => a.name).join(', ')}
              </div>
            )}
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => setEditing(item)}
                className="flex-1 rounded-md border border-line py-1 text-xs text-ink transition-colors hover:bg-surface"
              >
                แก้ไข
              </button>
              <button
                onClick={() => toggleAvailable(item)}
                className={`flex-1 rounded-md py-1 text-xs ${
                  item.is_available ? 'bg-coral/10 text-coral' : 'bg-matcha/10 text-matcha'
                }`}
              >
                {item.is_available ? 'ปิดขาย' : 'เปิดขาย'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {showLibrary && (
        <AddonLibrary
          onClose={() => setShowLibrary(false)}
          onChanged={() => { loadLibrary(); load(); }}
        />
      )}

      {editing !== undefined && (
        <MenuForm
          initial={editing}
          library={library}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(); loadLibrary(); }}
        />
      )}
    </div>
  );
};

export default MenuManage;
