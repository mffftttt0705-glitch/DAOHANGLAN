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
  try {
    bgVideo.load();
  } catch (_) {}

  if (!cur || !cur.url) return;

  if (cur.type === "video" || isVideoUrl(cur.url)) {
    bgVideo.src = cur.url;
    bgVideo.classList.add("show");
    bgVideo.play().catch(() => {});
  } else {
    // JSON.stringify 正确转义 dataURL / 特殊字符，避免 CSS url() 解析失败
    customBg.style.backgroundImage = "url(" + JSON.stringify(cur.url) + ")";
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
    if (!silent) void uiAlert("已保存到云端，所有人刷新后可见");
  } catch (e) {
    console.error(e);
    if (!silent) {
      void uiAlert(
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

/* ========== 自定义弹窗（替代 alert/confirm/prompt） ========== */
function showUiDialog({ title = "提示", message = "", input = false, inputValue = "", showCancel = false, okText = "确定", cancelText = "取消" } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("uiDialog");
    const titleEl = document.getElementById("uiDialogTitle");
    const msgEl = document.getElementById("uiDialogMessage");
    const inputEl = document.getElementById("uiDialogInput");
    const okBtn = document.getElementById("uiDialogOk");
    const cancelBtn = document.getElementById("uiDialogCancel");
    const mask = document.getElementById("uiDialogMask");

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;
    cancelBtn.hidden = !showCancel;

    if (input) {
      inputEl.hidden = false;
      inputEl.value = inputValue || "";
      inputEl.placeholder = message || "";
    } else {
      inputEl.hidden = true;
      inputEl.value = "";
    }

    modal.hidden = false;

    const cleanup = (result) => {
      modal.hidden = true;
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      mask.onclick = null;
      resolve(result);
    };

    okBtn.onclick = () => cleanup(input ? inputEl.value : true);
    cancelBtn.onclick = () => cleanup(input ? null : false);
    mask.onclick = () => cleanup(input ? null : false);
    if (input) {
      setTimeout(() => inputEl.focus(), 50);
      inputEl.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          cleanup(inputEl.value);
        }
      };
    }
  });
}

function uiAlert(message, title = "提示") {
  return showUiDialog({ title, message, showCancel: false });
}

function uiConfirm(message, title = "确认") {
  return showUiDialog({ title, message, showCancel: true, okText: "确定", cancelText: "取消" });
}

function uiPrompt(message, defaultValue = "", title = "输入") {
  return showUiDialog({ title, message, input: true, inputValue: defaultValue, showCancel: true, okText: "确定", cancelText: "取消" });
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
      void uiAlert("视频请使用网络链接，不支持本地文件转 base64（体积太大）");
      return;
    }
    try {
      url = await fileToDataURL(bgFileInput.files[0]);
    } catch (e) {
      void uiAlert(e.message || "图片读取失败");
      return;
    }
  }

  if (!url) {
    void uiAlert("请填写图片/视频链接，或选择本地图片");
    return;
  }

  if (type === "video" && !isVideoUrl(url) && !url.includes("video")) {
    const ok = await uiConfirm("链接看起来不像视频文件，仍要添加为视频背景吗？");
    if (!ok) return;
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
    void uiAlert("密码错误");
    return;
  }

  let avatarUrl = avatarUrlInput.value.trim();
  const prev = getStored();

  if (avatarFileInput.files[0]) {
    try {
      avatarUrl = await fileToDataURL(avatarFileInput.files[0]);
    } catch (e) {
      void uiAlert(e.message || "头像读取失败");
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
    void uiAlert("保存失败：" + (e.message || e));
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
    void uiAlert(tip);
  } finally {
    convertBtn.disabled = false;
  }
});

/* ========== AI 对话（多模型） ========== */
const THINK_SYSTEM =
  "你是智能助手，请使用中文。复杂问题时先在 <think> 与 </think> 标签内写出简要思考过程，再给出最终回答；简单问候可直接回答。";

const AI_PROVIDERS = {
  agnes: {
    name: "Agnes AI",
    navDesc: "免费对话 / 生视频",
    base: "https://apihub.agnes-ai.com/v1",
    model: "agnes-2.0-flash",
    models: [
      { id: "agnes-2.0-flash", label: "Agnes 2.0 Flash", tag: "免费", free: true },
      { id: "agnes-video-2.5-flash", label: "Agnes Video 2.5 Flash", tag: "免费·视频", free: true, video: true },
    ],
    tip: 'Key 在 <a href="https://platform.agnes-ai.com" target="_blank" rel="noopener">Agnes 平台</a> 免费注册。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: true,
    imageModel: "agnes-image-2.0-flash",
    videoGen: true,
    videoModel: "agnes-video-2.5-flash",
  },
  deepseek: {
    name: "DeepSeek",
    navDesc: "深度求索 · 写代码强",
    base: "https://api.deepseek.com",
    model: "deepseek-chat",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)", tag: "免费额度·推荐", free: true },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)", tag: "免费额度·推理", free: true },
    ],
    tip: 'Key 在 <a href="https://platform.deepseek.com" target="_blank" rel="noopener">DeepSeek</a> 创建，注册送额度，写代码推荐。',
    system: THINK_SYSTEM,
    vision: false,
    imageGen: false,
    videoGen: false,
  },
  qwen: {
    name: "通义千问",
    navDesc: "阿里百炼",
    base: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    models: [
      { id: "qwen-plus", label: "Qwen Plus", tag: "有免费额度", free: true },
      { id: "qwen-turbo", label: "Qwen Turbo", tag: "有免费额度", free: true },
      { id: "qwen-max", label: "Qwen Max", tag: "付费更强", free: false },
      { id: "qwen-long", label: "Qwen Long", tag: "长上下文", free: true },
      { id: "qwen-vl-plus", label: "Qwen VL Plus（识图）", tag: "识图·有免费额度", free: true },
      { id: "qwen2.5-vl-72b-instruct", label: "Qwen2.5-VL 72B", tag: "识图·强", free: false },
      { id: "qwen-coder-plus", label: "Qwen Coder Plus", tag: "写代码", free: true },
    ],
    tip: 'Key 在 <a href="https://bailian.console.aliyun.com" target="_blank" rel="noopener">阿里云百炼</a> 创建。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: true,
    imageModel: "wanx-v1",
    videoGen: false,
  },
  zhipu: {
    name: "智谱 GLM",
    navDesc: "智谱清言",
    base: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.6v-flash",
    models: [
      { id: "glm-4.6v-flash", label: "GLM-4.6V Flash（识图）", tag: "免费·识图推荐", free: true },
      { id: "glm-4.5-flash", label: "GLM-4.5 Flash", tag: "免费", free: true },
      { id: "glm-4.7-flash", label: "GLM-4.7 Flash", tag: "免费", free: true },
      { id: "glm-4-flash", label: "GLM-4 Flash", tag: "旧免费档", free: true },
      { id: "glm-5.3-flash", label: "GLM-5.3 Flash", tag: "付费·写代码强·识图", free: false },
      { id: "glm-5v-turbo", label: "GLM-5V Turbo", tag: "付费·视觉编程", free: false },
      { id: "glm-5.3", label: "GLM-5.3", tag: "付费·旗舰编程", free: false },
      { id: "glm-4-air", label: "GLM-4 Air", tag: "不建议", deprecated: true },
      { id: "glm-4-plus", label: "GLM-4 Plus", tag: "不建议·旧", deprecated: true },
      { id: "glm-4-long", label: "GLM-4 Long", tag: "不建议·旧", deprecated: true },
    ],
    tip: 'Key 在 <a href="https://open.bigmodel.cn" target="_blank" rel="noopener">智谱开放平台</a>。免费优先 glm-4.6v-flash；额度不足请换 DeepSeek。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: true,
    imageModel: "cogview-3-flash",
    videoGen: false,
  },
  kimi: {
    name: "Kimi",
    navDesc: "月之暗面",
    base: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-128k",
    models: [
      { id: "moonshot-v1-8k", label: "Kimi 8K", tag: "有免费额度", free: true },
      { id: "moonshot-v1-32k", label: "Kimi 32K", tag: "有免费额度", free: true },
      { id: "moonshot-v1-128k", label: "Kimi 128K", tag: "长上下文", free: true },
      { id: "kimi-latest", label: "Kimi Latest", tag: "最新", free: false },
    ],
    tip: 'Key 在 <a href="https://platform.moonshot.cn" target="_blank" rel="noopener">Moonshot 开放平台</a> 创建。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: false,
    videoGen: false,
  },
  gemini: {
    name: "Google Gemini",
    navDesc: "谷歌 Gemini",
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.8-flash",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", tag: "免费·推荐", free: true },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", tag: "免费", free: true },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", tag: "免费", free: true },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", tag: "可能限流", free: true },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", tag: "免费", free: true },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tag: "停用·新用户不可用", deprecated: true },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tag: "停用·新用户不可用", deprecated: true },
    ],
    tip: 'Key 在 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>。新账号务必选 3.8 Flash。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: false,
    videoGen: false,
  },
  doubao: {
    name: "豆包 / 火山方舟",
    navDesc: "字节豆包",
    base: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-1-5-lite-32k-250115",
    models: [
      { id: "doubao-1-5-lite-32k-250115", label: "Doubao 1.5 Lite", tag: "常用·需开通", free: false },
      { id: "doubao-1-5-pro-32k-250115", label: "Doubao 1.5 Pro", tag: "需开通", free: false },
      { id: "doubao-seed-1-6-251015", label: "Doubao Seed 1.6", tag: "需开通接入点", free: false },
      { id: "doubao-seed-1-6-250615", label: "Doubao Seed 1.6 (250615)", tag: "停用·即将下线", deprecated: true },
      { id: "doubao-seed-2-0-lite-260428", label: "Doubao Seed 2.0 Lite", tag: "需开通", free: false },
    ],
    tip: '火山方舟 Key：在控制台<strong>先开通模型并创建推理接入点</strong>，模型 ID 填接入点 ID（以 ep- 开头）或已开通的模型名。详见 <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener">火山方舟</a>。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: false,
    videoGen: false,
  },
  sensenova: {
    name: "商汤日日新",
    navDesc: "SenseNova",
    base: "https://token.sensenova.cn/v1",
    model: "sensenova-6.8-flash-lite",
    models: [
      { id: "sensenova-6.8-flash-lite", label: "SenseNova 6.8 Flash Lite", tag: "有额度", free: true },
      { id: "SenseChat-5", label: "SenseChat-5", tag: "视账号权限", free: false },
    ],
    tip: 'Key 在 <a href="https://platform.sensenova.cn" target="_blank" rel="noopener">商汤日日新</a> 创建。',
    system: THINK_SYSTEM,
    vision: false,
    imageGen: false,
    videoGen: false,
  },
  openai: {
    name: "OpenAI / ChatGPT",
    navDesc: "GPT 系列",
    base: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", tag: "付费", free: false },
      { id: "gpt-4o", label: "GPT-4o", tag: "付费·识图", free: false },
      { id: "gpt-4.1", label: "GPT-4.1", tag: "付费", free: false },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", tag: "付费", free: false },
      { id: "o3-mini", label: "o3-mini", tag: "付费·推理", free: false },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", tag: "不建议·旧", deprecated: true },
    ],
    tip: "官方 OpenAI Key（付费）。国内需可访问的网络或兼容中转。",
    system: THINK_SYSTEM,
    vision: true,
    imageGen: true,
    imageModel: "dall-e-3",
    videoGen: false,
  },
  grok: {
    name: "Grok (xAI)",
    navDesc: "xAI Grok",
    base: "https://api.x.ai/v1",
    model: "grok-3-mini",
    models: [
      { id: "grok-3-mini", label: "Grok 3 Mini", tag: "付费", free: false },
      { id: "grok-3", label: "Grok 3", tag: "付费", free: false },
      { id: "grok-2-vision-1212", label: "Grok 2 Vision", tag: "识图", free: false },
      { id: "grok-2", label: "Grok 2", tag: "不建议·旧", deprecated: true },
    ],
    tip: 'Key 在 <a href="https://console.x.ai" target="_blank" rel="noopener">xAI Console</a> 创建。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: false,
    videoGen: false,
  },
  claude: {
    name: "Claude (Anthropic)",
    navDesc: "Anthropic Claude",
    base: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-20250514",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", tag: "付费·写代码强", free: false },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", tag: "付费", free: false },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", tag: "付费·快", free: false },
      { id: "claude-3-opus-latest", label: "Claude 3 Opus", tag: "不建议·旧", deprecated: true },
    ],
    tip: '官方 Claude 接口与 OpenAI 不完全兼容，建议用兼容中转 Base。Key：<a href="https://console.anthropic.com" target="_blank" rel="noopener">Anthropic</a>。',
    system: THINK_SYSTEM,
    vision: true,
    imageGen: false,
    videoGen: false,
    openaiCompat: true,
  },
};


