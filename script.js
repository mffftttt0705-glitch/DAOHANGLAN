const PASSWORD = "@55ff";
const STORAGE_KEY = "nav_profile_v1";
const API_URL = "/api/profile"; // Cloudflare Pages Function

/* ========== 个人资料 DOM ========== */
const avatarImg = document.getElementById("avatarImg");
const displayName = document.getElementById("displayName");
const displayBio = document.getElementById("displayBio");
const customBg = document.getElementById("customBg");
const bgVideo = document.getElementById("bgVideo");
const bgBar = document.getElementById("bgBar");

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
const bgLabelInput = document.getElementById("bgLabelInput");
const bgTypeSelect = document.getElementById("bgTypeSelect");
const bgListEl = document.getElementById("bgList");
const addBgBtn = document.getElementById("addBgBtn");
const fxSelect = document.getElementById("fxSelect");
const saveBtn = document.getElementById("saveBtn");
const fxBar = document.getElementById("fxBar");

/* 默认透明占位头像 */
const DEFAULT_AVATAR =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="48" fill="%23ffffff10"/><circle cx="48" cy="40" r="16" fill="%23ffffff28"/><ellipse cx="48" cy="78" rx="26" ry="18" fill="%23ffffff22"/></svg>'
  );

/** 当前内存中的完整资料 */
let currentProfile = {
  name: "",
  bio: "",
  avatarUrl: "",
  backgrounds: [], // { id, type: 'image'|'video', url, label }
  currentBgId: null,
  fx: "none",
};

function uid() {
  return "bg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function isVideoUrl(url) {
  if (!url) return false;
  if (url.startsWith("data:video")) return true;
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

/* ========== 读取 / 应用资料 ========== */
async function loadProfile() {
  // 1. 优先从云端 KV 拉取
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && !data.error) {
        // 兼容旧单背景字段
        normalizeProfile(data);
        currentProfile = data;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        applyProfile(data);
        return;
      }
    }
  } catch (e) {
    console.warn("云端读取失败，使用本地缓存", e);
  }

  // 2. 回退到 localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      normalizeProfile(data);
      currentProfile = data;
      applyProfile(data);
      return;
    }
  } catch {}
  applyProfile({});
}

/** 把旧版 { bgUrl } 转成新版 backgrounds 数组 */
function normalizeProfile(data) {
  if (!Array.isArray(data.backgrounds)) {
    data.backgrounds = [];
  }
  if (data.bgUrl && data.backgrounds.length === 0) {
    const type = isVideoUrl(data.bgUrl) ? "video" : "image";
    const id = uid();
    data.backgrounds.push({
      id,
      type,
      url: data.bgUrl,
      label: type === "video" ? "视频背景" : "背景图",
    });
    data.currentBgId = id;
  }
  if (!data.currentBgId && data.backgrounds.length) {
    data.currentBgId = data.backgrounds[0].id;
  }
  delete data.bgUrl; // 废弃旧字段
}

function applyProfile(data) {
  const name = data.name || "未设置昵称";
  const bio = data.bio || "点击右下角设置进行个性化";
  displayName.textContent = name;
  displayBio.textContent = bio;
  nameInput.value = data.name || "";
  bioInput.value = data.bio || "";
  avatarUrlInput.value =
    data.avatarUrl && !String(data.avatarUrl).startsWith("data:")
      ? data.avatarUrl
      : "";
  fxSelect.value = data.fx || "none";

  avatarImg.src = data.avatarUrl || DEFAULT_AVATAR;
  avatarImg.onerror = () => {
    avatarImg.src = DEFAULT_AVATAR;
  };

  applyBackground(data);
  renderBgList();
  renderBgBar();
  setFxMode(data.fx || "none", false);
}

function applyBackground(data) {
  const list = data.backgrounds || [];
  const cur = list.find((b) => b.id === data.currentBgId) || list[0];

  // 清空
  customBg.style.backgroundImage = "";
  customBg.classList.remove("show");
  bgVideo.classList.remove("show");
  bgVideo.removeAttribute("src");
  bgVideo.load();

  if (!cur || !cur.url) return;

  if (cur.type === "video" || isVideoUrl(cur.url)) {
    bgVideo.src = cur.url;
    bgVideo.classList.add("show");
    bgVideo.play().catch(() => {});
  } else {
    customBg.style.backgroundImage = `url("${cur.url}")`;
    customBg.classList.add("show");
  }
}

