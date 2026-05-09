import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";

const PREFS = ["北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"];

const api = async (path, opts = {}) => {
  const auth = localStorage.getItem("auth");
  const r = await fetch(`/api/${path}`, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: `Basic ${auth}` } : {}),
      ...(opts.headers || {})
    }
  });
  if (!r.ok) throw new Error((await r.json()).error || "error");
  return r.json();
};

// ---- Login ----
function Login({ onLogin }) {
  const [gid, setGid] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("login"); // login | register
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      if (mode === "register") {
        await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ group_id: gid, password: pw })
        }).then(r => { if (!r.ok) return r.json().then(j => { throw new Error(j.error) }); });
      }
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ group_id: gid, password: pw })
      });
      if (!r.ok) throw new Error((await r.json()).error);
      localStorage.setItem("auth", btoa(`${gid}:${pw}`));
      localStorage.setItem("group_id", gid);
      onLogin(gid);
    } catch (e) {
      setErr(mode === "register" ? "登録失敗（既に存在/不正）" : "ログイン失敗");
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg,#3d2817 0%,#1f0f04 100%)",
      backgroundImage: "linear-gradient(135deg,rgba(0,98,65,.85) 0%,rgba(31,15,4,.95) 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16
    }}>
      <form onSubmit={submit} style={{
        background: "rgba(255,255,255,.97)", padding: 32, borderRadius: 16,
        width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,.4)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>☕</div>
          <h1 style={{ margin: "8px 0 4px", color: "#006241", fontSize: 22 }}>スタバ全店舗制覇</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#888" }}>Sutaba Tracker</p>
        </div>
        <input value={gid} onChange={e => setGid(e.target.value)} placeholder="共有ID"
          style={inp} required autoComplete="username" />
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="パスワード"
          style={inp} required autoComplete="current-password" />
        {err && <div style={{ color: "#c00", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{
          width: "100%", padding: 12, background: "#006241", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer"
        }}>{busy ? "..." : (mode === "login" ? "ログイン" : "新規登録")}</button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13 }}>
          <a href="#" onClick={e => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); setErr(""); }}
            style={{ color: "#006241" }}>
            {mode === "login" ? "新規登録はこちら" : "ログインに戻る"}
          </a>
        </div>
      </form>
    </div>
  );
}
const inp = {
  width: "100%", padding: 12, marginBottom: 12, border: "1px solid #ddd",
  borderRadius: 8, fontSize: 15, boxSizing: "border-box"
};

// ---- 確認モーダル ----
function ConfirmModal({ open, title, message, onConfirm, onCancel, dateMode, onDateChange, dateValue }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 12, padding: 24, maxWidth: 360, width: "100%"
      }}>
        <h3 style={{ margin: "0 0 12px" }}>{title}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#444" }}>{message}</p>
        {dateMode && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#666" }}>訪問日:</label>
            <input type="date" value={dateValue} onChange={e => onDateChange(e.target.value)}
              style={{ ...inp, marginTop: 6, marginBottom: 0 }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={btnGhost}>キャンセル</button>
          <button onClick={onConfirm} style={btnPrimary}>OK</button>
        </div>
      </div>
    </div>
  );
}
const btnPrimary = {
  padding: "10px 18px", background: "#006241", color: "#fff", border: "none",
  borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600
};
const btnGhost = {
  padding: "10px 18px", background: "#eee", color: "#333", border: "none",
  borderRadius: 6, cursor: "pointer", fontSize: 14
};