const CHAT_MODEL_KEY = "ai_chat_model_v1"; // providerId -> modelId

const CHAT_PROVIDER_KEY = "ai_chat_provider";
const CHAT_KEYS_STORAGE = "ai_chat_keys_v1";
const CHAT_SESSIONS_KEY = "ai_chat_sessions_v1";

const chatModal = document.getElementById("chatModal");
const chatMask = document.getElementById("chatMask");
const closeChatBtn = document.getElementById("closeChat");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const chatApiKeyInput = document.getElementById("chatApiKey");
const saveChatKeyBtn = document.getElementById("saveChatKey");
const chatModelSelect = document.getElementById("chatModelSelect"); // hidden input
const chatModelLabel = document.getElementById("chatModelLabel");
const openModelPickerBtn = document.getElementById("openModelPicker");
const modelPickerModal = document.getElementById("modelPickerModal");
const modelPickerMask = document.getElementById("modelPickerMask");
const closeModelPickerBtn = document.getElementById("closeModelPicker");
const modelPickerList = document.getElementById("modelPickerList");
const modelPickerProviderName = document.getElementById("modelPickerProviderName");
const chatKeyTip = document.getElementById("chatKeyTip");
const chatMenuBtn = document.getElementById("chatMenuBtn");
const chatDrawer = document.getElementById("chatDrawer");
const chatDrawerMask = document.getElementById("chatDrawerMask");
const chatSettings = document.getElementById("chatSettings");
const newChatBtn = document.getElementById("newChatBtn");
const toggleSettingsBtn = document.getElementById("toggleSettingsBtn");
const chatHistoryList = document.getElementById("chatHistoryList");
const aiNavGrid = document.getElementById("aiNavGrid");

/** @type {{role: string, content: string}[]} */
let chatHistory = [];
let chatBusy = false;
let currentSessionId = null;
let thinkTimer = null;

const THINK_DIRS = [
  "分析问题要点…",
  "检索相关知识…",
  "组织回答结构…",
  "检查表述是否清晰…",
  "整理关键信息…",
];

function loadChatKeys() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEYS_STORAGE) || "{}");
  } catch {
    return {};
  }
}

function saveChatKeys(map) {
  localStorage.setItem(CHAT_KEYS_STORAGE, JSON.stringify(map));
}

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSessions(list) {
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(list));
}

function loadModelMap() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_MODEL_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveModelMap(map) {
  localStorage.setItem(CHAT_MODEL_KEY, JSON.stringify(map));
}

function getCurrentProviderId() {
  return (
    (chatModelSelect && chatModelSelect.value) ||
    localStorage.getItem(CHAT_PROVIDER_KEY) ||
    "sensenova"
  );
}

function getProvider() {
  const p = AI_PROVIDERS[getCurrentProviderId()] || AI_PROVIDERS.sensenova;
  return p;
}

function getSelectedModelId() {
  const pid = getCurrentProviderId();
  const p = getProvider();
  const map = loadModelMap();
  let saved = map[pid];
  // Gemini：旧 ID 或本地仍记着 2.5 默认时，新用户改为 3.8 Flash
  if (pid === "gemini") {
    const allowed = (p.models || []).map((m) => m.id);
    if (!saved || !allowed.includes(saved) || /^gemini-2\.5-/.test(saved)) {
      // 不强制覆盖用户明确选的 2.5（老用户可能可用）；仅在 ID 无效时迁移
      if (!saved || !allowed.includes(saved)) {
        saved = "gemini-3.8-flash";
        map.gemini = saved;
        saveModelMap(map);
      }
    }
  }
  if (saved && (p.models || []).some((m) => m.id === saved && !m.deprecated)) return saved;
  const prefer = (p.models || []).find((m) => !m.deprecated) || (p.models || [])[0];
  return (prefer && prefer.id) || p.model;
}

function setSelectedModelId(modelId) {
  const pid = getCurrentProviderId();
  const map = loadModelMap();
  map[pid] = modelId;
  saveModelMap(map);
  const p = getProvider();
  p.model = modelId;
}

function getChatApiKey() {
  const map = loadChatKeys();
  return (map[getCurrentProviderId()] || "").trim();
}

function currentModelLabel() {
  const p = getProvider();
  const mid = getSelectedModelId();
  const found = (p.models || []).find((m) => m.id === mid);
  return found ? found.label : mid || p.name;
}

function applyProviderUI() {
  const id = getCurrentProviderId();
  localStorage.setItem(CHAT_PROVIDER_KEY, id);
  if (chatModelSelect) chatModelSelect.value = id;
  const p = getProvider();
  // 同步当前选中的具体模型到 provider.model（请求时用）
  p.model = getSelectedModelId();
  if (chatModelLabel) chatModelLabel.textContent = currentModelLabel();
  chatApiKeyInput.value = getChatApiKey();
  chatApiKeyInput.placeholder = "粘贴 " + p.name + " 的 API Key";
  chatKeyTip.innerHTML = p.tip + " Key 只存在本机。";
  const genImg = document.getElementById("chatGenImage");
  const genVid = document.getElementById("chatGenVideo");
  if (genImg) genImg.hidden = !p.imageGen;
  // Agnes 或标记了 videoGen 的显示生视频
  if (genVid) genVid.hidden = !(p.videoGen || id === "agnes");
}

function renderAiNav() {
  if (!aiNavGrid) return;
  aiNavGrid.innerHTML = "";
  Object.keys(AI_PROVIDERS).forEach((pid) => {
    const p = AI_PROVIDERS[pid];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "link-box ai-nav-item";
    btn.dataset.provider = pid;
    btn.innerHTML =
      '<span class="link-title">' +
      escapeHtml(p.name) +
      '</span><span class="link-desc">' +
      escapeHtml(p.navDesc || p.model) +
      "</span>";
    btn.addEventListener("click", () => openChatWithProvider(pid));
    aiNavGrid.appendChild(btn);
  });
}

function openChatWithProvider(pid) {
  if (!AI_PROVIDERS[pid]) pid = "sensenova";
  if (chatModelSelect) chatModelSelect.value = pid;
  localStorage.setItem(CHAT_PROVIDER_KEY, pid);
  openChatModal();
}

function openModelPicker() {
  const p = getProvider();
  const mid = getSelectedModelId();
  modelPickerProviderName.textContent = p.name + " · 选择具体模型";
  modelPickerList.innerHTML = "";
  (p.models || [{ id: p.model, label: p.model }]).forEach((m) => {
    const row = document.createElement("button");
    row.type = "button";
    const dep = !!m.deprecated;
    row.className =
      "model-picker-item" +
      (m.id === mid ? " active" : "") +
      (dep ? " deprecated" : "");
    const tag = m.tag
      ? '<span class="model-tag' +
        (m.free ? " free" : dep ? " dead" : " paid") +
        '">' +
        escapeHtml(m.tag) +
        "</span>"
      : "";
    row.innerHTML =
      "<div class=\"model-picker-top\"><strong>" +
      escapeHtml(m.label) +
      "</strong>" +
      tag +
      '</div><span class="model-id">' +
      escapeHtml(m.id) +
      (m.video ? " · 视频" : "") +
      "</span>";
    row.addEventListener("click", () => {
      if (dep) {
        void uiAlert("该模型已停用或不建议使用，请选择其它模型。");
        return;
      }
      setSelectedModelId(m.id);
      applyProviderUI();
      modelPickerModal.hidden = true;
      if (m.video) {
        void uiAlert("已选择视频模型。请点底部「生视频」按钮生成，不要用普通发送。");
      }
    });
    modelPickerList.appendChild(row);
  });
  modelPickerModal.hidden = false;
}

