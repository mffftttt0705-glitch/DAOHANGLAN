/**
 * Cloudflare Pages Function · Agnes 视频生成代理
 * POST /api/video
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
      const model = body.model || "agnes-video-2.5-flash";
      let payload;

      if (/2\.5|video-2\.5/i.test(model) || /flash/i.test(model) && /video/i.test(model)) {
        payload = {
          model,
          prompt: body.prompt || "",
          mode: body.image ? "reference" : "text",
          seconds: String(body.seconds || "5"),
          size: body.size || "720P",
          aspect_ratio: body.aspect_ratio || "16:9",
        };
        if (body.image) {
          payload.images = Array.isArray(body.image) ? body.image : [body.image];
        }
      } else {
        payload = {
          model: model || "agnes-video-v2.0",
          prompt: body.prompt || "",
          height: body.height || 704,
          width: body.width || 1280,
          num_frames: body.num_frames || 121,
          frame_rate: body.frame_rate || 24,
        };
        if (body.image) {
          payload.image = body.image;
          payload.mode = body.mode || "ti2vid";
        }
      }

      const upstream = await fetch(AGNES_BASE + "/v1/videos", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: corsHeaders({
          "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        }),
      });
    }

    if (action === "poll") {
      const videoId = body.video_id || body.videoId || "";
      const taskId = body.task_id || body.taskId || "";
      const modelName = body.model || "";
      let url;
      if (videoId) {
        url = AGNES_BASE + "/agnesapi?video_id=" + encodeURIComponent(videoId);
        if (modelName) url += "&model_name=" + encodeURIComponent(modelName);
      } else if (taskId) {
        url = AGNES_BASE + "/v1/videos/" + encodeURIComponent(taskId);
      } else {
        return new Response(JSON.stringify({ error: "缺少 video_id" }), {
          status: 400,
          headers: corsHeaders({ "Content-Type": "application/json" }),
        });
      }
      const upstream = await fetch(url, { method: "GET", headers });
      const text = await upstream.text();
      return new Response(text, {
        status: upstream.status,
        headers: corsHeaders({
          "Content-Type": upstream.headers.get("Content-Type") || "application/json",
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
