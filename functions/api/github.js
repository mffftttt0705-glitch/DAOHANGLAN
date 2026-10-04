/**
 * Cloudflare Pages Function · GitHub Contents API 代理
 * POST { action, token, owner, repo, branch, path, content, message, sha }
 */
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const token = (body.token || "").trim();
    if (!token) return json({ error: "缺少 token" }, 400);

    const owner = (body.owner || "").trim();
    const repo = (body.repo || "").trim();
    const branch = (body.branch || "main").trim();
    const path = (body.path || "").replace(/^\/+/, "");
    const action = body.action || "get";

    const headers = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "pages-ai-chat",
    };

    if (action === "test") {
      const r = await fetch("https://api.github.com/user", { headers });
      const d = await r.json();
      if (!r.ok) return json({ error: d.message || "token 无效" }, r.status);
      return json({ ok: true, login: d.login, name: d.name });
    }

    if (!owner || !repo) return json({ error: "缺少 owner/repo" }, 400);

    if (action === "get") {
      const url =
        "https://api.github.com/repos/" +
        encodeURIComponent(owner) +
        "/" +
        encodeURIComponent(repo) +
        "/contents/" +
        path.split("/").map(encodeURIComponent).join("/") +
        "?ref=" +
        encodeURIComponent(branch);
      const r = await fetch(url, { headers });
      const d = await r.json();
      return json(d, r.status);
    }

    if (action === "put") {
      // content must be base64
      let contentB64 = body.contentBase64;
      if (!contentB64 && typeof body.content === "string") {
        // utf-8 to base64
        const bytes = new TextEncoder().encode(body.content);
        let bin = "";
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        contentB64 = btoa(bin);
      }
      if (!contentB64) return json({ error: "缺少 content" }, 400);

      // get sha if exists
      let sha = body.sha || null;
      if (!sha) {
        const getUrl =
          "https://api.github.com/repos/" +
          encodeURIComponent(owner) +
          "/" +
          encodeURIComponent(repo) +
          "/contents/" +
          path.split("/").map(encodeURIComponent).join("/") +
          "?ref=" +
          encodeURIComponent(branch);
        const gr = await fetch(getUrl, { headers });
        if (gr.ok) {
          const gd = await gr.json();
          sha = gd.sha;
        }
      }

      const putUrl =
        "https://api.github.com/repos/" +
        encodeURIComponent(owner) +
        "/" +
        encodeURIComponent(repo) +
        "/contents/" +
        path.split("/").map(encodeURIComponent).join("/");
      const payload = {
        message: body.message || ("update " + path),
        content: contentB64,
        branch,
      };
      if (sha) payload.sha = sha;

      const r = await fetch(putUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      return json(d, r.status);
    }

    if (action === "tree") {
      // list root or path via contents API
      const url =
        "https://api.github.com/repos/" +
        encodeURIComponent(owner) +
        "/" +
        encodeURIComponent(repo) +
        "/contents/" +
        (path ? path.split("/").map(encodeURIComponent).join("/") : "") +
        "?ref=" +
        encodeURIComponent(branch);
      const r = await fetch(url, { headers });
      const d = await r.json();
      return json(d, r.status);
    }

    return json({ error: "未知 action" }, 400);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