function closeModelPicker() {
  modelPickerModal.hidden = true;
}

function showEmptyState() {
  chatMessages.innerHTML =
    '<div class="chat-empty" id="chatEmpty"><div class="chat-empty-title">有什么可以帮你？</div><div class="chat-empty-hint">选择模型并在菜单中配置 API Key 后开始</div></div>';
}

function persistCurrentSession() {
  if (!chatHistory.length) return;
  const list = loadSessions();
  const title =
    (typeof chatHistory[0].content === "string"
      ? chatHistory[0].content
      : "新对话"
    ).replace(/\s+/g, " ").slice(0, 28) || "新对话";
  const item = {
    id: currentSessionId || "s_" + Date.now().toString(36),
    title,
    updated: Date.now(),
    provider: getCurrentProviderId(),
    messages: chatHistory,
  };
  currentSessionId = item.id;
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  saveSessions(list.slice(0, 40));
  renderHistoryList();
}

function renderHistoryList() {
  const list = loadSessions();
  chatHistoryList.innerHTML = "";
  if (!list.length) {
    chatHistoryList.innerHTML =
      '<div class="field-tip" style="padding:0.5rem 0.75rem">暂无历史</div>';
    return;
  }
  list.forEach((s) => {
    const row = document.createElement("div");
    row.className =
      "chat-history-item" + (s.id === currentSessionId ? " active" : "");
    row.innerHTML =
      "<span>" +
      escapeHtml(s.title || "对话") +
      '</span><button type="button" class="del-hist" data-id="' +
      s.id +
      '" title="删除">×</button>';
    row.querySelector("span").addEventListener("click", () => {
      loadSession(s.id);
      closeDrawer();
    });
    row.querySelector(".del-hist").addEventListener("click", (e) => {
      e.stopPropagation();
      const next = loadSessions().filter((x) => x.id !== s.id);
      saveSessions(next);
      if (currentSessionId === s.id) startNewChat();
      renderHistoryList();
    });
    chatHistoryList.appendChild(row);
  });
}

function loadSession(id) {
  const s = loadSessions().find((x) => x.id === id);
  if (!s) return;
  currentSessionId = s.id;
  chatHistory = s.messages || [];
  if (s.provider && AI_PROVIDERS[s.provider]) {
    chatModelSelect.value = s.provider;
    applyProviderUI();
  }
  chatMessages.innerHTML = "";
  if (!chatHistory.length) {
    showEmptyState();
    return;
  }
  chatHistory.forEach((m) => {
    if (m.role === "user") {
      const el = appendBubble("user");
      const t = typeof m.content === "string" ? m.content : "（含图片/附件）";
      el.textContent = t;
    } else if (m.role === "assistant") {
      const el = appendBubble("assistant");
      renderAssistantBubble(el, typeof m.content === "string" ? m.content : "", "");
    }
  });
  renderHistoryList();
}

function startNewChat() {
  if (chatHistory.length) persistCurrentSession();
  currentSessionId = "s_" + Date.now().toString(36);
  chatHistory = [];
  showEmptyState();
  renderHistoryList();
}

function openDrawer() {
  chatDrawer.hidden = false;
  chatDrawerMask.hidden = false;
  renderHistoryList();
}

function closeDrawer() {
  chatDrawer.hidden = true;
  chatDrawerMask.hidden = true;
}

function openChatModal() {
  const saved = localStorage.getItem(CHAT_PROVIDER_KEY);
  if (saved && AI_PROVIDERS[saved]) chatModelSelect.value = saved;
  applyProviderUI();
  if (!currentSessionId) currentSessionId = "s_" + Date.now().toString(36);
  if (!chatHistory.length) showEmptyState();
  chatModal.hidden = false;
  document.body.style.overflow = "hidden";
  // 手机不默认弹键盘；用户点输入框再弹
}

function closeChatModal() {
  closeDrawer();
  if (chatHistory.length) persistCurrentSession();
  chatModal.hidden = true;
  document.body.style.overflow = "";
}

closeChatBtn.addEventListener("click", closeChatModal);
chatMask.addEventListener("click", closeChatModal);
chatMenuBtn.addEventListener("click", () => {
  if (chatDrawer.hidden) openDrawer();
  else closeDrawer();
});
chatDrawerMask.addEventListener("click", closeDrawer);
newChatBtn.addEventListener("click", () => {
  startNewChat();
  closeDrawer();
});
toggleSettingsBtn.addEventListener("click", () => {
  chatSettings.hidden = !chatSettings.hidden;
  closeDrawer();
});

openModelPickerBtn.addEventListener("click", openModelPicker);
closeModelPickerBtn.addEventListener("click", closeModelPicker);
modelPickerMask.addEventListener("click", closeModelPicker);

saveChatKeyBtn.addEventListener("click", () => {
  const key = chatApiKeyInput.value.trim();
  if (!key) {
    void uiAlert("请先粘贴 API Key");
    return;
  }
  const map = loadChatKeys();
  map[getCurrentProviderId()] = key;
  saveChatKeys(map);
  chatSettings.hidden = true;
  void uiAlert(getProvider().name + " 的 API Key 已保存到本机");
});

/** 待发送附件：{ type:'image'|'file', name, dataUrl?, text?, mime? } */
let pendingAttach = null;
/** @type {{name:string,dataUrl:string,mime:string}[]} */
let pendingImages = [];

const chatAttachPreview = document.getElementById("chatAttachPreview");
const chatPickImage = document.getElementById("chatPickImage");
const chatPickFile = document.getElementById("chatPickFile");
const chatGenImage = document.getElementById("chatGenImage");
const chatGenVideo = document.getElementById("chatGenVideo");
const chatImageInput = document.getElementById("chatImageInput");
const chatFileInput = document.getElementById("chatFileInput");

function fileToDataURLLimited(file, maxBytes) {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error("文件过大，请压缩到 " + Math.round(maxBytes / 1024) + "KB 以内"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 200 * 1024) {
      reject(new Error("文本文件请控制在 200KB 以内"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function renderAttachPreview() {
  const box = document.getElementById("chatAttachPreview");
  if (!box) return;
  const hasImg = pendingImages && pendingImages.length;
  const hasFile = pendingAttach && pendingAttach.type === "file";
  if (!hasImg && !hasFile) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  let html = "";
  if (hasImg) {
    pendingImages.forEach((img, i) => {
      html +=
        '<div class="attach-chip"><img src="' +
        img.dataUrl +
        '" alt=""/><span>' +
        escapeHtml(img.name) +
        '</span><button type="button" class="attach-x" data-img-i="' +
        i +
        '">×</button></div>';
    });
  }
  if (hasFile) {
    html +=
      '<div class="attach-chip file"><span>📄 ' +
      escapeHtml(pendingAttach.name) +
      '</span><button type="button" class="attach-x" id="clearAttachFile">×</button></div>';
  }
  box.innerHTML = html;
  box.querySelectorAll("[data-img-i]").forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.getAttribute("data-img-i"));
      pendingImages.splice(i, 1);
      renderAttachPreview();
    };
  });
  const cf = document.getElementById("clearAttachFile");
  if (cf)
    cf.onclick = () => {
      pendingAttach = null;
      renderAttachPreview();
    };
}

chatPickImage.addEventListener("click", () => chatImageInput.click());
chatPickFile.addEventListener("click", () => chatFileInput.click());

chatImageInput.addEventListener("change", async () => {
  const files = Array.from(chatImageInput.files || []);
  chatImageInput.value = "";
  if (!files.length) return;
  const maxN = 6;
  for (const file of files.slice(0, maxN)) {
    try {
      const dataUrl = await fileToDataURLLimited(file, 1.2 * 1024 * 1024);
      pendingImages.push({ name: file.name, dataUrl, mime: file.type || "image/jpeg" });
    } catch (e) {
      void uiAlert((file.name || "图片") + "：" + (e.message || "读取失败"));
    }
  }
  if (files.length > maxN) void uiAlert("一次最多附 " + maxN + " 张图，已截取前 " + maxN + " 张");
  renderAttachPreview();
});

chatFileInput.addEventListener("change", async () => {
  const file = chatFileInput.files[0];
  chatFileInput.value = "";
  if (!file) return;
  // 图片误走「文件」时按图片处理
  if (/^image\//i.test(file.type) || /\.(jpe?g|png|gif|webp|bmp)$/i.test(file.name)) {
    try {
      const dataUrl = await fileToDataURLLimited(file, 1.5 * 1024 * 1024);
      pendingImages.push({ name: file.name, dataUrl, mime: file.type || "image/jpeg" });
      renderAttachPreview();
    } catch (e) {
      void uiAlert(e.message || "图片读取失败");
    }
    return;
  }
  try {
    const text = await fileToText(file);
    pendingAttach = { type: "file", name: file.name, text };
    renderAttachPreview();
  } catch (e) {
    void uiAlert(e.message || "文件读取失败");
  }
});

