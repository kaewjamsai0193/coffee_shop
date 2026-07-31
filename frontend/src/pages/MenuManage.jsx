import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import MenuImage from '../components/MenuImage.jsx';

const CATEGORIES = ['กาแฟสด', 'เย็น', 'ปั่น'];
const baht = (n) => Number(n).toFixed(2) + ' ฿';

const fieldClass =
  'w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-ink';

// ── Modal ฟอร์มเพิ่ม/แก้เมนู ──
const MenuForm = ({ initial, onClose, onSaved }) => {
  const { show } = useToast();
  const editing = !!initial;
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial?.price || '');
  const [category, setCategory] = useState(initial?.category || 'กาแฟสด');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initial?.image_url || null);
  const [saving, setSaving] = useState(false);

  const onPick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

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

      if (editing) await api.updateMenu(initial.id, fd);
      else await api.createMenu(fd);

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
  const [editing, setEditing] = useState(undefined); // undefined = ปิด, null = เพิ่มใหม่, obj = แก้

  const load = () => api.getAllMenu().then(setItems).catch((e) => show(e.message, 'error'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

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
        <button
          onClick={() => setEditing(null)}
          className="rounded-lg bg-amber px-4 py-2 text-sm font-medium text-ink transition-transform duration-100 active:scale-95"
        >
          + เพิ่มเมนู
        </button>
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

      {editing !== undefined && (
        <MenuForm
          initial={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); load(); }}
        />
      )}
    </div>
  );
};

export default MenuManage;