async function saveProfile(data, { silent } = {}) {
  normalizeProfile(data);
  currentProfile = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  applyProfile(data);

  // 同步到 Cloudflare KV
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "HTTP " + res.status);
    }
    if (!silent) alert("已保存到云端，所有人刷新后可见");
  } catch (e) {
    console.error(e);
    if (!silent) {
      alert(
        "本地已保存，但云端同步失败：\n" +
          (e.message || e) +
          "\n请确认已正确绑定 KV 并重新部署"
      );
    }
  }
}

function getStored() {
  return { ...currentProfile };
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 1.2 * 1024 * 1024) {
      reject(new Error("图片超过 1.2MB，请压缩后再上传，或改用网络图片链接"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ========== 背景列表 UI ========== */
function renderBgList() {
  const list = currentProfile.backgrounds || [];
  bgListEl.innerHTML = "";
  if (!list.length) {
    bgListEl.innerHTML =
      '<p class="field-tip" style="margin:0">暂无背景，请下方添加</p>';
    return;
  }
  list.forEach((bg) => {
    const item = document.createElement("div");
    item.className = "bg-item" + (bg.id === currentProfile.currentBgId ? " active" : "");
    item.innerHTML = `
      <span class="bg-item-label">${escapeHtml(bg.label || "未命名")}</span>
      <span class="bg-item-type">${bg.type === "video" ? "视频" : "图片"}</span>
      <div class="bg-item-actions">
        <button type="button" data-act="use" data-id="${bg.id}" title="设为当前">用</button>
        <button type="button" class="del" data-act="del" data-id="${bg.id}" title="删除">删</button>
      </div>
    `;
    bgListEl.appendChild(item);
  });
}

function renderBgBar() {
  const list = currentProfile.backgrounds || [];
  bgBar.innerHTML = "";
  if (list.length < 2) {
    bgBar.hidden = true;
    return;
  }
  bgBar.hidden = false;
  list.forEach((bg) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "bg-btn" + (bg.id === currentProfile.currentBgId ? " active" : "");
    btn.textContent = bg.label || (bg.type === "video" ? "视频" : "图");
    btn.title = bg.label || bg.url.slice(0, 40);
    btn.dataset.id = bg.id;
    bgBar.appendChild(btn);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

bgListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  if (act === "use") {
    currentProfile.currentBgId = id;
    applyBackground(currentProfile);
    renderBgList();
    renderBgBar();
  } else if (act === "del") {
    currentProfile.backgrounds = currentProfile.backgrounds.filter(
      (b) => b.id !== id
    );
    if (currentProfile.currentBgId === id) {
      currentProfile.currentBgId =
        currentProfile.backgrounds[0]?.id || null;
    }
    applyBackground(currentProfile);
    renderBgList();
    renderBgBar();
  }
});

bgBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".bg-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  if (id === currentProfile.currentBgId) return;
  currentProfile.currentBgId = id;
  applyBackground(currentProfile);
  renderBgBar();
  // 快速切换也同步到云端（静默）
  saveProfile({ ...currentProfile }, { silent: true });
});

addBgBtn.addEventListener("click", async () => {
  let url = bgUrlInput.value.trim();
  const type = bgTypeSelect.value;
  let label = bgLabelInput.value.trim();

  if (bgFileInput.files[0]) {
    if (type === "video") {
      alert("视频请使用网络链接，不支持本地文件转 base64（体积太大）");
      return;
    }
    try {
      url = await fileToDataURL(bgFileInput.files[0]);
    } catch (e) {
      alert(e.message || "图片读取失败");
      return;
    }
  }

  if (!url) {
    alert("请填写图片/视频链接，或选择本地图片");
    return;
  }

  if (type === "video" && !isVideoUrl(url) && !url.includes("video")) {
    // 允许，但提示
    if (!confirm("链接看起来不像视频文件，仍要添加为视频背景吗？")) return;
  }

  if (!label) {
    label = type === "video" ? "视频" + (currentProfile.backgrounds.length + 1) : "图" + (currentProfile.backgrounds.length + 1);
  }

  const id = uid();
  currentProfile.backgrounds.push({ id, type, url, label });
  currentProfile.currentBgId = id;

  bgUrlInput.value = "";
  bgLabelInput.value = "";
  bgFileInput.value = "";
  applyBackground(currentProfile);
  renderBgList();
  renderBgBar();
});

/* ========== 设置面板 ========== */
settingsBtn.addEventListener("click", () => {
  pwdInput.value = "";
  settingsForm.hidden = true;
  settingsModal.hidden = false;
  pwdInput.focus();
  renderBgList();
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
  const prev = getStored();

  if (avatarFileInput.files[0]) {
    try {
      avatarUrl = await fileToDataURL(avatarFileInput.files[0]);
    } catch (e) {
      alert(e.message || "头像读取失败");
      return;
    }
  } else if (!avatarUrl && prev.avatarUrl) {
    avatarUrl = prev.avatarUrl;
  }

  try {
    await saveProfile({
      name: nameInput.value.trim(),
      bio: bioInput.value.trim(),
      avatarUrl,
      backgrounds: currentProfile.backgrounds || [],
      currentBgId: currentProfile.currentBgId,
      fx: fxSelect.value,
    });
    avatarFileInput.value = "";
    closeSettings();
  } catch (e) {
    console.error(e);
    alert("保存失败：" + (e.message || e));
  }
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
    fxMode === "rain"
      ? Math.min(160, Math.floor(w / 6))
      : fxMode === "snow"
        ? Math.min(90, Math.floor(w / 10))
        : Math.min(50, Math.floor(w / 18));

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
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${p.opacity})`;
  ctx.fill();
}

function drawRain(p) {
  ctx.strokeStyle = `rgba(180,210,255,${p.opacity})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + p.drift * 3, p.y + p.len);
  ctx.stroke();
}