function appendBubble(role, extraClass) {
  const div = document.createElement("div");
  div.className = "chat-bubble " + role + (extraClass ? " " + extraClass : "");
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function setUserBubble(el, text, attach) {
  el.textContent = text || "";
  if (attach && attach.type === "image" && attach.dataUrl) {
    const img = document.createElement("img");
    img.className = "msg-media";
    img.src = attach.dataUrl;
    img.alt = attach.name || "图片";
    el.appendChild(img);
  } else if (attach && attach.type === "file") {
    const f = document.createElement("div");
    f.className = "msg-file";
    f.textContent = "📄 " + (attach.name || "文件");
    el.appendChild(f);
  }
}

function parseThinkAnswer(raw) {
  const s = String(raw || "");
  const m = s.match(/<think>([\s\S]*?)<\/think>/i);
  if (m) {
    return {
      think: m[1].trim(),
      answer: s.replace(/<think>[\s\S]*?<\/think>/i, "").trim(),
    };
  }
  const m2 = s.match(/<reasoning>([\s\S]*?)<\/reasoning>/i);
  if (m2) {
    return {
      think: m2[1].trim(),
      answer: s.replace(/<reasoning>[\s\S]*?<\/reasoning>/i, "").trim(),
    };
  }
  return { think: "", answer: s };
}

function showThinkingStatus(el, dirText) {
  el.classList.add("streaming");
  el.innerHTML =
    '<div class="thinking-status"><div class="thinking-spinner"></div><div class="thinking-status-text">正在思考…<span class="dir">' +
    escapeHtml(dirText || THINK_DIRS[0]) +
    "</span></div></div>";
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startThinkAnimation(el) {
  stopThinkAnimation();
  let i = 0;
  showThinkingStatus(el, THINK_DIRS[0]);
  thinkTimer = setInterval(() => {
    i = (i + 1) % THINK_DIRS.length;
    const dir = el.querySelector(".thinking-status-text .dir");
    if (dir) dir.textContent = THINK_DIRS[i];
  }, 1600);
}

function stopThinkAnimation() {
  if (thinkTimer) {
    clearInterval(thinkTimer);
    thinkTimer = null;
  }
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || "code.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function extFromLang(lang) {
  const map = {
    js: "js",
    javascript: "js",
    ts: "ts",
    typescript: "ts",
    py: "py",
    python: "py",
    html: "html",
    css: "css",
    json: "json",
    md: "md",
    markdown: "md",
    sh: "sh",
    bash: "sh",
    sql: "sql",
    java: "java",
    go: "go",
    rust: "rs",
    c: "c",
    cpp: "cpp",
    xml: "xml",
    yaml: "yml",
    yml: "yml",
  };
  return map[String(lang || "").toLowerCase()] || "txt";
}

/** 把回答渲染成：文本 + 代码块（可下载）+ 项目文件补丁（可应用） */
function extractCodeFiles(text) {
  const src = String(text || "");
  const re = /```([^\n`]*)\n([\s\S]*?)```/g;
  const files = [];
  let m;
  let idx = 0;
  let stripped = src;
  while ((m = re.exec(src)) !== null) {
    const header = (m[1] || "").trim();
    const code = m[2].replace(/\n$/, "");
    const isFile = /^file\s*:/i.test(header);
    const filePath = isFile
      ? header.replace(/^file\s*:/i, "").trim()
      : "code-" + ++idx + "." + extFromLang(header.split(/\s+/)[0] || "");
    const lang = isFile ? "" : header.split(/\s+/)[0] || "";
    files.push({ path: filePath, content: code, lang });
  }
  // 去掉代码块后的说明文字
  stripped = src.replace(re, "").trim();
  return { files, text: stripped };
}

/** 把回答渲染成：说明文字 + 代码包卡片（长代码不再直接铺开） */
function renderRichAnswer(container, text) {
  const { files, text: rest } = extractCodeFiles(text);
  if (rest) {
    const t = document.createElement("div");
    t.style.whiteSpace = "pre-wrap";
    t.textContent = rest;
    container.appendChild(t);
  }
  if (files.length) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "code-pack-card";
    card.innerHTML =
      '<div class="code-pack-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></div>' +
      '<div class="code-pack-info"><strong>代码包</strong><span>' +
      files.length +
      " 个文件 · 点击查看 / 运行</span></div>";
    card.onclick = () => openCodePack(files);
    container.appendChild(card);

    // 若有活跃项目，提供一键全部写入
    const bar = document.createElement("div");
    bar.className = "file-patch-bar";
    if (activeProjectId) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "全部写入当前项目";
      btn.onclick = () => {
        files.forEach((f) => applyFileToProject(f.path, f.content));
        void uiAlert("已写入 " + files.length + " 个文件到项目");
      };
      bar.appendChild(btn);
    }
    if (getGithubConfig().token && getGithubConfig().repo) {
      const gbtn = document.createElement("button");
      gbtn.type = "button";
      gbtn.textContent = "推送到 GitHub";
      gbtn.onclick = () => pushFilesToGithub(files);
      bar.appendChild(gbtn);
    }
    if (bar.childNodes.length) container.appendChild(bar);
  } else if (!rest) {
    container.textContent = text || "";
  }
}

let codePackFilesCache = [];
function openCodePack(files) {
  codePackFilesCache = files || [];
  const modal = document.getElementById("codePackModal");
  const list = document.getElementById("codePackFiles");
  const preview = document.getElementById("codePackPreview").querySelector("code");
  const runBtn = document.getElementById("codePackRun");
  const frame = document.getElementById("codePackFrame");
  frame.hidden = true;
  frame.srcdoc = "";
  list.innerHTML = "";
  document.getElementById("codePackTitle").textContent =
    "代码包 · " + codePackFilesCache.length + " 个文件";

  const showFile = (i) => {
    list.querySelectorAll(".codepack-file-btn").forEach((b, j) => {
      b.classList.toggle("active", j === i);
    });
    const f = codePackFilesCache[i];
    preview.textContent = f.content;
    const canRun =
      /\.(html?|htm)$/i.test(f.path) ||
      /html/i.test(f.lang) ||
      (codePackFilesCache.length === 1 && /html/i.test(f.content.slice(0, 200)));
    runBtn.hidden = !canRun && !codePackFilesCache.some((x) => /\.html?$/i.test(x.path));
    runBtn.dataset.idx = String(i);
  };

  codePackFilesCache.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "codepack-file-btn" + (i === 0 ? " active" : "");
    b.textContent = f.path;
    b.onclick = () => showFile(i);
    list.appendChild(b);
  });
  if (codePackFilesCache.length) showFile(0);
  modal.hidden = false;
}

document.getElementById("codePackBack").addEventListener("click", () => {
  document.getElementById("codePackModal").hidden = true;
});
document.getElementById("codePackMask").addEventListener("click", () => {
  document.getElementById("codePackModal").hidden = true;
});
document.getElementById("codePackRun").addEventListener("click", () => {
  const frame = document.getElementById("codePackFrame");
  // 优先找 html
  let htmlFile = codePackFilesCache.find((f) => /\.html?$/i.test(f.path));
  if (!htmlFile) {
    const idx = Number(document.getElementById("codePackRun").dataset.idx || 0);
    htmlFile = codePackFilesCache[idx];
  }
  let html = htmlFile ? htmlFile.content : "";
  // 把同包 css/js 内联进去便于预览
  if (html) {
    codePackFilesCache.forEach((f) => {
      if (/\.css$/i.test(f.path)) {
        html = html.replace(
          /<\/head>/i,
          "<style>" + f.content + "</style></head>"
        );
        if (!/<\/head>/i.test(html)) html = "<style>" + f.content + "</style>" + html;
      }
      if (/\.js$/i.test(f.path) && !/\.json$/i.test(f.path)) {
        html = html.replace(
          /<\/body>/i,
          "<script>" + f.content + "</script></body>"
        );
        if (!/<\/body>/i.test(html))
          html = html + "<script>" + f.content + "</" + "script>";
      }
    });
  } else {
    html =
      "<pre style='white-space:pre-wrap;font-family:monospace;padding:12px'>" +
      escapeHtml(codePackFilesCache.map((f) => f.content).join("\n\n")) +
      "</pre>";
  }
  frame.hidden = false;
  frame.srcdoc = html;
});



/** 流式过程中：检测到代码块则显示「正在编译代码」而不是把大段代码刷在对话框 */
function renderAssistantBubbleLive(el, content, reasoning) {
  el.classList.remove("streaming");
  el.innerHTML = "";
  if (reasoning) {
    const det = document.createElement("details");
    det.className = "thinking-block";
    det.open = true;
    det.innerHTML =
      "<summary>思考过程</summary><div class=\"thinking-body\"></div>";
    det.querySelector(".thinking-body").textContent = reasoning;
    el.appendChild(det);
  }
  const src = String(content || "");
  const openFence = (src.match(/```/g) || []).length % 2 === 1;
  const hasFence = src.includes("```");
  // 去掉已闭合代码块后的纯文本预览
  let preview = src.replace(/```[\s\S]*?```/g, "");
  if (openFence) {
    // 截断到最后一个未闭合 fence 之前
    const last = src.lastIndexOf("```");
    preview = src.slice(0, last).replace(/```[\s\S]*?```/g, "");
  }
  preview = preview.trim();
  if (preview) {
    const t = document.createElement("div");
    t.className = "answer-body";
    t.style.whiteSpace = "pre-wrap";
    // 只显示末尾一小段，避免刷屏
    t.textContent = preview.length > 800 ? "…\n" + preview.slice(-800) : preview;
    el.appendChild(t);
  }
  if (hasFence) {
    const st = document.createElement("div");
    st.className = "compile-status";
    st.innerHTML =
      '<span class="compile-spin"></span><span>' +
      (openFence ? "正在编译代码…" : "代码已生成，正在打包…") +
      "</span>";
    el.appendChild(st);
  } else if (!preview && !reasoning) {
    el.innerHTML =
      '<div class="compile-status"><span class="compile-spin"></span>正在生成…</div>';
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderAssistantBubble(el, fullText, reasoningExtra) {
  stopThinkAnimation();
  const parsed = parseThinkAnswer(fullText);
  const think = (
    (reasoningExtra || "") +
    (parsed.think ? (reasoningExtra ? "\n" : "") + parsed.think : "")
  ).trim();
  el.innerHTML = "";
  el.classList.remove("streaming");
  if (think) {
    const details = document.createElement("details");
    details.className = "thinking-block";
    details.open = !parsed.answer;
    const sum = document.createElement("summary");
    sum.textContent = parsed.answer ? "思考过程" : "正在思考…";
    const body = document.createElement("div");
    body.className = "thinking-content";
    body.textContent = think;
    details.appendChild(sum);
    details.appendChild(body);
    el.appendChild(details);
  }
  const ans = document.createElement("div");
  ans.className = "answer-body";
  const answerText = parsed.answer || (think ? "" : fullText || "");
  renderRichAnswer(ans, answerText);
  el.appendChild(ans);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function friendlyError(raw) {
  if (/no longer available to new users|update your code to use models\/gemini-3/i.test(String(msg || ""))) {
    return "该 Gemini 模型不对新用户开放。请在模型列表中改选「Gemini 3.8 Flash」或 3.x 系列后重试。";
  }

  const tip = String(raw || "");
  if (/tpm|rpm|rate.?limit|exceeds.*limit|429/i.test(tip)) {
    return "请求过于频繁或额度不足（限流）。请等待 30～60 秒后再试，或换一个模型 / 明天再用。";
  }
  if (
    /令牌已过期|验证不正确|invalid.?api.?key|incorrect.?api.?key|401|unauthorized|鉴权|密钥|token.*invalid|expired/i.test(
      tip
    )
  ) {
    return "API Key 无效或已过期。请打开菜单 → API 设置，重新粘贴智谱控制台的最新 Key 并保存。";
  }
  if (/insufficient|余额|quota|billing/i.test(tip)) {
    return "账户余额不足或配额已用完，请到对应平台充值或换模型。";
  }
  if (/Failed to fetch|NetworkError|CORS/i.test(tip)) {
    return "网络或跨域失败。请确认已部署代理接口，或检查网络。";
  }
  if (/model.?not.?found|不存在/i.test(tip)) {
    return "模型名称不可用，请换一个模型试试。";
  }
  if (/content.?policy|safety|敏感/i.test(tip)) {
    return "内容被安全策略拦截，请修改描述后重试。";
  }
  return tip.length > 180 ? tip.slice(0, 180) + "…" : tip;
}

function ensureApiKey() {
  const provider = getProvider();
  let apiKey = getChatApiKey() || chatApiKeyInput.value.trim();
  if (!apiKey) {
    void uiAlert("请先填写并保存 " + provider.name + " 的 API Key");
    chatApiKeyInput.focus();
    return null;
  }
  if (chatApiKeyInput.value.trim()) {
    const map = loadChatKeys();
    map[getCurrentProviderId()] = chatApiKeyInput.value.trim();
    saveChatKeys(map);
    apiKey = chatApiKeyInput.value.trim();
  }
  return apiKey;
}

async function apiFetch(pathSuffix, bodyObj, apiKey, provider) {
  const base = provider.base.replace(/\/$/, "");
  const endpoint = base + pathSuffix;
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyObj),
    });
  } catch (directErr) {
    console.warn("直连失败，改用代理", directErr);
    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        base: provider.base,
        path: pathSuffix,
        model: bodyObj.model,
        messages: bodyObj.messages,
        stream: !!bodyObj.stream,
        prompt: bodyObj.prompt,
        n: bodyObj.n,
        size: bodyObj.size,
      }),
    });
  }
}

