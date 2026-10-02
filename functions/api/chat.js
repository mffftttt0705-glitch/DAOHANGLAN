/**
 * Cloudflare Pages Function · SenseNova 对话代理
 * 解决浏览器直接请求可能遇到的 CORS 问题
 *
 * POST /api/chat
 * Body: { apiKey, messages, model?, stream? }
 * 转发到 https://token.sensenova.cn/v1/chat/completions
 */

const UPSTREAM = "https://token.sensenova.cn/v1/chat/completions";
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

    const payload = {
      model: body.model || DEFAULT_MODEL,
      messages: body.messages || [],
      stream: body.stream !== false,
    };

    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    // 流式原样转发
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
    return new Response(
      JSON.stringify({ error: String(e.message || e) }),
      {
        status: 500,
        headers: corsHeaders({ "Content-Type": "application/json" }),
      }
    );
  }
}