function tick() {
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
      p.y += p.speed;
      p.swing += p.swingSpeed;
      p.x += Math.sin(p.swing) * 0.6;
      if (p.y > h + 10) {
        p.y = -10;
        p.x = Math.random() * w;
      }
      drawSnow(p);
    } else {
      p.y += p.speed;
      p.rot += p.rotSpeed;
      p.swing += p.swingSpeed;
      p.x += Math.sin(p.swing) * 0.8;
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
    currentProfile.fx = fxMode;
    saveProfile({ ...currentProfile }, { silent: true });
  }
}

fxBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".fx-btn");
  if (!btn) return;
  setFxMode(btn.dataset.fx, true);
});

/* ========== 视频 → MP3（浏览器原生解码 + lamejs，不依赖 ffmpeg） ========== */
const openConverter = document.getElementById("openConverter");
const converterModal = document.getElementById("converterModal");
const converterMask = document.getElementById("converterMask");
const closeConverterBtn = document.getElementById("closeConverter");
const fileInput = document.getElementById("fileInput");
const uploadArea = document.getElementById("uploadArea");
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

let selectedFile = null;
let lastBlobUrl = null;

function revokeLastBlob() {
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }
}

function formatSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function openConverterModal() {
  converterModal.hidden = false;
}

function closeConverterModal() {
  converterModal.hidden = true;
}

openConverter.addEventListener("click", openConverterModal);
closeConverterBtn.addEventListener("click", closeConverterModal);
converterMask.addEventListener("click", closeConverterModal);

uploadArea.addEventListener("click", () => fileInput.click());
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});
uploadArea.addEventListener("dragleave", () =>
  uploadArea.classList.remove("dragover")
);
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  selectedFile = file;
  fileName.textContent = file.name + "（" + formatSize(file.size) + "）";
  uploadContent.hidden = true;
  fileInfo.hidden = false;
  convertBtn.disabled = false;
  result.hidden = true;
  progressWrap.hidden = true;
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

async function convertWithWebAudio(file, onProgress) {
  onProgress(5, "解码中…");
  const arrayBuf = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuf;
  try {
    audioBuf = await audioCtx.decodeAudioData(arrayBuf.slice(0));
  } catch (e) {
    await audioCtx.close();
    throw new Error("无法解码该视频/音频");
  }

  const channels = audioBuf.numberOfChannels;
  const sampleRate = audioBuf.sampleRate;
  const length = audioBuf.length;
  const left = audioBuf.getChannelData(0);
  const right = channels > 1 ? audioBuf.getChannelData(1) : left;

  onProgress(25, "编码 MP3…");

  // 动态加载 lamejs
  if (!window.lamejs) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("lamejs 加载失败"));
      document.head.appendChild(s);
    });
  }

  const mp3encoder = new lamejs.Mp3Encoder(2, sampleRate, 128);
  const sampleBlockSize = 1152;
  const mp3Data = [];

  for (let i = 0; i < length; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize);
    const rightChunk = right.subarray(i, i + sampleBlockSize);
    const leftInt = new Int16Array(leftChunk.length);
    const rightInt = new Int16Array(rightChunk.length);
    for (let j = 0; j < leftChunk.length; j++) {
      leftInt[j] = Math.max(-32768, Math.min(32767, leftChunk[j] * 32768));
      rightInt[j] = Math.max(-32768, Math.min(32767, rightChunk[j] * 32768));
    }
    const mp3buf = mp3encoder.encodeBuffer(leftInt, rightInt);
    if (mp3buf.length) mp3Data.push(mp3buf);
    if (i % (sampleBlockSize * 40) === 0) {
      onProgress(
        25 + Math.min(70, Math.round((i / length) * 70)),
        "编码中 " + Math.round((i / length) * 100) + "%"
      );
    }
  }
  const end = mp3encoder.flush();
  if (end.length) mp3Data.push(end);
  await audioCtx.close();

  const blob = new Blob(mp3Data, { type: "audio/mpeg" });
  if (blob.size < 100) throw new Error("输出文件为空");
  return blob;
}