/* 清空改由侧栏「新建对话」完成 */

async function sendChatMessage() {
  if (chatBusy) return;
  const text = chatInput.value.trim();
  const attach = pendingAttach;
  if (!text && !attach) return;

  // 生视频模式 或 选中了 video 模型 → 走视频接口
  const mid = getSelectedModelId();
  if (videoMode || /video/i.test(mid)) {
    if (!text) {
      void uiAlert("请输入视频描述后再发送");
      return;
    }
    const img =
      (pendingImages[0] && pendingImages[0].dataUrl) ||
      (attach && attach.type === "image" ? attach.dataUrl : null);
    chatInput.value = "";
    pendingAttach = null;
    pendingImages = [];
    renderAttachPreview();
    await runAgnesVideoGeneration(text, img);
    return;
  }

  const provider = getProvider();
  const apiKey = ensureApiKey();
  if (!apiKey) return;

  const imgs = pendingImages.slice();
  if (imgs.length && provider.vision === false) {
    void uiAlert(provider.name + " 当前配置可能不支持识图，可改用通义 / 智谱 / OpenAI / Kimi / Gemini 再试。");
  }

  chatInput.value = "";
  pendingAttach = null;
  pendingImages = [];
  renderAttachPreview();

  const userEl = appendBubble("user");
  let displayText = text;
  if (attach && attach.type === "file") {
    displayText = (text ? text + "\n\n" : "") + "【已附文件：" + attach.name + "】";
  } else if (imgs.length && !text) {
    displayText = "请描述这些图片（共 " + imgs.length + " 张）";
  } else if (imgs.length) {
    displayText = text + "\n【附图 " + imgs.length + " 张】";
  }
  // 展示首图预览，其余计数
  const firstImg = imgs[0] ? { type: "image", dataUrl: imgs[0].dataUrl, name: imgs[0].name } : attach;
  setUserBubble(userEl, displayText, firstImg && firstImg.type === "image" ? firstImg : attach);
  if (imgs.length > 1) {
    const more = document.createElement("div");
    more.style.cssText = "font-size:0.75rem;opacity:0.7;margin-top:4px";
    more.textContent = "另有 " + (imgs.length - 1) + " 张附图";
    userEl.appendChild(more);
  }

  let userContent;
  if (imgs.length) {
    const parts = [{ type: "text", text: text || "请详细描述这些图片的内容。" }];
    imgs.forEach((im) => {
      parts.push({ type: "image_url", image_url: { url: im.dataUrl } });
    });
    userContent = parts;
  } else if (attach && attach.type === "file") {
    userContent =
      (text ? text + "\n\n" : "") +
      "以下是用户上传的文件「" +
      attach.name +
      "」内容：\n```\n" +
      attach.text +
      "\n```";
  } else {
    userContent = text;
  }
  chatHistory.push({ role: "user", content: userContent });

  const empty = document.getElementById("chatEmpty");
  if (empty) empty.remove();

  const assistantEl = appendBubble("assistant", "streaming");
  startThinkAnimation(assistantEl);
  chatBusy = true;
  sendChatBtn.disabled = true;

  // 后台保活：屏幕唤醒锁 + 周期落盘
  let wakeLock = null;
  try {
    if (navigator.wakeLock && navigator.wakeLock.request) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (_) {}
  const checkpointKey = "ai_stream_checkpoint_" + (currentSessionId || "tmp");
  const saveCheckpoint = (full, reasoning) => {
    try {
      sessionStorage.setItem(
        checkpointKey,
        JSON.stringify({ full, reasoning, t: Date.now() })
      );
    } catch (_) {}
  };

  const messages = [
    { role: "system", content: provider.system + buildProjectSystemExtra() + buildGithubSystemExtra() },
    ...chatHistory,
  ];

  // 切到后台时流式容易中断：先流式，失败则非流式重试一次
  async function readStream(res) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let full = "";
    let reasoning = "";
    let buffer = "";
    let lastSave = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          if (!delta) continue;
          if (delta.reasoning_content) reasoning += delta.reasoning_content;
          if (delta.reasoning) reasoning += delta.reasoning;
          if (delta.content) full += delta.content;
          if (full || reasoning) {
            stopThinkAnimation();
            renderAssistantBubbleLive(assistantEl, full, reasoning);
          }
          if (Date.now() - lastSave > 1500) {
            saveCheckpoint(full, reasoning);
            lastSave = Date.now();
          }
        } catch (_) {}
      }
    }
    return { full, reasoning };
  }

  async function readOnce(res) {
    const data = await res.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    const full = (msg && msg.content) || "";
    const reasoning =
      (msg && (msg.reasoning_content || msg.reasoning)) ||
      (data.choices && data.choices[0] && data.choices[0].reasoning) ||
      "";
    return { full, reasoning };
  }

  try {
    let full = "";
    let reasoning = "";
    let usedNonStream = false;

    const payloadStream = { model: provider.model, messages, stream: true };
    let res = await apiFetch("/chat/completions", payloadStream, apiKey, provider);
    if (!res.ok) {
      let errText = "HTTP " + res.status;
      try {
        const errJson = await res.json();
        errText =
          (errJson.error && (errJson.error.message || errJson.error)) ||
          errJson.message ||
          JSON.stringify(errJson);
      } catch (_) {
        try {
          errText = await res.text();
        } catch (__) {}
      }
      throw new Error(errText);
    }

    try {
      const out = await readStream(res);
      full = out.full;
      reasoning = out.reasoning;
    } catch (streamErr) {
      console.warn("stream interrupted, fallback non-stream", streamErr);
      // 后台中断：非流式重试拿完整结果
      usedNonStream = true;
      stopThinkAnimation();
      assistantEl.innerHTML =
        '<div class="compile-status"><span class="compile-spin"></span>连接中断，正在重新拉取完整结果…</div>';
      const payloadOnce = { model: provider.model, messages, stream: false };
      res = await apiFetch("/chat/completions", payloadOnce, apiKey, provider);
      if (!res.ok) throw streamErr;
      const out = await readOnce(res);
      full = out.full;
      reasoning = out.reasoning;
    }

    // 若流式结果过短且可能被掐断，也尝试非流式补全
    if (!usedNonStream && full.length < 8 && !reasoning) {
      try {
        const payloadOnce = { model: provider.model, messages, stream: false };
        res = await apiFetch("/chat/completions", payloadOnce, apiKey, provider);
        if (res.ok) {
          const out = await readOnce(res);
          if ((out.full || "").length > full.length) {
            full = out.full;
            reasoning = out.reasoning || reasoning;
          }
        }
      } catch (_) {}
    }

    stopThinkAnimation();
    const finalText = full || "";
    renderAssistantBubble(assistantEl, finalText, reasoning);
    const det = assistantEl.querySelector("details.thinking-block");
    if (det && finalText) det.open = false;

    if (!finalText && !reasoning) {
      // 尝试从 checkpoint 恢复
      try {
        const ck = JSON.parse(sessionStorage.getItem(checkpointKey) || "null");
        if (ck && ck.full) {
          renderAssistantBubble(assistantEl, ck.full, ck.reasoning || "");
          chatHistory.push({ role: "assistant", content: ck.full });
          persistCurrentSession();
        } else {
          assistantEl.textContent = "（模型没有返回内容，若刚切到后台请再试一次）";
        }
      } catch (_) {
        assistantEl.textContent = "（模型没有返回内容）";
      }
    } else {
      chatHistory.push({ role: "assistant", content: finalText || reasoning });
      persistCurrentSession();
      try {
        sessionStorage.removeItem(checkpointKey);
      } catch (_) {}
    }
  } catch (e) {
    console.error(e);
    stopThinkAnimation();
    // 尝试 checkpoint
    try {
      const ck = JSON.parse(sessionStorage.getItem(checkpointKey) || "null");
      if (ck && ck.full && ck.full.length > 20) {
        renderAssistantBubble(assistantEl, ck.full, ck.reasoning || "");
        chatHistory.push({ role: "assistant", content: ck.full });
        persistCurrentSession();
        void uiAlert("请求中断，已恢复部分生成内容。");
      } else {
        assistantEl.classList.remove("streaming");
        assistantEl.className = "chat-bubble error";
        assistantEl.textContent = "请求失败：" + friendlyError(e.message || e);
      }
    } catch (_) {
      assistantEl.classList.remove("streaming");
      assistantEl.className = "chat-bubble error";
      assistantEl.textContent = "请求失败：" + friendlyError(e.message || e);
    }
  } finally {
    chatBusy = false;
    sendChatBtn.disabled = false;
    chatInput.focus();
    try {
      if (wakeLock) await wakeLock.release();
    } catch (_) {}
  }
}

