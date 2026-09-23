import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const PASSWORD = "@55ff";
const STORAGE_KEY = "nav_profile_v1";

/* ========== 个人资料 DOM ========== */
const avatarImg = document.getElementById("avatarImg");
const displayName = document.getElementById("displayName");
const displayBio = document.getElementById("displayBio");
const customBg = document.getElementById("customBg");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const modalMask = document.getElementById("modalMask");
const closeModal = document.getElementById("closeModal");
const pwdInput = document.getElementById("pwdInput");
const settingsForm = document.getElementById("settingsForm");
const nameInput = document.getElementById("nameInput");
const bioInput = document.getElementById("bioInput");
const avatarUrlInput = document.getElementById("avatarUrlInput");
const avatarFileInput = document.getElementById("avatarFileInput");
const bgUrlInput = document.getElementById("bgUrlInput");
const bgFileInput = document.getElementById("bgFileInput");
const clearBgBtn = document.getElementById("clearBgBtn");
const fxSelect = document.getElementById("fxSelect");
const saveBtn = document.getElementById("saveBtn");
const fxBar = document.getElementById("fxBar");

/* 默认透明占位头像（灰色圆环感） */
const DEFAULT_AVATAR =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="48" fill="%23ffffff10"/><circle cx="48" cy="40" r="16" fill="%23ffffff28"/><ellipse cx="48" cy="78" rx="26" ry="18" fill="%23ffffff22"/></svg>'
  );

/* ========== 读取 / 应用资料 ========== */
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return applyProfile({});
    applyProfile(JSON.parse(raw));
  } catch {
    applyProfile({});
  }
}

function applyProfile(data) {
  const name = data.name || "未设置昵称";
  const bio = data.bio || "点击右下角设置进行个性化";
  displayName.textContent = name;
  displayBio.textContent = bio;
  nameInput.value = data.name || "";
  bioInput.value = data.bio || "";
  avatarUrlInput.value = data.avatarUrl && !data.avatarUrl.startsWith("data:") ? data.avatarUrl : "";
  bgUrlInput.value = data.bgUrl && !String(data.bgUrl).startsWith("data:") ? data.bgUrl : "";
  fxSelect.value = data.fx || "none";

  avatarImg.src = data.avatarUrl || DEFAULT_AVATAR;
  avatarImg.onerror = () => {
    avatarImg.src = DEFAULT_AVATAR;
  };

  if (data.bgUrl) {
    customBg.style.backgroundImage = `url("${data.bgUrl}")`;
    customBg.classList.add("show");
  } else {
    customBg.style.backgroundImage = "";
    customBg.classList.remove("show");
  }

  setFxMode(data.fx || "none", false);
}

function saveProfile(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  applyProfile(data);
}

function getStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ========== 设置面板 ========== */
settingsBtn.addEventListener("click", () => {
  pwdInput.value = "";
  settingsForm.hidden = true;
  settingsModal.hidden = false;
  pwdInput.focus();
});

function closeSettings() {
  settingsModal.hidden = true;
}

closeModal.addEventListener("click", closeSettings);
modalMask.addEventListener("click", closeSettings);

pwdInput.addEventListener("input", () => {
  settingsForm.hidden = pwdInput.value !== PASSWORD;
});

saveBtn.addEventListener("click", async () => {
  if (pwdInput.value !== PASSWORD) {
    alert("密码错误");
    return;
  }

  let avatarUrl = avatarUrlInput.value.trim();
  let bgUrl = bgUrlInput.value.trim();
  const prev = getStored();

  if (avatarFileInput.files[0]) {
    try {
      avatarUrl = await fileToDataURL(avatarFileInput.files[0]);
    } catch {
      alert("头像读取失败");
      return;
    }
  } else if (!avatarUrl && prev.avatarUrl) {
    avatarUrl = prev.avatarUrl;
  }

  if (bgFileInput.files[0]) {
    try {
      bgUrl = await fileToDataURL(bgFileInput.files[0]);
    } catch {
      alert("背景图读取失败");
      return;
    }
  } else if (!bgUrl && prev.bgUrl && bgUrlInput.value !== "") {
    bgUrl = prev.bgUrl;
  }

  try {
    saveProfile({
      name: nameInput.value.trim(),
      bio: bioInput.value.trim(),
      avatarUrl,
      bgUrl,
      fx: fxSelect.value,
    });
    avatarFileInput.value = "";
    bgFileInput.value = "";
    alert("已保存");
    closeSettings();
  } catch (e) {
    console.error(e);
    alert("保存失败，图片可能过大，请换用网络图片链接或压缩后再试");
  }
});

