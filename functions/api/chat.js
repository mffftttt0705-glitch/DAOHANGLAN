/**
 * Cloudflare Pages Function · 多模型对话 / 生图代理
 * POST /api/chat
 * Body: { apiKey, base?, path?, model?, messages?, stream?, prompt?, n?, size? }
 */

const DEFAULT_BASE = "https://token.sensenova.cn/v1";
const DEFAULT_MODEL = "sensenova-6.8-flash-lite";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extra,
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const apiKey = (body.apiKey || "").trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "缺少 apiKey" }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/json" }),
      });
    }

    let base = (body.base || DEFAULT_BASE).replace(/\/$/, "");
    if (!base.startsWith("https://")) {
      return new Response(JSON.stringify({ error: "base 必须是 https" }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/json" }),
      });
    }

    let path = body.path || "/chat/completions";
    if (!path.startsWith("/")) path = "/" + path;
    // 仅允许常见 OpenAI 兼容路径，防止 SSRF 滥用
    const allowed = ["/chat/completions", "/images/generations"];
    if (!allowed.includes(path)) {
      return new Response(JSON.stringify({ error: "不支持的 path" }), {
        status: 400,
        headers: corsHeaders({ "Content-Type": "application/json" }),
      });
    }

    const upstreamUrl = base + path;
    let payload;
    if (path === "/images/generations") {
      payload = {
        model: body.model || "dall-e-3",
        prompt: body.prompt || "",
        n: body.n || 1,
        size: body.size || "1024x1024",
      };
    } else {
      payload = {
        model: body.model || DEFAULT_MODEL,
        messages: body.messages || [],
        stream: body.stream !== false,
      };
    }

    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (payload.stream && upstream.body) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: corsHeaders({
          "Content-Type":
            upstream.headers.get("Content-Type") || "text/event-stream",
          "Cache-Control": "no-cache",
        }),
      });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: corsHeaders({
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: corsHeaders({ "Content-Type": "application/json" }),
    });
  }
}