async function generateImage() {
  if (chatBusy) return;
  let prompt = chatInput.value.trim();
  if (!prompt) {
    prompt = await uiPrompt("请输入生图描述（中文即可）", "", "生成图片");
    if (!prompt) return;
  }

  const provider = getProvider();
  const apiKey = ensureApiKey();
  if (!apiKey) return;

  chatInput.value = "";
  const empty = document.getElementById("chatEmpty");
  if (empty) empty.remove();

  const userEl = appendBubble("user");
  userEl.textContent = "生成图片：" + prompt;
  chatHistory.push({ role: "user", content: "请生成图片：" + prompt });

  const assistantEl = appendBubble("assistant", "streaming");
  startThinkAnimation(assistantEl);
  const dirEl = assistantEl.querySelector(".thinking-status-text .dir");
  if (dirEl) dirEl.textContent = "正在调用图像模型…";
  chatBusy = true;
  sendChatBtn.disabled = true;

  try {
    if (!provider.imageGen) {
      throw new Error(
        provider.name +
          " 当前未配置生图接口。请切换到「智谱 GLM / 通义 / OpenAI 兼容」后再试。"
      );
    }

    const pid = getCurrentProviderId();
    // 按官方文档组装请求体（智谱不要传 n，尺寸用官方推荐值）
    let modelsToTry = [provider.imageModel || "dall-e-3"];
    if (pid === "zhipu") {
      modelsToTry = ["cogview-3-flash", "cogview-4", "glm-image"];
    }

    let lastErr = null;
    let data = null;

    for (const imageModel of modelsToTry) {
      let body = { model: imageModel, prompt: prompt };
      if (pid === "zhipu") {
        body.size = provider.imageSize || "1024x1024";
      } else if (pid === "qwen") {
        body.size = "1024*1024";
        body.n = 1;
      } else {
        body.size = "1024x1024";
        body.n = 1;
      }

      try {
        // 生图优先走本站代理，避免浏览器 CORS，并拿到完整错误信息
        let res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            base: provider.base,
            path: "/images/generations",
            model: body.model,
            prompt: body.prompt,
            size: body.size,
            n: body.n,
          }),
        });

        // 若代理未部署，再尝试直连
        if (res.status === 404) {
          res = await fetch(
            provider.base.replace(/\/$/, "") + "/images/generations",
            {
              method: "POST",
              headers: {
                Authorization: "Bearer " + apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            }
          );
        }

        const rawText = await res.text();
        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch (_) {}

        if (!res.ok) {
          const msg =
            (parsed &&
              ((parsed.error && (parsed.error.message || parsed.error)) ||
                parsed.message ||
                parsed.msg)) ||
            rawText ||
            "HTTP " + res.status;
          lastErr = new Error(
            "HTTP " + res.status + " · " + String(msg).slice(0, 240)
          );
          // 模型不可用则试下一个
          if (
            res.status === 404 ||
            res.status === 400 ||
            /model|不存在|not.?found|无权限|not.?authorized/i.test(String(msg))
          ) {
            continue;
          }
          throw lastErr;
        }

        data = parsed;
        if (data) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!data) {
      throw lastErr || new Error("生图失败，未返回数据");
    }

    const item = data.data && data.data[0];
    const url = item && (item.url || item.b64_json || item.image);

    stopThinkAnimation();
    assistantEl.classList.remove("streaming");
    assistantEl.innerHTML = "";
    const tip = document.createElement("div");
    tip.className = "answer-body";
    tip.textContent = "已生成图片：";
    assistantEl.appendChild(tip);

    if (url) {
      const img = document.createElement("img");
      img.className = "msg-media";
      img.alt = prompt;
      img.src =
        String(url).startsWith("http") || String(url).startsWith("data:")
          ? url
          : "data:image/png;base64," + url;
      assistantEl.appendChild(img);
      chatHistory.push({
        role: "assistant",
        content: "（已生成图片：" + prompt + "）",
      });
      persistCurrentSession();
    } else {
      tip.textContent =
        "接口已返回，但未解析到图片地址：\n" +
        JSON.stringify(data).slice(0, 400);
    }
  } catch (e) {
    console.error(e);
    stopThinkAnimation();
    assistantEl.classList.remove("streaming");
    assistantEl.className = "chat-bubble error";
    let msg = friendlyError(e.message || e);
    if (/431/.test(String(e.message || e))) {
      msg =
        "请求被拒绝（HTTP 431）。常见原因：① Key 未开通图像模型 ② 请到智谱控制台确认已开通 CogView / 图像生成 ③ 重新保存 Key 后再试。原始：" +
        String(e.message || e).slice(0, 120);
    }
    assistantEl.textContent = "生图失败：" + msg;
  } finally {
    chatBusy = false;
    sendChatBtn.disabled = false;
    chatInput.focus();
  }
}

/** Agnes Video 2.0 · 免费文生视频 */
const AGNES_KEY_STORAGE = "ai_agnes_key_v1";
const AGNES_VIDEO_MODELS = ["agnes-video-2.5-flash", "agnes-video-v2.0", "agnes-video-2.5"];

let videoMode = false;

function setVideoMode(on) {
  videoMode = !!on;
  if (chatGenVideo) {
    chatGenVideo.classList.toggle("active", videoMode);
    chatGenVideo.title = videoMode ? "生视频模式已开启（再点关闭）" : "生成视频";
  }
  if (chatInput) {
    chatInput.placeholder = videoMode
      ? "描述要生成的视频，可附图后点发送…"
      : "发送消息…";
  }
}

function getAgnesKey() {
  const map = loadChatKeys();
  return (
    (map.agnes || "").trim() ||
    (localStorage.getItem(AGNES_KEY_STORAGE) || "").trim() ||
    (getCurrentProviderId() === "agnes" ? getChatApiKey() : "") ||
    getChatApiKey()
  );
}

async function ensureAgnesKey() {
  let key = getAgnesKey();
  if (key) return key;
  key = await uiPrompt(
    "请粘贴 Agnes API Key（platform.agnes-ai.com 免费注册）",
    "",
    "Agnes 生视频"
  );
  if (!key) return null;
  key = key.trim();
  const map = loadChatKeys();
  map.agnes = key;
  saveChatKeys(map);
  localStorage.setItem(AGNES_KEY_STORAGE, key);
  return key;
}

function pickVideoModelId() {
  // v2.0 已于 2026-09-25 下线，统一 2.5 Flash
  return "agnes-video-2.5-flash";
}

function extractErrMsg(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.error) {
    if (typeof data.error === "string") return data.error;
    if (data.error.message) return data.error.message;
    if (data.error.code) return "error code: " + data.error.code;
  }
  if (data.message) return data.message;
  if (data.detail) return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
  if (data.msg) return data.msg;
  return fallback;
}