clearBgBtn.addEventListener("click", () => {
  bgUrlInput.value = "";
  bgFileInput.value = "";
});

/* ========== 特效系统（花瓣 / 雪花 / 雨） ========== */
const canvas = document.getElementById("fxCanvas");
const ctx = canvas.getContext("2d");
let fxMode = "none";
let particles = [];
let animId = null;
let w = 0;
let h = 0;

function resizeCanvas() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}

window.addEventListener("resize", () => {
  resizeCanvas();
  if (fxMode !== "none") spawnParticles(true);
});

function spawnParticles(reset) {
  if (reset) particles = [];
  const count =
    fxMode === "rain" ? Math.min(160, Math.floor(w / 6)) :
    fxMode === "snow" ? Math.min(90, Math.floor(w / 10)) :
    Math.min(50, Math.floor(w / 18));

  while (particles.length < count) {
    particles.push(createParticle());
  }
  particles.length = count;
}

function createParticle() {
  if (fxMode === "rain") {
    return {
      x: Math.random() * w,
      y: Math.random() * h - h,
      len: 12 + Math.random() * 18,
      speed: 8 + Math.random() * 10,
      opacity: 0.15 + Math.random() * 0.35,
      drift: -0.5 + Math.random() * 0.3,
    };
  }
  if (fxMode === "snow") {
    return {
      x: Math.random() * w,
      y: Math.random() * h - h,
      r: 1.2 + Math.random() * 3.2,
      speed: 0.6 + Math.random() * 1.8,
      opacity: 0.35 + Math.random() * 0.55,
      swing: Math.random() * Math.PI * 2,
      swingSpeed: 0.01 + Math.random() * 0.02,
    };
  }
  // petal
  return {
    x: Math.random() * w,
    y: Math.random() * h - h,
    size: 6 + Math.random() * 10,
    speed: 0.8 + Math.random() * 1.6,
    opacity: 0.45 + Math.random() * 0.45,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    swing: Math.random() * Math.PI * 2,
    swingSpeed: 0.008 + Math.random() * 0.015,
    color: Math.random() > 0.5 ? "255,182,193" : "255,160,180",
  };
}

function drawPetal(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = `rgba(${p.color},1)`;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size * 0.45, p.size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnow(p) {
  ctx.beginPath();
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = "#fff";
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawRain(p) {
  ctx.globalAlpha = p.opacity;
  ctx.strokeStyle = "rgba(180, 210, 255, 0.9)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + p.drift * 2, p.y + p.len);
  ctx.stroke();
}

function tick() {
  if (fxMode === "none") {
    ctx.clearRect(0, 0, w, h);
    animId = null;
    return;
  }

  ctx.clearRect(0, 0, w, h);

  for (const p of particles) {
    if (fxMode === "rain") {
      p.y += p.speed;
      p.x += p.drift;
      if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      }
      drawRain(p);
    } else if (fxMode === "snow") {
      p.swing += p.swingSpeed;
      p.y += p.speed;
      p.x += Math.sin(p.swing) * 0.6;
      if (p.y > h + 10) {
        p.y = -10;
        p.x = Math.random() * w;
      }
      drawSnow(p);
    } else {
      p.swing += p.swingSpeed;
      p.rot += p.rotSpeed;
      p.y += p.speed;
      p.x += Math.sin(p.swing) * 0.9;
      if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      }
      drawPetal(p);
    }
  }

  ctx.globalAlpha = 1;
  animId = requestAnimationFrame(tick);
}

function setFxMode(mode, persist) {
  fxMode = mode || "none";

  // 更新底部按钮状态
  fxBar.querySelectorAll(".fx-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.fx === fxMode);
  });
  fxSelect.value = fxMode;

  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  ctx.clearRect(0, 0, w, h);
  particles = [];

  if (fxMode !== "none") {
    resizeCanvas();
    spawnParticles(true);
    animId = requestAnimationFrame(tick);
  }

  if (persist) {
    const data = getStored();
    data.fx = fxMode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

fxBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".fx-btn");
  if (!btn) return;
  setFxMode(btn.dataset.fx, true);
});

/* ========== 视频 → MP3 ========== */
const openConverter = document.getElementById("openConverter");
const converterModal = document.getElementById("converterModal");
const converterMask = document.getElementById("converterMask");
const closeConverter = document.getElementById("closeConverter");
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const uploadContent = document.getElementById("uploadContent");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const clearBtn = document.getElementById("clearBtn");
const convertBtn = document.getElementById("convertBtn");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const result = document.getElementById("result");
const downloadLink = document.getElementById("downloadLink");

