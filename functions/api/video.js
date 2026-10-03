/**
 * Cloudflare Pages Function · Agnes Video 2.5 Flash 代理
 * - v2.0 已下线，统一走 agnes-video-2.5-flash
 * - dataURL 参考图会先上传为公网 URL（图生视频要求）
 * - 自动尝试 .com / .cn 节点
 */
const BASES = [
  "https://apihub.agnes-ai.com",
  "https://apihub.agnes-ai.cn",
];
const MODEL = "agnes-video-2.5-flash";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extra,
  };
}

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json" }),
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/** data:image/...;base64,xxx → Blob */
function dataUrlToBlob(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || "image/png";
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** 上传到临时图床，返回公网 URL */
async function uploadPublicImage(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  // 1) litterbox 1h 临时
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("time", "1h");
    form.append("fileToUpload", blob, "ref.png");
    const r = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
      method: "POST",
      body: form,
    });
    const t = (await r.text()).trim();
    if (r.ok && /^https?:\/\//i.test(t)) return t;
  } catch (_) {}

  // 2) catbox 永久（失败则忽略）
  try {
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", blob, "ref.png");
    const r = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      body: form,
    });
    const t = (await r.text()).trim();
    if (r.ok && /^https?:\/\//i.test(t)) return t;
  } catch (_) {}

  return null;
}

async function resolveImageUrl(image) {
  if (!image) return null;
  if (typeof image !== "string") return null;
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("data:")) return await uploadPublicImage(image);
  return null;
}

async function tryFetch(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  return { r, text, data };
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const apiKey = (body.apiKey || "").trim();
    if (!apiKey) return jsonResp({ error: "缺少 apiKey" }, 400);

    const action = body.action || "create";
    const headers = {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    };

    if (action === "create") {
      // 强制 2.5-flash（v2.0 已下线）
      let model = body.model || MODEL;
      if (/v2\.0|video-v2/i.test(model)) model = MODEL;
      if (!/video/i.test(model)) model = MODEL;
      model = MODEL; // 稳定起见统一 flash

      let prompt = (body.prompt || "").trim();
      if (!prompt) return jsonResp({ error: "缺少 prompt" }, 400);

      // 参考图 → 公网 URL
      let imageUrl = null;
      if (body.image) {
        imageUrl = await resolveImageUrl(
          Array.isArray(body.image) ? body.image[0] : body.image
        );
      }

      let payload;
      if (imageUrl) {
        // 官方 reference 模式
        if (!/<Picture\s*1>/i.test(prompt)) {
          prompt =
            "Use the character and art style in <Picture 1> as reference. " +
            prompt;
        }
        payload = {
          model,
          prompt,
          mode: "reference",
          seconds: String(body.seconds || "5"),
          size: "720P",
          aspect_ratio: body.aspect_ratio || "1:1",
          images: [imageUrl],
          n: 1,
        };
      } else {
        payload = {
          model,
          prompt,
          mode: "text",
          seconds: String(body.seconds || "5"),
          size: "720P",
          aspect_ratio: body.aspect_ratio || "16:9",
          n: 1,
        };
      }

      let last = null;
      for (const base of BASES) {
        const { r, text, data } = await tryFetch(base + "/v1/videos", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        last = { r, text, data, base };
        if (r.ok) {
          // 附带上传后的图床地址，便于排查
          const out =
            typeof data === "object" && data
              ? { ...data, _proxy: { base, model, imageUrl: imageUrl || null } }
              : data;
          return new Response(JSON.stringify(out ?? text), {
            status: 200,
            headers: corsHeaders({ "Content-Type": "application/json" }),
          });
        }
        // 401 换节点再试；其它错误也试一次另一节点
        if (r.status === 401 || r.status === 403) continue;
      }

      const errMsg =
        (last &&
          last.data &&
          (last.data.error?.message ||
            last.data.error ||
            last.data.message ||
            last.data.detail ||
            last.data.msg)) ||
        (last && last.text) ||
        "创建失败";
      return jsonResp(
        {
          error: typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg),
          raw: last && last.data,
          status: last && last.r && last.r.status,
        },
        (last && last.r && last.r.status) || 502
      );
    }

    if (action === "poll") {
      const videoId = body.video_id || body.videoId || "";
      const taskId = body.task_id || body.taskId || "";
      if (!videoId && !taskId) return jsonResp({ error: "缺少 video_id" }, 400);

      let last = null;
      for (const base of BASES) {
        let url;
        if (videoId) {
          url =
            base +
            "/agnesapi?video_id=" +
            encodeURIComponent(videoId) +
            "&model_name=" +
            encodeURIComponent(MODEL);
        } else {
          url = base + "/v1/videos/" + encodeURIComponent(taskId);
        }
        const { r, text, data } = await tryFetch(url, { method: "GET", headers });
        last = { r, text, data };
        if (r.ok) {
          return new Response(text, {
            status: 200,
            headers: corsHeaders({
              "Content-Type": r.headers.get("Content-Type") || "application/json",
            }),
          });
        }
      }
      return new Response((last && last.text) || JSON.stringify({ error: "poll failed" }), {
        status: (last && last.r && last.r.status) || 502,
        headers: corsHeaders({ "Content-Type": "application/json" }),
      });
    }

    return jsonResp({ error: "未知 action" }, 400);
  } catch (e) {
    return jsonResp({ error: String(e.message || e) }, 500);
  }
}
