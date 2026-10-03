/**
 * Cloudflare Pages Function · Agnes 视频生成代理
 * POST /api/video
 * body: { action: "create"|"poll", apiKey, prompt?, video_id?, task_id?, ... }
 */

const AGNES_BASE = "https://apihub.agnes-ai.com";

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

    const action = body.action || "create";
    const headers = {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    };

    if (action === "create") {
      const payload = {
        model: body.model || "agnes-video-v2.0",
        prompt: body.prompt || "",
        height: body.height || 768,
        width: body.width || 1152,
        num_frames: body.num_frames || 121,
        frame_rate: body.frame_rate || 24,
      };
      if (body.image) payload.image = body.image;
      if (body.mode) payload.mode = body.mode;

      const upstream = await fetch(AGNES_BASE + "/v1/videos", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: corsHeaders({
          "Content-Type":
            upstream.headers.get("Content-Type") || "application/json",
        }),
      });
    }

    if (action === "poll") {
      const videoId = body.video_id || body.videoId || "";
      const taskId = body.task_id || body.taskId || "";
      let url;
      if (videoId) {
        url = AGNES_BASE + "/agnesapi?video_id=" + encodeURIComponent(videoId);
      } else if (taskId) {
        url = AGNES_BASE + "/v1/videos/" + encodeURIComponent(taskId);
      } else {
        return new Response(JSON.stringify({ error: "缺少 video_id 或 task_id" }), {
          status: 400,
          headers: corsHeaders({ "Content-Type": "application/json" }),
        });
      }
      const upstream = await fetch(url, { method: "GET", headers });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: corsHeaders({
          "Content-Type":
            upstream.headers.get("Content-Type") || "application/json",
        }),
      });
    }

    return new Response(JSON.stringify({ error: "未知 action" }), {
      status: 400,
      headers: corsHeaders({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: corsHeaders({ "Content-Type": "application/json" }),
    });
  }
}