/** 约 5 分钟高码率视频的安全上限（浏览器内存限制） */
const MAX_FILE_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_DURATION_SEC = 5 * 60 + 15; // 5 分钟，略放宽 15 秒
const VIDEO_EXT_RE =
  /\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|3gp|ts|mts|m2ts|mpeg|mpg|mpe|ogv|vob|asf|rm|rmvb|f4v|divx|xvid|mp3|m4a|aac|wav|ogg|flac|wma)$/i;

let selectedFile = null;
let ffmpeg = null;
let ffmpegLoaded = false;
let lastBlobUrl = null;

openConverter.addEventListener("click", () => {
  converterModal.hidden = false;
});

function closeConv() {
  converterModal.hidden = true;
}

closeConverter.addEventListener("click", closeConv);
converterMask.addEventListener("click", closeConv);

uploadArea.addEventListener("click", (e) => {
  if (e.target === clearBtn || clearBtn.contains(e.target)) return;
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

function isMediaFile(file) {
  if (!file) return false;
  if (file.type && (file.type.startsWith("video/") || file.type.startsWith("audio/"))) {
    return true;
  }
  return VIDEO_EXT_RE.test(file.name || "");
}

/** 用浏览器探测时长（无法探测时返回 null，不拦截） */
function probeDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    const done = (sec) => {
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
      el.load();
      resolve(sec);
    };
    el.onloadedmetadata = () => {
      const d = el.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    el.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    el.src = url;
  });
}

async function handleFile(file) {
  if (!isMediaFile(file)) {
    alert("请选择视频或音频文件\n支持：MP4 / MOV / MKV / WebM / AVI / FLV / 3GP 等");
    return;
  }

  if (file.size > MAX_FILE_BYTES) {
    alert(
      "文件过大（" +
        formatSize(file.size) +
        "），建议不超过 150MB。\n过大会导致手机/浏览器内存不足而失败。"
    );
    return;
  }

  progressWrap.hidden = false;
  progressText.textContent = "正在检测文件…";
  progressFill.style.width = "5%";
  convertBtn.disabled = true;

  const duration = await probeDuration(file);
  if (duration != null && duration > MAX_DURATION_SEC) {
    progressWrap.hidden = true;
    convertBtn.disabled = true;
    alert(
      "视频时长约 " +
        Math.round(duration) +
        " 秒，超过 5 分钟限制。\n请裁剪后再转换。"
    );
    return;
  }

  selectedFile = file;
  let label = file.name + "（" + formatSize(file.size) + "）";
  if (duration != null) {
    label += " · " + formatDuration(duration);
  }
  fileName.textContent = label;
  uploadContent.hidden = true;
  fileInfo.hidden = false;
  convertBtn.disabled = false;
  result.hidden = true;
  progressWrap.hidden = true;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + String(s).padStart(2, "0");
}

clearBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  selectedFile = null;
  fileInput.value = "";
  uploadContent.hidden = false;
  fileInfo.hidden = true;
  convertBtn.disabled = true;
  result.hidden = true;
  progressWrap.hidden = true;
  revokeLastBlob();
});

function revokeLastBlob() {
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** 核心文件镜像（国内优先 npmmirror） */
const CORE_MIRRORS = [
  "https://registry.npmmirror.com/@ffmpeg/core/0.12.6/files/dist/esm",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
  "https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
];

/** 带进度与超时的下载 → Blob URL（wasm 约 25MB） */
async function fetchToBlobURL(url, mimeType, onProgress, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, mode: "cors" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const total = Number(res.headers.get("content-length")) || 0;
    if (!res.body || !res.body.getReader) {
      const blob = await res.blob();
      return URL.createObjectURL(new Blob([blob], { type: mimeType }));
    }
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      if (onProgress) {
        onProgress(total > 0 ? loaded / total : Math.min(0.95, loaded / (25 * 1024 * 1024)));
      }
    }
    return URL.createObjectURL(new Blob(chunks, { type: mimeType }));
  } finally {
    clearTimeout(timer);
  }
}

