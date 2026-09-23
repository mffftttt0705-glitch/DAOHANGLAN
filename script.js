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

/* ========== MP4 → MP3 ========== */
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

let selectedFile = null;
let ffmpeg = null;
let ffmpegLoaded = false;

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

function handleFile(file) {
  const ok =
    file.type.startsWith("video/") ||
    /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);
  if (!ok) {
    alert("请选择视频文件（MP4 / WebM 等）");
    return;
  }
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
  if (downloadLink.href && downloadLink.href.startsWith("blob:")) {
    URL.revokeObjectURL(downloadLink.href);
  }
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function loadFFmpeg() {
  if (ffmpegLoaded) return;

  progressWrap.hidden = false;
  progressText.textContent = "正在加载转换引擎（首次约需几秒）…";
  progressFill.style.width = "8%";

  ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    const pct = Math.min(95, Math.round(progress * 100));
    progressFill.style.width = pct + "%";
    progressText.textContent = "转换中… " + pct + "%";
  });

  const workerURL = new URL("ffmpeg/worker.js", window.location.href).href;
  const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

  await ffmpeg.load({
    coreURL: await toBlobURL(coreBase + "/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL(coreBase + "/ffmpeg-core.wasm", "application/wasm"),
    classWorkerURL: workerURL,
  });

  ffmpegLoaded = true;
  progressFill.style.width = "15%";
  progressText.textContent = "引擎加载完成，开始转换…";
}

convertBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  result.hidden = true;
  progressWrap.hidden = false;
  progressFill.style.width = "0%";
  progressText.textContent = "准备中…";

  try {
    await loadFFmpeg();

    const inputName = "input" + getExt(selectedFile.name);
    const outputName = "output.mp3";

    const data = new Uint8Array(await selectedFile.arrayBuffer());
    await ffmpeg.writeFile(inputName, data);

    progressText.textContent = "正在提取音频…";
    progressFill.style.width = "20%";

    await ffmpeg.exec([
      "-i", inputName,
      "-vn",
      "-acodec", "libmp3lame",
      "-q:a", "2",
      outputName,
    ]);

    progressFill.style.width = "98%";
    progressText.textContent = "生成文件中…";

    const outputData = await ffmpeg.readFile(outputName);
    const blob = new Blob([outputData.buffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (_) {}

    const baseName = selectedFile.name.replace(/\.[^.]+$/, "") || "audio";
    downloadLink.href = url;
    downloadLink.download = baseName + ".mp3";
    downloadLink.textContent = "下载 " + baseName + ".mp3";

    progressFill.style.width = "100%";
    progressText.textContent = "完成！";
    result.hidden = false;
  } catch (err) {
    console.error(err);
    progressText.textContent = "转换失败：" + (err.message || "未知错误");
    alert(
      "转换失败，请确认文件是否为有效视频，或尝试更小的文件。\n\n" +
        (err.message || "")
    );
  } finally {
    convertBtn.disabled = false;
  }
});

function getExt(name) {
  const m = name.match(/\.[^.]+$/);
  return m ? m[0].toLowerCase() : ".mp4";
}

/* 启动 */
resizeCanvas();
loadProfile();
