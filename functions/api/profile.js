/**
 * Cloudflare Pages Function + KV
 * Binding name must be: PROFILE  (KV namespace)
 *
 * GET  /api/profile  → 返回当前资料 JSON
 * POST /api/profile  → 保存资料 JSON（body 为完整 profile 对象）
 * OPTIONS            → CORS 预检
 */

const KEY = "profile";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet({ env }) {
  try {
    if (!env.PROFILE) {
      return new Response(
        JSON.stringify({ error: "KV binding PROFILE 未配置" }),
        { status: 500, headers: corsHeaders() }
      );
    }
    const data = await env.PROFILE.get(KEY, { type: "json" });
    return new Response(JSON.stringify(data || {}), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e.message || e) }),
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.PROFILE) {
      return new Response(
        JSON.stringify({ error: "KV binding PROFILE 未配置" }),
        { status: 500, headers: corsHeaders() }
      );
    }
    const body = await request.json();
    // 简单体积保护（KV 单值建议 < 1MB 更稳妥，这里放宽到约 3MB）
    const str = JSON.stringify(body);
    if (str.length > 3 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "数据过大，请压缩图片或改用外链" }),
        { status: 413, headers: corsHeaders() }
      );
    }
    await env.PROFILE.put(KEY, str);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e.message || e) }),
      { status: 500, headers: corsHeaders() }
    );
  }
}