async function loadCoreFromMirrors() {
  let lastErr = null;
  for (let i = 0; i < CORE_MIRRORS.length; i++) {
    const base = CORE_MIRRORS[i];
    const label = i + 1 + "/" + CORE_MIRRORS.length;
    try {
      progressText.textContent = "下载引擎脚本（源 " + label + "）…";
      progressFill.style.width = "6%";
      const coreURL = await fetchToBlobURL(
        base + "/ffmpeg-core.js",
        "text/javascript",
        (p) => {
          progressFill.style.width = 6 + Math.round(p * 8) + "%";
        },
        60000
      );

      progressText.textContent = "下载引擎核心（约25MB，源 " + label + "）…";
      const wasmURL = await fetchToBlobURL(
        base + "/ffmpeg-core.wasm",
        "application/wasm",
        (p) => {
          const pct = 14 + Math.round(p * 50);
          progressFill.style.width = pct + "%";
          progressText.textContent =
            "下载引擎核心 " + Math.round(p * 100) + "%（源 " + label + "）…";
        },
        180000
      );

      return { coreURL, wasmURL };
    } catch (e) {
      console.warn("镜像失败:", base, e);
      lastErr = e;
      progressText.textContent = "源 " + label + " 失败，切换下一个…";
    }
  }
  throw lastErr || new Error("所有镜像均无法下载转换引擎，请检查网络");
}

async function loadFFmpeg() {
  if (ffmpegLoaded && ffmpeg) return;

  progressText.textContent = "正在初始化转换引擎…";
  progressFill.style.width = "3%";

  const workerURL = new URL("ffmpeg/worker.js", window.location.href).href;

  // 确认 worker 可访问
  try {
    const wg = await fetch(workerURL);
    if (!wg.ok) {
      throw new Error("无法加载 /ffmpeg/worker.js，请确认已上传 ffmpeg 文件夹后重新部署");
    }
  } catch (e) {
    if (String(e.message || e).includes("ffmpeg")) throw e;
    console.warn("worker 探测:", e);
  }

  // 先尝试「直连 CDN」（手机上往往比 blob 更稳），失败再下成本地 blob
  let coreURL = null;
  let wasmURL = null;
  let lastErr = null;

  for (let i = 0; i < CORE_MIRRORS.length; i++) {
    const base = CORE_MIRRORS[i];
    const label = i + 1 + "/" + CORE_MIRRORS.length;
    try {
      progressText.textContent = "检测引擎源 " + label + "…";
      progressFill.style.width = 5 + i * 3 + "%";
      // 小文件探测是否可达
      const probe = await fetch(base + "/ffmpeg-core.js", { method: "GET", mode: "cors" });
      if (!probe.ok) throw new Error("HTTP " + probe.status);
      // 直连 URL，不转 blob（避免部分手机 Worker 无法 import blob）
      coreURL = base + "/ffmpeg-core.js";
      wasmURL = base + "/ffmpeg-core.wasm";
      progressText.textContent = "使用引擎源 " + label + "（直连）";
      progressFill.style.width = "55%";
      lastErr = null;
      break;
    } catch (e) {
      console.warn("源不可用:", base, e);
      lastErr = e;
    }
  }

  // 直连全失败：下载为 blob
  if (!coreURL) {
    progressText.textContent = "直连失败，改为下载到本地…";
    const loaded = await loadCoreFromMirrors();
    coreURL = loaded.coreURL;
    wasmURL = loaded.wasmURL;
  }

  progressText.textContent = "正在启动引擎（手机可能需 30～90 秒）…";
  progressFill.style.width = "60%";

  ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({ message }) => {
    if (message && /error|invalid|fail/i.test(message)) {
      console.warn("[ffmpeg]", message);
    }
  });
  ffmpeg.on("progress", ({ progress }) => {
    let pct = 78;
    if (Number.isFinite(progress) && progress > 0) {
      pct = Math.min(94, Math.round(78 + progress * 16));
    }
    progressFill.style.width = pct + "%";
    progressText.textContent = "转换中… " + pct + "%";
  });

  // 心跳：让用户知道没有卡死
  let elapsed = 0;
  const heartbeat = setInterval(() => {
    elapsed += 1;
    if (!ffmpegLoaded) {
      progressText.textContent =
        "正在启动引擎… 已等待 " + elapsed + " 秒（手机首次较慢，请勿关闭）";
      const w = Math.min(76, 60 + Math.floor(elapsed / 5));
      progressFill.style.width = w + "%";
    }
  }, 1000);

  try {
    const loadPromise = ffmpeg.load({
      coreURL,
      wasmURL,
      classWorkerURL: workerURL,
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "引擎启动超时（超过 3 分钟）。请刷新后重试，关闭 VPN，或换 Chrome/系统浏览器。"
            )
          ),
        180000
      );
    });

    await Promise.race([loadPromise, timeoutPromise]);
  } finally {
    clearInterval(heartbeat);
  }

  ffmpegLoaded = true;
  progressFill.style.width = "78%";
  progressText.textContent = "引擎已就绪，写入文件…";
}