// ---- 地図ビュー ----
function MapView({ stores, visits, onToggle }) {
  const mapRef = useRef(null);
  const elRef = useRef(null);
  const clusterRef = useRef(null);
  const meRef = useRef(null);
  const cbRef = useRef(onToggle);
  cbRef.current = onToggle;

  useEffect(() => {
    if (mapRef.current) return;
    const m = L.map(elRef.current, { zoomControl: true }).setView([36.5, 138], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 19
    }).addTo(m);
    mapRef.current = m;

    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(p => {
        const ll = [p.coords.latitude, p.coords.longitude];
        if (meRef.current) meRef.current.setLatLng(ll);
        else meRef.current = L.circleMarker(ll, {
          radius: 9, color: "#fff", fillColor: "#2196f3", fillOpacity: 1, weight: 3
        }).addTo(m).bindPopup("現在地");
      }, () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 });
    }

    window.__sutabaToggle = (id) => cbRef.current(id);
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (clusterRef.current) m.removeLayer(clusterRef.current);
    const visited = new Set(visits.map(v => v.store_id));
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50, showCoverageOnHover: false, spiderfyOnMaxZoom: true
    });
    stores.forEach(s => {
      const v = visited.has(s.store_id);
      const visitedDate = visits.find(x => x.store_id === s.store_id)?.visited_on || "";
      const icon = L.divIcon({
        className: "sutaba-pin",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:${v?"#ffd700":"#006241"};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
      });
      const popup = `
        <div style="min-width:180px">
          <b>${s.name}</b><br>
          <span style="color:#666;font-size:12px">${s.pref_name}</span><br>
          <span style="font-size:12px">${s.address || ""}</span><br>
          ${v ? `<div style="color:#b8860b;font-size:12px;margin-top:4px">✓ ${visitedDate}</div>` : ""}
          <button onclick="window.__sutabaToggle(${s.store_id})" style="margin-top:8px;padding:6px 12px;background:${v?"#888":"#006241"};color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px">
            ${v ? "訪問取消" : "訪問記録"}
          </button>
        </div>`;
      cluster.addLayer(L.marker([s.lat, s.lng], { icon }).bindPopup(popup));
    });
    m.addLayer(cluster);
    clusterRef.current = cluster;
  }, [stores, visits]);

  return <div ref={elRef} style={{ height: "calc(100vh - 110px)", width: "100%" }} />;
}