/** 真正发起 Agnes 视频任务（可带参考图 dataURL / URL） */
async function runAgnesVideoGeneration(prompt, imageDataUrl) {
  const apiKey = await ensureAgnesKey();
  if (!apiKey) return;

  const empty = document.getElementById("chatEmpty");
  if (empty) empty.remove();

  const userEl = appendBubble("user");
  setUserBubble(
    userEl,
    "生成视频：" + prompt,
    imageDataUrl ? { type: "image", dataUrl: imageDataUrl, name: "参考图" } : null
  );
  chatHistory.push({ role: "user", content: "生成视频：" + prompt });

  const assistantEl = appendBubble("assistant", "streaming");
  startThinkAnimation(assistantEl);
  const dirEl = assistantEl.querySelector(".thinking-status-text .dir");
  if (dirEl) dirEl.textContent = "正在提交视频任务…";
  chatBusy = true;
  sendChatBtn.disabled = true;

  const modelsToTry = ["agnes-video-2.5-flash"];

  try {
    let createData = null;
    let usedModel = modelsToTry[0];
    let lastErr = null;

    for (const model of modelsToTry) {
      usedModel = model;
      if (dirEl) dirEl.textContent = "提交 " + model + " …";
      const body = {
        action: "create",
        apiKey,
        model: "agnes-video-2.5-flash",
        prompt,
        seconds: "5",
        size: "720P",
        aspect_ratio: imageDataUrl ? "1:1" : "16:9",
      };
      if (imageDataUrl) body.image = imageDataUrl;
      const createRes = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const createText = await createRes.text();
      let parsed = null;
      try {
        parsed = JSON.parse(createText);
      } catch (_) {}
      if (createRes.ok) {
        createData = parsed;
        break;
      }
      lastErr = new Error(extractErrMsg(parsed, createText || "HTTP " + createRes.status));
      // 参数类错误换模型再试
      if (createRes.status === 400 || createRes.status === 422 || /1015|parameter|invalid/i.test(String(lastErr.message))) {
        continue;
      }
      throw lastErr;
    }

    if (!createData) throw lastErr || new Error("创建视频任务失败");

    const videoId =
      createData.video_id || createData.videoId || (createData.data && createData.data.video_id) || "";
    const taskId =
      createData.task_id || createData.id || createData.taskId || "";
    if (!videoId && !taskId) {
      throw new Error("未返回 video_id：" + JSON.stringify(createData).slice(0, 240));
    }

    if (dirEl) dirEl.textContent = "排队生成中（1～3 分钟，请勿关闭）…";

    const maxTries = 72;
    let result = null;
    for (let i = 0; i < maxTries; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollRes = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "poll",
          apiKey,
          video_id: videoId,
          task_id: taskId,
          model: usedModel,
        }),
      });
      const pollText = await pollRes.text();
      let pollData = null;
      try {
        pollData = JSON.parse(pollText);
      } catch (_) {}

      const status = String(
        (pollData && (pollData.status || pollData.state || pollData.task_status)) || ""
      ).toLowerCase();
      const progress =
        pollData && (pollData.progress != null ? pollData.progress : pollData.percent);
      const liveDir = assistantEl.querySelector(".thinking-status-text .dir");
      if (liveDir) {
        liveDir.textContent =
          "生成中" +
          (progress != null ? " " + progress + "%" : "") +
          " · " +
          (i + 1) +
          "/" +
          maxTries;
      }

      const urlEarly =
        pollData &&
        (pollData.url ||
          pollData.video_url ||
          (pollData.data && (pollData.data.url || pollData.data.video_url)) ||
          (pollData.output && pollData.output.url));
      if (urlEarly) {
        result = pollData;
        break;
      }
      if (["completed", "succeeded", "success", "done"].includes(status)) {
        result = pollData;
        break;
      }
      if (status === "failed" || status === "error") {
        throw new Error(extractErrMsg(pollData, "视频生成失败"));
      }
    }

    if (!result) throw new Error("等待超时，高峰期请错峰再试。");

    const url =
      result.url ||
      result.video_url ||
      (result.data && (result.data.url || result.data.video_url)) ||
      (result.output && result.output.url) ||
      (result.result && result.result.url) ||
      "";

    stopThinkAnimation();
    assistantEl.classList.remove("streaming");
    assistantEl.innerHTML = "";
    const tip = document.createElement("div");
    tip.className = "answer-body";
    tip.textContent = "视频已生成（" + usedModel + "）：";
    assistantEl.appendChild(tip);

    if (url) {
      const video = document.createElement("video");
      video.className = "msg-media";
      video.controls = true;
      video.playsInline = true;
      video.src = url;
      video.style.maxHeight = "280px";
      video.style.width = "100%";
      video.style.borderRadius = "12px";
      video.style.marginTop = "0.5rem";
      assistantEl.appendChild(video);
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "在新窗口打开 / 下载";
      link.style.display = "inline-block";
      link.style.marginTop = "0.45rem";
      link.style.fontSize = "0.8rem";
      link.style.color = "#a78bfa";
      assistantEl.appendChild(link);
      chatHistory.push({ role: "assistant", content: "（已生成视频）\n" + url });
      persistCurrentSession();
    } else {
      tip.textContent =
        "任务完成但未解析到地址：\n" + JSON.stringify(result).slice(0, 400);
    }
  } catch (e) {
    console.error(e);
    stopThinkAnimation();
    assistantEl.classList.remove("streaming");
    assistantEl.className = "chat-bubble error";
    let msg = String(e.message || e);
    if (/1015|下线|retired|v2\.0/i.test(msg)) {
      msg =
        "Video 2.0 已下线或参数无效。已改用 Video 2.5 Flash。" +
        "若仍失败：① 对话模型请选「Agnes 2.0 Flash」勿选 Video ② 附图需能上传到公网（代理会自动上传）③ 描述勿要求透明背景 ④ 错峰重试。";
    } else if (/401|unauthorized|api.?key|令牌|鉴权|无效/i.test(msg)) {
      msg = "Agnes Key 无效，请在 API 设置中重新保存 platform.agnes-ai.com 的 Key。";
    } else if (/queue|503|full|限流|429/i.test(msg)) {
      msg = "视频队列繁忙或限流，请等待 1～5 分钟后再试。";
    } else {
      msg = friendlyError(msg);
    }
    assistantEl.textContent = "生视频失败：" + msg;
  } finally {
    chatBusy = false;
    sendChatBtn.disabled = false;
    chatInput.focus();
  }
}

async function generateVideo() {
  // 点击切换「生视频模式」，不立即请求
  setVideoMode(!videoMode);
  if (videoMode) {
    void uiAlert("已开启生视频模式：在下方输入描述，可点「图片」附图，再点发送。再点一次摄像机图标可关闭。");
  }
}

chatGenVideo.addEventListener("click", () => { generateVideo(); });
sendChatBtn.addEventListener("click", sendChatMessage);

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(120, chatInput.scrollHeight) + "px";
});


/* ========== 项目管理（Grok 风格） ========== */
const PROJECTS_KEY = "ai_projects_v1";
const ACTIVE_PROJECT_KEY = "ai_active_project_v1";
let activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY) || null;
let editingFilePath = null;
let formDraftFiles = [];
let viewingProjectId = null;

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveProjects(list) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
}

function getActiveProject() {
  if (!activeProjectId) return null;
  return loadProjects().find((p) => p.id === activeProjectId) || null;
}

function setActiveProject(id) {
  activeProjectId = id;
  if (id) localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  else localStorage.removeItem(ACTIVE_PROJECT_KEY);
  updateProjectBadge();
}

function updateProjectBadge() {
  const sel = document.getElementById("chatModelSelect");
  if (!sel || !sel.parentElement) return;
  let badge = document.getElementById("chatProjectBadge");
  const proj = getActiveProject();
  if (proj) {
    if (!badge) {
      badge = document.createElement("span");
      badge.id = "chatProjectBadge";
      badge.className = "chat-project-badge";
      sel.parentElement.appendChild(badge);
    }
    badge.textContent = "项目 · " + proj.name;
    badge.onclick = () => openProjectModal();
  } else if (badge) {
    badge.remove();
  }
}

function buildProjectSystemExtra() {
  const proj = getActiveProject();
  if (!proj) return "";
  let extra =
    "\n\n【当前项目：" +
    proj.name +
    "】\n用户偏好：\n" +
    (proj.preferences || "（无）") +
    "\n\n项目文件：\n";
  (proj.files || []).forEach((f) => {
    extra += "\n--- file:" + f.path + " ---\n" + (f.content || "") + "\n";
  });
  extra +=
    "\n修改或新建文件时，请用：\n```file:相对路径\n完整内容\n```\n不要把大段代码直接堆在回复里，用 file: 代码块即可。";
  return extra;
}

function applyFileToProject(path, content) {
  if (!activeProjectId) {
    void uiAlert("请先启用一个项目");
    return;
  }
  const list = loadProjects();
  const proj = list.find((p) => p.id === activeProjectId);
  if (!proj) return;
  if (!proj.files) proj.files = [];
  const existing = proj.files.find((f) => f.path === path);
  if (existing) existing.content = content;
  else proj.files.push({ path, content });
  proj.updated = Date.now();
  saveProjects(list);
}

function formatRelTime(ts) {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 60000) return "刚刚";
  if (d < 3600000) return Math.floor(d / 60000) + " 分钟前";
  if (d < 86400000) return Math.floor(d / 3600000) + " 小时前";
  if (d < 86400000 * 7) return Math.floor(d / 86400000) + " 天前";
  const dt = new Date(ts);
  return dt.getMonth() + 1 + "月" + dt.getDate() + "日";
}

function showProjView(name) {
  ["projViewList", "projViewForm", "projViewDetail", "projViewFiles"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false; // 由 is-active 控制显示，避免 [hidden] 与 flex 冲突
    el.classList.toggle("is-active", id === name);
  });
  const menu = document.getElementById("projMenu");
  if (menu) menu.hidden = true;
}

function renderProjGrid() {
  const grid = document.getElementById("projGrid");
  const empty = document.getElementById("projEmpty");
  const list = loadProjects();
  grid.innerHTML = "";
  empty.hidden = list.length > 0;
  list.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "proj-card" + (p.id === activeProjectId ? " active-proj" : "");
    btn.innerHTML =
      '<div class="proj-card-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg></div>' +
      '<div class="proj-card-name">' +
      escapeHtml(p.name) +
      '</div><div class="proj-card-meta">修改于: ' +
      formatRelTime(p.updated || 0) +
      "</div>";
    btn.onclick = () => openProjDetail(p.id);
    grid.appendChild(btn);
  });
}

function openProjDetail(id) {
  viewingProjectId = id;
  const p = loadProjects().find((x) => x.id === id);
  if (!p) return;
  document.getElementById("projDetailName").textContent = p.name;
  document.getElementById("projDetailPrefs").textContent = p.preferences
    ? "偏好：" + p.preferences
    : "暂无项目说明";
  showProjView("projViewDetail");
}

function openProjectModal() {
  const modal = document.getElementById("projectModal");
  modal.hidden = false;
  // 确保盖在聊天等所有内容之上
  modal.style.zIndex = "1100";
  showProjView("projViewList");
  renderProjGrid();
}

function closeProjectModal() {
  document.getElementById("projectModal").hidden = true;
}

document.getElementById("openProjectsBtn").addEventListener("click", () => {
  closeDrawer();
  openProjectModal();
});
document.getElementById("closeProject").addEventListener("click", closeProjectModal);
document.getElementById("projectMask").addEventListener("click", closeProjectModal);

document.getElementById("newProjectBtn").addEventListener("click", () => {
  formDraftFiles = [];
  viewingProjectId = null;
  document.getElementById("projFormTitle").textContent = "新建项目";
  document.getElementById("projFormSave").textContent = "创建";
  document.getElementById("projFormName").value = "";
  document.getElementById("projFormPrefs").value = "";
  renderFormFiles();
  showProjView("projViewForm");
});

document.getElementById("projFormBack").addEventListener("click", () => {
  showProjView("projViewList");
  renderProjGrid();
});

function renderFormFiles() {
  const box = document.getElementById("projFormFileList");
  box.innerHTML = "";
  formDraftFiles.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "proj-upload-item";
    row.innerHTML =
      "<span>" +
      escapeHtml(f.path) +
      '</span><button type="button">×</button>';
    row.querySelector("button").onclick = () => {
      formDraftFiles.splice(i, 1);
      renderFormFiles();
    };
    box.appendChild(row);
  });
}

document.getElementById("projFormAddFile").addEventListener("click", async () => {
  const path = await uiPrompt("文件名（如 index.html、src/app.js）", "README.md", "添加文件");
  if (!path) return;
  const content = await uiPrompt("文件内容（可先留空稍后编辑）", "", "文件内容");
  formDraftFiles.push({ path: path.trim(), content: content || "" });
  renderFormFiles();
});