function getExt(name) {
  const m = (name || "").match(/\.[a-z0-9]+$/i);
  return m ? m[0].toLowerCase() : ".mp4";
}

/** 清理虚拟文件系统，释放内存 */
async function cleanupFs(names) {
  if (!ffmpeg) return;
  for (const n of names) {
    try {
      await ffmpeg.deleteFile(n);
    } catch (_) {}
  }
}

/** 执行转换：优先取音轨，兼容无音轨失败与多格式容器 */
async function runConvert(inputName, outputName) {
  // 方案 A：标准提取第一路音频 → MP3
  try {
    await ffmpeg.exec([
      "-hide_banner",
      "-i", inputName,
      "-vn",
      "-map", "0:a:0",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-ar", "44100",
      "-ac", "2",
      "-y",
      outputName,
    ]);
    return;
  } catch (e1) {
    console.warn("方案A失败，尝试方案B", e1);
  }

  // 方案 B：不指定 map（部分容器音轨编号异常）
  try {
    await ffmpeg.exec([
      "-hide_banner",
      "-i", inputName,
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      "-ar", "44100",
      "-ac", "2",
      "-y",
      outputName,
    ]);
    return;
  } catch (e2) {
    console.warn("方案B失败，尝试方案C", e2);
  }

  // 方案 C：更低码率，减轻内存压力
  await ffmpeg.exec([
    "-hide_banner",
    "-i", inputName,
    "-vn",
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    "-y",
    outputName,
  ]);
}

convertBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  result.hidden = true;
  progressWrap.hidden = false;
  progressFill.style.width = "0%";
  progressText.textContent = "准备中…";
  revokeLastBlob();

  const inputName = "input" + getExt(selectedFile.name);
  const outputName = "output.mp3";

  try {
    await loadFFmpeg();

    progressText.textContent = "正在读取文件…";
    progressFill.style.width = "18%";

    // 分片读取大文件，降低峰值内存
    const data = new Uint8Array(await selectedFile.arrayBuffer());
    await ffmpeg.writeFile(inputName, data);

    progressText.textContent = "正在提取音频并编码 MP3…";
    progressFill.style.width = "22%";

    await runConvert(inputName, outputName);

    progressFill.style.width = "94%";
    progressText.textContent = "生成下载文件…";

    const outputData = await ffmpeg.readFile(outputName);
    // 注意：不要用 .buffer 整段 ArrayBuffer（可能含多余字节）
    const bytes =
      outputData instanceof Uint8Array
        ? outputData
        : new Uint8Array(outputData);
    if (!bytes.length) {
      throw new Error("输出为空，可能视频没有音轨");
    }

    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    lastBlobUrl = url;

    await cleanupFs([inputName, outputName]);

    const baseName = (selectedFile.name || "audio").replace(/\.[^.]+$/, "") || "audio";
    downloadLink.href = url;
    downloadLink.download = baseName + ".mp3";
    downloadLink.textContent = "下载 " + baseName + ".mp3";

    progressFill.style.width = "100%";
    progressText.textContent = "完成！";
    result.hidden = false;
  } catch (err) {
    console.error(err);
    await cleanupFs([inputName, outputName]);
    // 加载失败时允许下次重新初始化
    if (!ffmpegLoaded) {
      try { if (ffmpeg) ffmpeg.terminate(); } catch (_) {}
      ffmpeg = null;
    }
    const msg = String(err && err.message ? err.message : err);
    let tip = "转换失败。";
    if (/memory|out of memory|OOM|allocation|abort/i.test(msg)) {
      tip = "下载中断或内存不足，请换 WiFi 后重试，或用更小的文件。";
    } else if (/超时|timeout/i.test(msg)) {
      tip = "引擎启动超时，请刷新页面后重试，建议关闭 VPN 或换网络。";
    } else if (/no.*audio|does not contain|Invalid data|Stream map/i.test(msg)) {
      tip = "无法找到音轨，请确认视频里包含声音。";
    } else if (/Worker|classWorkerURL|Failed to construct|worker\.js/i.test(msg)) {
      tip = "转换引擎加载失败，请确认已上传 ffmpeg 文件夹后重新部署。";
    } else if (/所有镜像|HTTP|Failed to fetch|NetworkError/i.test(msg)) {
      tip = "引擎文件下载失败，请检查网络后重试（首次需下载约 25MB）。";
    }
    progressText.textContent = tip;
    alert(tip + "\n\n详情：" + msg.slice(0, 220));
  } finally {
    convertBtn.disabled = false;
  }
});

/* 启动 */
resizeCanvas();
loadProfile();