// ---- 一覧ビュー ----
function ListView({ stores, visits, onToggle }) {
  const [pref, setPref] = useState("all");
  const [q, setQ] = useState("");
  const visitedMap = new Map(visits.map(v => [v.store_id, v.visited_on]));
  const filtered = stores.filter(s =>
    (pref === "all" || s.pref_name === pref) &&
    (!q || s.name.includes(q) || (s.address || "").includes(q))
  );
  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={pref} onChange={e => setPref(e.target.value)}
          style={{ padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }}>
          <option value="all">全都道府県</option>
          {PREFS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="店舗名/住所で検索"
          style={{ flex: 1, minWidth: 150, padding: 8, fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }} />
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>{filtered.length}件</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(s => {
          const v = visitedMap.has(s.store_id);
          return (
            <div key={s.store_id} onClick={() => onToggle(s.store_id)} style={{
              display: "flex", alignItems: "center", padding: 10,
              background: v ? "#fff8dc" : "#fff",
              border: "1px solid #eee", borderRadius: 8, cursor: "pointer"
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, marginRight: 10,
                background: v ? "#ffd700" : "transparent",
                border: `2px solid ${v ? "#b8860b" : "#ccc"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12, fontWeight: 700
              }}>{v && "✓"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.pref_name} {s.address || ""}
                </div>
                {v && <div style={{ fontSize: 11, color: "#b8860b", marginTop: 2 }}>✓ {visitedMap.get(s.store_id)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- メイン ----
export default function App() {
  const [gid, setGid] = useState(localStorage.getItem("group_id") || null);
  const [tab, setTab] = useState("map");
  const [stores, setStores] = useState([]);
  const [visits, setVisits] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const reload = useCallback(async () => {
    if (!gid) return;
    setLoading(true);
    try {
      const [sRes, vRes] = await Promise.all([api("stores"), api("visits")]);
      setStores(sRes.stores || []);
      setVisits(vRes.visits || []);
      setLastSync(sRes.last_synced_at);
    } catch (e) {
      if (String(e).includes("unauthorized")) logout();
    } finally { setLoading(false); }
  }, [gid]);

  useEffect(() => { reload(); }, [reload]);

  const logout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("group_id");
    setGid(null);
  };

  const sync = async () => {
    if (!window.confirm("公式から店舗データを同期します。1〜2分かかります。実行しますか？")) return;
    setLoading(true);
    try {
      const r = await api("sync", { method: "POST" });
      alert(`同期完了\n新規: ${r.new}件 / 更新: ${r.updated}件 / 閉店: ${r.closed}件`);
      await reload();
    } catch (e) {
      alert("同期失敗: " + e.message);
    } finally { setLoading(false); }
  };

  const requestToggle = (storeId) => {
    const v = visits.find(x => x.store_id === storeId);
    const store = stores.find(s => s.store_id === storeId);
    if (!store) return;
    if (v) {
      setConfirm({
        title: "訪問記録を取消",
        message: `「${store.name}」のチェックを外しますか？`,
        onConfirm: async () => {
          await api("visits/toggle", { method: "POST", body: JSON.stringify({ store_id: storeId }) });
          await reload();
          setConfirm(null);
        }
      });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      let date = today;
      setConfirm({
        title: "訪問チェック",
        message: `「${store.name}」を訪問済みにしますか？`,
        dateMode: true,
        dateValue: today,
        onDateChange: (d) => { date = d; setConfirm(c => c && { ...c, dateValue: d }); },
        onConfirm: async () => {
          await api("visits/toggle", { method: "POST", body: JSON.stringify({ store_id: storeId, visited_on: date }) });
          await reload();
          setConfirm(null);
        }
      });
    }
  };

  if (!gid) return <Login onLogin={setGid} />;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f5" }}>
      <header style={{
        background: "#006241", color: "#fff", padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0
      }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>☕ Sutaba Tracker</div>
        <div style={{ flex: 1, fontSize: 13 }}>
          訪問 <b>{visits.length}</b> / <b>{stores.length}</b>
          <span style={{ opacity: .8, marginLeft: 8 }}>
            ({stores.length > 0 ? Math.floor(visits.length / stores.length * 100) : 0}%)
          </span>
        </div>
        <button onClick={sync} disabled={loading} style={{
          padding: "6px 10px", background: "rgba(255,255,255,.2)", color: "#fff",
          border: "1px solid rgba(255,255,255,.4)", borderRadius: 4, fontSize: 12, cursor: "pointer"
        }}>
          {loading ? "..." : "同期"}
        </button>
        <button onClick={logout} style={{
          padding: "6px 10px", background: "transparent", color: "#fff",
          border: "1px solid rgba(255,255,255,.4)", borderRadius: 4, fontSize: 12, cursor: "pointer"
        }}>logout</button>
      </header>

      <div style={{ display: "flex", background: "#fff", borderBottom: "1px solid #ddd", flexShrink: 0 }}>
        {[["map", "🗺 地図"], ["list", "📋 一覧"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: 12, border: "none",
            background: tab === k ? "#006241" : "transparent",
            color: tab === k ? "#fff" : "#333",
            fontSize: 14, fontWeight: 600, cursor: "pointer"
          }}>{l}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {stores.length === 0 && !loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
            <p>まだ店舗データが入ってません。</p>
            <button onClick={sync} style={{ ...btnPrimary, marginTop: 12 }}>
              公式から同期する
            </button>
          </div>
        ) : tab === "map" ? (
          <MapView stores={stores} visits={visits} onToggle={requestToggle} />
        ) : (
          <ListView stores={stores} visits={visits} onToggle={requestToggle} />
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        dateMode={confirm?.dateMode}
        dateValue={confirm?.dateValue}
        onDateChange={confirm?.onDateChange}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