document.getElementById("projFormSave").addEventListener("click", async () => {
  const name = document.getElementById("projFormName").value.trim();
  if (!name) {
    void uiAlert("请填写项目名称");
    return;
  }
  const prefs = document.getElementById("projFormPrefs").value;
  const list = loadProjects();
  if (viewingProjectId) {
    const p = list.find((x) => x.id === viewingProjectId);
    if (p) {
      p.name = name;
      p.preferences = prefs;
      p.updated = Date.now();
      if (formDraftFiles.length) {
        if (!p.files) p.files = [];
        formDraftFiles.forEach((f) => {
          const ex = p.files.find((x) => x.path === f.path);
          if (ex) ex.content = f.content;
          else p.files.push(f);
        });
      }
    }
  } else {
    const id = "p_" + Date.now().toString(36);
    list.unshift({
      id,
      name,
      preferences: prefs,
      files: formDraftFiles.length
        ? formDraftFiles.slice()
        : [{ path: "README.md", content: "# " + name + "\n" }],
      updated: Date.now(),
    });
    viewingProjectId = id;
  }
  saveProjects(list);
  openProjDetail(viewingProjectId);
});

document.getElementById("projDetailBack").addEventListener("click", () => {
  showProjView("projViewList");
  renderProjGrid();
});

document.getElementById("projDetailMore").addEventListener("click", () => {
  const menu = document.getElementById("projMenu");
  menu.hidden = !menu.hidden;
});

document.getElementById("projMenu").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  const list = loadProjects();
  const p = list.find((x) => x.id === viewingProjectId);
  if (!p) return;
  document.getElementById("projMenu").hidden = true;

  if (act === "files") {
    openProjFiles();
  } else if (act === "edit") {
    formDraftFiles = [];
    document.getElementById("projFormTitle").textContent = "编辑项目";
    document.getElementById("projFormSave").textContent = "保存";
    document.getElementById("projFormName").value = p.name;
    document.getElementById("projFormPrefs").value = p.preferences || "";
    renderFormFiles();
    showProjView("projViewForm");
  } else if (act === "clone") {
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = "p_" + Date.now().toString(36);
    copy.name = p.name + " 副本";
    copy.updated = Date.now();
    list.unshift(copy);
    saveProjects(list);
    openProjDetail(copy.id);
  } else if (act === "delete") {
    const ok = await uiConfirm("确定删除项目「" + p.name + "」？");
    if (!ok) return;
    saveProjects(list.filter((x) => x.id !== p.id));
    if (activeProjectId === p.id) setActiveProject(null);
    showProjView("projViewList");
    renderProjGrid();
  }
});

document.getElementById("projUseChatBtn").addEventListener("click", () => {
  setActiveProject(viewingProjectId);
  closeProjectModal();
  void uiAlert("已启用项目，对话会带上项目偏好与文件");
});

document.getElementById("projOpenFilesBtn").addEventListener("click", openProjFiles);

function openProjFiles() {
  showProjView("projViewFiles");
  document.getElementById("projectEditorWrap").hidden = true;
  renderProjBrowser();
}

function renderProjBrowser() {
  const box = document.getElementById("projBrowser");
  const p = loadProjects().find((x) => x.id === viewingProjectId);
  box.innerHTML = "";
  if (!p) return;
  (p.files || []).forEach((f) => {
    const row = document.createElement("div");
    row.className = "proj-browser-row";
    const size = new Blob([f.content || ""]).size;
    row.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' +
      "<span>" +
      escapeHtml(f.path) +
      '</span><span class="meta">' +
      (size < 1024 ? size + " B" : (size / 1024).toFixed(1) + " KB") +
      '</span><div class="row-acts"><button type="button" data-a="dl" title="下载">↓</button><button type="button" data-a="del" title="删除">×</button></div>';
    row.querySelector("span").onclick = () => {
      editingFilePath = f.path;
      document.getElementById("projectEditorWrap").hidden = false;
      document.getElementById("projectEditPath").textContent = f.path;
      document.getElementById("projectFileEditor").value = f.content || "";
    };
    row.querySelector('[data-a="dl"]').onclick = (e) => {
      e.stopPropagation();
      downloadTextFile(f.path.split("/").pop(), f.content || "");
    };
    row.querySelector('[data-a="del"]').onclick = async (e) => {
      e.stopPropagation();
      const ok = await uiConfirm("删除 " + f.path + "？");
      if (!ok) return;
      p.files = p.files.filter((x) => x.path !== f.path);
      p.updated = Date.now();
      const all = loadProjects();
      const i = all.findIndex((x) => x.id === p.id);
      if (i >= 0) all[i] = p;
      saveProjects(all);
      renderProjBrowser();
    };
    box.appendChild(row);
  });
}

document.getElementById("projFilesBack").addEventListener("click", () => {
  openProjDetail(viewingProjectId);
});

document.getElementById("projFilesAdd").addEventListener("click", async () => {
  const path = await uiPrompt("文件名", "new-file.txt", "新建文件");
  if (!path) return;
  const content = await uiPrompt("文件内容", "", "内容");
  const list = loadProjects();
  const p = list.find((x) => x.id === viewingProjectId);
  if (!p) return;
  if (!p.files) p.files = [];
  p.files.push({ path: path.trim(), content: content || "" });
  p.updated = Date.now();
  saveProjects(list);
  renderProjBrowser();
});

document.getElementById("saveProjectFileBtn").addEventListener("click", () => {
  const list = loadProjects();
  const p = list.find((x) => x.id === viewingProjectId);
  if (!p || !editingFilePath) return;
  const f = p.files.find((x) => x.path === editingFilePath);
  if (f) f.content = document.getElementById("projectFileEditor").value;
  p.updated = Date.now();
  saveProjects(list);
  void uiAlert("已保存 " + editingFilePath);
  renderProjBrowser();
});



/* ========== GitHub ========== */
const GH_STORAGE = "ai_github_cfg_v1";

function getGithubConfig() {
  try {
    return JSON.parse(localStorage.getItem(GH_STORAGE) || "{}");
  } catch {
    return {};
  }
}
function saveGithubConfig(cfg) {
  localStorage.setItem(GH_STORAGE, JSON.stringify(cfg || {}));
}

function buildGithubSystemExtra() {
  const cfg = getGithubConfig();
  if (!cfg.token || !cfg.repo) return "";
  return (
    "\n用户已连接 GitHub 仓库「" +
    cfg.repo +
    "」。若需修改仓库文件，请用 markdown 代码块输出完整文件，并在代码块语言行使用 `file:相对路径` 格式（例如 ```file:src/index.js）。用户可一键推送。"
  );
}

async function githubApi(body) {
  const res = await fetch("/api/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "HTTP " + res.status);
  return data;
}

async function pushFilesToGithub(files) {
  const cfg = getGithubConfig();
  if (!cfg.token || !cfg.repo) {
    void uiAlert("请先在菜单「GitHub 仓库」中配置 Token 与仓库");
    return;
  }
  const parts = String(cfg.repo).split("/").filter(Boolean);
  if (parts.length < 2) {
    void uiAlert("仓库格式应为 owner/repo");
    return;
  }
  const owner = parts[0];
  const repo = parts[1];
  const branch = cfg.branch || "main";
  const prefix = (cfg.pathPrefix || "").replace(/^\/+|\/+$/g, "");
  const batch = (files || []).map((f) => {
    let path = String(f.path || "").replace(/^\/+/, "");
    if (prefix) path = prefix + "/" + path;
    return { path, content: f.content || "" };
  }).filter((f) => f.path);

  if (!batch.length) {
    void uiAlert("没有可推送的文件");
    return;
  }

  try {
    // 一次 commit 推送全部文件，只触发 1 次 Cloudflare Pages 构建
    const result = await githubApi({
      action: "batch",
      token: cfg.token,
      owner,
      repo,
      branch,
      message:
        "AI update: " +
        batch
          .map((f) => f.path)
          .slice(0, 4)
          .join(", ") +
        (batch.length > 4 ? " +" + (batch.length - 4) : ""),
      files: batch,
    });
    void uiAlert(
      "已推送 " +
        batch.length +
        " 个文件到 GitHub（1 次提交）。\nCloudflare 将自动部署，请到 Deployments 查看最新一条。"
    );
    console.log("github batch", result);
  } catch (e) {
    console.error(e);
    void uiAlert("推送失败：" + (e.message || e));
  }
}

function openGithubModal() {
  const cfg = getGithubConfig();
  document.getElementById("ghToken").value = cfg.token || "";
  document.getElementById("ghRepo").value = cfg.repo || "";
  document.getElementById("ghBranch").value = cfg.branch || "main";
  document.getElementById("ghPathPrefix").value = cfg.pathPrefix || "";
  document.getElementById("ghStatus").textContent = cfg.token
    ? "已保存配置（Token 已隐藏显示为已填）"
    : "";
  document.getElementById("githubModal").hidden = false;
  closeDrawer();
}
function closeGithubModal() {
  document.getElementById("githubModal").hidden = true;
}

document.getElementById("openGithubBtn")?.addEventListener("click", openGithubModal);
document.getElementById("closeGithub")?.addEventListener("click", closeGithubModal);
document.getElementById("githubMask")?.addEventListener("click", closeGithubModal);
document.getElementById("saveGithub")?.addEventListener("click", () => {
  const cfg = {
    token: document.getElementById("ghToken").value.trim(),
    repo: document.getElementById("ghRepo").value.trim(),
    branch: document.getElementById("ghBranch").value.trim() || "main",
    pathPrefix: document.getElementById("ghPathPrefix").value.trim(),
  };
  saveGithubConfig(cfg);
  document.getElementById("ghStatus").textContent = "已保存";
  void uiAlert("GitHub 配置已保存");
});
document.getElementById("testGithub")?.addEventListener("click", async () => {
  const token = document.getElementById("ghToken").value.trim();
  if (!token) return void uiAlert("请先填写 Token");
  try {
    const d = await githubApi({ action: "test", token });
    document.getElementById("ghStatus").textContent =
      "连接成功：" + (d.login || d.name || "ok");
    void uiAlert("连接成功：@" + (d.login || ""));
  } catch (e) {
    document.getElementById("ghStatus").textContent = "失败：" + e.message;
    void uiAlert("连接失败：" + e.message);
  }
});


document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && chatBusy) {
    // 回到前台时，流可能已断，由 send 内 fallback 处理；此处仅提示
    console.log("[chat] back to foreground while generating");
  }
});

/* 启动 */
resizeCanvas();
loadProfile();
updateProjectBadge();
renderAiNav();
