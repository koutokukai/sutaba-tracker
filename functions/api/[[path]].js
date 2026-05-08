const PREF_NAMES = {
  1:"北海道",2:"青森県",3:"岩手県",4:"宮城県",5:"秋田県",6:"山形県",7:"福島県",
  8:"茨城県",9:"栃木県",10:"群馬県",11:"埼玉県",12:"千葉県",13:"東京都",14:"神奈川県",
  15:"新潟県",16:"富山県",17:"石川県",18:"福井県",19:"山梨県",20:"長野県",21:"岐阜県",
  22:"静岡県",23:"愛知県",24:"三重県",25:"滋賀県",26:"京都府",27:"大阪府",28:"兵庫県",
  29:"奈良県",30:"和歌山県",31:"鳥取県",32:"島根県",33:"岡山県",34:"広島県",35:"山口県",
  36:"徳島県",37:"香川県",38:"愛媛県",39:"高知県",40:"福岡県",41:"佐賀県",42:"長崎県",
  43:"熊本県",44:"大分県",45:"宮崎県",46:"鹿児島県",47:"沖縄県"
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }
});

async function hashPw(pw, salt) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw + ":" + salt));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
const randSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(16)))
  .map(b => b.toString(16).padStart(2, "0")).join("");

async function auth(req, env) {
  const h = req.headers.get("authorization");
  if (!h || !h.startsWith("Basic ")) return null;
  const [gid, pw] = atob(h.slice(6)).split(":");
  if (!gid || !pw) return null;
  const row = await env.DB.prepare("SELECT * FROM groups WHERE group_id = ?").bind(gid).first();
  if (!row) return null;
  const h2 = await hashPw(pw, row.salt);
  return h2 === row.password_hash ? gid : null;
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, "");
  const method = request.method;

  if (method === "OPTIONS") return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS"
    }
  });

  try {
    // ---- AUTH ----
    if (path === "auth/register" && method === "POST") {
      const { group_id, password } = await request.json();
      if (!group_id || !password) return json({ error: "missing fields" }, 400);
      const exists = await env.DB.prepare("SELECT 1 FROM groups WHERE group_id = ?").bind(group_id).first();
      if (exists) return json({ error: "already_exists" }, 409);
      const salt = randSalt();
      const ph = await hashPw(password, salt);
      await env.DB.prepare("INSERT INTO groups (group_id, password_hash, salt) VALUES (?, ?, ?)")
        .bind(group_id, ph, salt).run();
      return json({ ok: true });
    }

    if (path === "auth/login" && method === "POST") {
      const { group_id, password } = await request.json();
      const row = await env.DB.prepare("SELECT * FROM groups WHERE group_id = ?").bind(group_id).first();
      if (!row) return json({ error: "invalid" }, 401);
      const h2 = await hashPw(password, row.salt);
      if (h2 !== row.password_hash) return json({ error: "invalid" }, 401);
      return json({ ok: true, group_id });
    }

    // 以降は要認証
    const gid = await auth(request, env);
    if (!gid) return json({ error: "unauthorized" }, 401);

    // ---- STORES ----
    if (path === "stores" && method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM stores WHERE status = 'active'").all();
      const meta = await env.DB.prepare("SELECT value FROM sync_meta WHERE key = 'last_synced_at'").first();
      return json({ stores: r.results, last_synced_at: meta?.value || null });
    }

    // ---- SYNC（公式から取得） ----
    if (path === "sync" && method === "POST") {
      let totalNew = 0, totalUpdated = 0;
      const seen = new Set();
      for (let pc = 1; pc <= 47; pc++) {
        let start = 0;
        while (true) {
          const apiUrl = `https://hn8madehag.execute-api.ap-northeast-1.amazonaws.com/prd-2019-08-21/storesearch?size=100&q.parser=structured&q=(and%20ver:10000%20record_type:1%20pref_code:${pc})&fq=(and%20data_type:%27prd%27)&sort=zip_code%20asc,store_id%20asc&start=${start}`;
          const res = await fetch(apiUrl, {
            headers: {
              "origin": "https://store.starbucks.co.jp",
              "referer": "https://store.starbucks.co.jp/",
              "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            }
          });
          if (!res.ok) {
            return json({ error: "sync_failed", status: res.status, pref: pc, start }, 500);
          }
          const data = await res.json();
          const hits = data?.hits?.hit || [];
          if (hits.length === 0) break;

          for (const hit of hits) {
            const f = hit.fields || {};
            const sid = parseInt(hit.id || f.store_id);
            if (!sid || isNaN(sid)) continue;
            const lat = parseFloat(f.latitude);
            const lng = parseFloat(f.longitude);
            if (isNaN(lat) || isNaN(lng)) continue;
            seen.add(sid);
            const existing = await env.DB.prepare("SELECT store_id FROM stores WHERE store_id = ?").bind(sid).first();
            if (existing) {
              await env.DB.prepare(
                "UPDATE stores SET name=?, pref_code=?, pref_name=?, address=?, lat=?, lng=?, status='active', last_seen_at=datetime('now') WHERE store_id=?"
              ).bind(f.name || "", pc, PREF_NAMES[pc], f.address || "", lat, lng, sid).run();
              totalUpdated++;
            } else {
              await env.DB.prepare(
                "INSERT INTO stores (store_id, name, pref_code, pref_name, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)"
              ).bind(sid, f.name || "", pc, PREF_NAMES[pc], f.address || "", lat, lng).run();
              totalNew++;
            }
          }
          if (hits.length < 100) break;
          start += 100;
        }
      }
      // 閉店マーク（今回見えなかった既存店舗）
      const all = await env.DB.prepare("SELECT store_id FROM stores WHERE status = 'active'").all();
      let closed = 0;
      for (const r of all.results) {
        if (!seen.has(r.store_id)) {
          await env.DB.prepare("UPDATE stores SET status='closed' WHERE store_id=?").bind(r.store_id).run();
          closed++;
        }
      }
      await env.DB.prepare("INSERT INTO sync_meta (key, value) VALUES ('last_synced_at', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .bind(new Date().toISOString()).run();
      return json({ ok: true, new: totalNew, updated: totalUpdated, closed });
    }

    // ---- VISITS ----
    if (path === "visits" && method === "GET") {
      const r = await env.DB.prepare("SELECT store_id, visited_on FROM visits WHERE group_id = ?").bind(gid).all();
      return json({ visits: r.results });
    }

    if (path === "visits/toggle" && method === "POST") {
      const { store_id, visited_on } = await request.json();
      const ex = await env.DB.prepare("SELECT 1 FROM visits WHERE group_id=? AND store_id=?").bind(gid, store_id).first();
      if (ex) {
        await env.DB.prepare("DELETE FROM visits WHERE group_id=? AND store_id=?").bind(gid, store_id).run();
        return json({ visited: false });
      } else {
        const date = visited_on || new Date().toISOString().slice(0, 10);
        await env.DB.prepare("INSERT INTO visits (group_id, store_id, visited_on) VALUES (?, ?, ?)").bind(gid, store_id, date).run();
        return json({ visited: true, visited_on: date });
      }
    }

    return json({ error: "not_found" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