async function convertWithMediaRecorder(file, onProgress) {
  onProgress(5, "备用方案：播放并录制…");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = false;
  video.playsInline = true;
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("无法加载视频"));
  });

  const stream = video.captureStream
    ? video.captureStream()
    : video.mozCaptureStream
      ? video.mozCaptureStream()
      : null;
  if (!stream) {
    URL.revokeObjectURL(url);
    throw new Error("浏览器不支持 captureStream");
  }

  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    URL.revokeObjectURL(url);
    throw new Error("无音轨");
  }
  const audioStream = new MediaStream(audioTracks);

  const mime =
    MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

  const chunks = [];
  const recorder = new MediaRecorder(audioStream, {
    mimeType: mime,
    audioBitsPerSecond: 128000,
  });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start(200);

  const duration = video.duration || 30;
  await new Promise((resolve) => {
    video.onended = resolve;
    setTimeout(resolve, (duration + 1) * 1000);
    const tick = () => {
      if (video.ended) return;
      const p = video.currentTime / duration;
      onProgress(
        10 + Math.min(80, Math.round(p * 80)),
        "提取中 " + Math.round(p * 100) + "%"
      );
      requestAnimationFrame(tick);
    };
    tick();
  });

  if (recorder.state !== "inactive") recorder.stop();
  await stopped;
  video.pause();
  URL.revokeObjectURL(url);

  const ext = mime.includes("mp4") || mime.includes("mpeg") ? "m4a" : "webm";
  const blob = new Blob(chunks, { type: mime });
  return { blob, ext };
}

convertBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  result.hidden = true;
  progressWrap.hidden = false;
  progressFill.style.width = "0%";
  progressText.textContent = "准备中…";
  revokeLastBlob();

  const onProgress = (pct, text) => {
    progressFill.style.width = Math.min(99, pct) + "%";
    progressText.textContent = text;
  };

  try {
    let blob;
    let ext = "mp3";
    try {
      blob = await convertWithWebAudio(selectedFile, onProgress);
    } catch (e1) {
      console.warn("主方案失败，尝试备用:", e1);
      onProgress(5, "主方案失败，尝试备用方案…");
      const alt = await convertWithMediaRecorder(selectedFile, onProgress);
      blob = alt.blob;
      ext = alt.ext;
    }

    if (!blob || blob.size < 100) {
      throw new Error("输出文件为空");
    }

    const url = URL.createObjectURL(blob);
    lastBlobUrl = url;
    const baseName =
      (selectedFile.name || "audio").replace(/\.[^.]+$/, "") || "audio";
    downloadLink.href = url;
    downloadLink.download = baseName + "." + ext;
    downloadLink.textContent =
      "下载 " + baseName + "." + ext + "（" + formatSize(blob.size) + "）";

    progressFill.style.width = "100%";
    progressText.textContent =
      ext === "mp3" ? "完成！" : "完成（备用格式 " + ext + "）";
    result.hidden = false;
  } catch (err) {
    console.error(err);
    const msg = String(err && err.message ? err.message : err);
    let tip = "转换失败：" + msg;
    if (/decode|无法解码|不支持/i.test(msg)) {
      tip =
        "无法解码该视频。请导出为手机常见的 MP4（H.264 + AAC）后再试。";
    } else if (/音轨|无声音|采集|静音/i.test(msg)) {
      tip = "未能提取到声音，请确认视频有音轨，并允许网站播放声音。";
    }
    progressText.textContent = tip;
    alert(tip);
  } finally {
    convertBtn.disabled = false;
  }
});

/* 启动 */
resizeCanvas();
loadProfile();
