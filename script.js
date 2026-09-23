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

/* ========== 视频 → MP3（浏览器原生解码 + lamejs，不依赖 ffmpeg） ========== */
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

const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_DURATION_SEC = 5 * 60 + 15;
const VIDEO_EXT_RE =
  /\.(mp4|webm|mov|mkv|avi|flv|wmv|m4v|3gp|ts|mts|m2ts|mpeg|mpg|mpe|ogv|vob|asf|rm|rmvb|f4v|divx|xvid|mp3|m4a|aac|wav|ogg|flac|wma)$/i;

let selectedFile = null;
let lastBlobUrl = null;
let lameReady = null;

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

function probeDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.playsInline = true;
    el.muted = true;
    const done = (sec) => {
      URL.revokeObjectURL(url);
      try {
        el.removeAttribute("src");
        el.load();
      } catch (_) {}
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
    alert("请选择视频或音频文件\n支持：MP4 / MOV / MKV / WebM / AVI 等手机能播放的格式");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    alert("文件过大（" + formatSize(file.size) + "），建议不超过 150MB。");
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
    alert("视频时长约 " + Math.round(duration) + " 秒，超过 5 分钟限制。");
    return;
  }

  selectedFile = file;
  let label = file.name + "（" + formatSize(file.size) + "）";
  if (duration != null) label += " · " + formatDuration(duration);
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

function floatTo16BitPCM(float32Array) {
  const out = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** 加载 lamejs（MP3 编码器，体积小，手机友好） */
function loadLame() {
  if (lameReady) return lameReady;
  lameReady = new Promise((resolve, reject) => {
    if (window.lamejs) {
      resolve(window.lamejs);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js";
    s.onload = () => {
      if (window.lamejs) resolve(window.lamejs);
      else reject(new Error("lamejs 加载失败"));
    };
    s.onerror = () => {
      // 备用镜像
      const s2 = document.createElement("script");
      s2.src = "https://unpkg.com/lamejs@1.2.1/lame.min.js";
      s2.onload = () => {
        if (window.lamejs) resolve(window.lamejs);
        else reject(new Error("lamejs 加载失败"));
      };
      s2.onerror = () => reject(new Error("无法加载 MP3 编码器，请检查网络"));
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  });
  return lameReady;
}

/**
 * 用浏览器解码视频音轨 → PCM → lamejs 编码 MP3
 *
 * 关键修复：
 * 1. video 不能静音（部分浏览器静音后不向 WebAudio 输出音轨）
 * 2. 音频链末端不能设为 gain=0，否则浏览器会优化掉整条处理链，
 *    导致 ScriptProcessor 收不到数据。这里用 silentGain 仍为 0，
 *    但 processor 先连 silentGain 再连 destination，确保 processor 被驱动。
 * 3. play 前后各等待一小段，保证 ScriptProcessor 有数据产出。
 * 4. 结束前多等 500ms，避免丢掉最后一批缓冲。
 * 5. 增加静音检测，采集到静音时直接抛错，避免导出无声文件。
 */
async function convertWithWebAudio(file, onProgress) {
  const lamejs = await loadLame();
  onProgress(8, "准备解码…");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.controls = false;
  // 不要静音，否则部分浏览器不输出音轨到 WebAudio
  video.muted = false;
  video.volume = 1;

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("视频加载超时，请确认格式手机能播放")), 20000);
    video.onloadedmetadata = () => {
      clearTimeout(t);
      resolve();
    };
    video.onerror = () => {
      clearTimeout(t);
      reject(new Error("无法解码该视频，请换 MP4（H.264）格式"));
    };
  });

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error("无法读取视频时长");
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  const source = audioCtx.createMediaElementSource(video);

  // 关键：不要设 gain=0 直接连 destination，
  // 用 silentGain 作为末端静音，但 processor 会被驱动。
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;

  const bufferSize = 4096;
  const processor = audioCtx.createScriptProcessor(bufferSize, 2, 2);
  const leftChunks = [];
  const rightChunks = [];
  let totalSamples = 0;

  processor.onaudioprocess = (e) => {
    const left = e.inputBuffer.getChannelData(0);
    const right =
      e.inputBuffer.numberOfChannels > 1
        ? e.inputBuffer.getChannelData(1)
        : left;
    leftChunks.push(new Float32Array(left));
    rightChunks.push(new Float32Array(right));
    totalSamples += left.length;
  };

  // 信号链：source -> processor -> silentGain -> destination
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  onProgress(12, "正在提取音频…");

  // 等音频上下文真正开始运行
  await new Promise((r) => setTimeout(r, 100));

  try {
    video.playbackRate = 1;
    await video.play();
  } catch (e) {
    // 自动播放失败时尝试静音播放
    video.muted = true;
    await video.play();
  }

  // 等 ScriptProcessor 开始产出数据
  await new Promise((r) => setTimeout(r, 300));

  await new Promise((resolve, reject) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    const tick = () => {
      if (resolved) return;
      if (video.ended) {
        finish();
        return;
      }
      if (video.error) {
        reject(new Error("播放失败，无法提取音轨"));
        return;
      }
      const p = video.currentTime / duration;
      onProgress(12 + Math.min(55, Math.round(p * 55)), "提取音频 " + Math.round(p * 100) + "%");
      requestAnimationFrame(tick);
    };
    video.onended = finish;
    video.onerror = () => reject(new Error("播放失败，无法提取音轨"));
    setTimeout(finish, (duration + 2) * 1000);
    tick();
  });

  // 收尾：等待最后一批缓冲数据通过 processor
  await new Promise((r) => setTimeout(r, 500));

  try {
    processor.disconnect();
    source.disconnect();
    silentGain.disconnect();
  } catch (_) {}
  try {
    video.pause();
    video.removeAttribute("src");
    video.load();
  } catch (_) {}
  URL.revokeObjectURL(url);
  const sampleRate = audioCtx.sampleRate;
  try {
    await audioCtx.close();
  } catch (_) {}

  if (totalSamples < 1000) {
    throw new Error("未采集到有效音轨（视频可能无声音，或浏览器限制了音频采集）");
  }

  // 静音检测：抽样检查最大振幅
  let maxAmp = 0;
  for (let i = 0; i < leftChunks.length; i++) {
    const chunk = leftChunks[i];
    for (let j = 0; j < chunk.length; j += 100) {
      const v = Math.abs(chunk[j]);
      if (v > maxAmp) maxAmp = v;
    }
    if (maxAmp > 0.001) break;
  }
  if (maxAmp < 0.0001) {
    throw new Error("采集到的音频为静音，浏览器可能阻止了音轨输出");
  }

  onProgress(70, "正在编码 MP3…");

  // 合并通道
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < leftChunks.length; i++) {
    left.set(leftChunks[i], offset);
    right.set(rightChunks[i], offset);
    offset += leftChunks[i].length;
  }

  // 目标采样率 44100：若设备采样率不同，简单抽取/重复（够用）
  let L = left;
  let R = right;
  let rate = sampleRate;
  if (Math.abs(sampleRate - 44100) > 100) {
    const ratio = sampleRate / 44100;
    const newLen = Math.floor(totalSamples / ratio);
    L = new Float32Array(newLen);
    R = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const idx = Math.min(totalSamples - 1, Math.floor(i * ratio));
      L[i] = left[idx];
      R[i] = right[idx];
    }
    rate = 44100;
  }

  const mp3encoder = new lamejs.Mp3Encoder(2, rate, 128);
  const block = 1152;
  const mp3Data = [];
  const totalBlocks = Math.ceil(L.length / block);

  for (let i = 0; i < L.length; i += block) {
    const leftChunk = floatTo16BitPCM(L.subarray(i, i + block));
    const rightChunk = floatTo16BitPCM(R.subarray(i, i + block));
    const buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (buf.length > 0) mp3Data.push(buf);
    if (i % (block * 20) === 0) {
      const p = i / L.length;
      onProgress(70 + Math.round(p * 25), "编码 MP3 " + Math.round(p * 100) + "%");
    }
  }
  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  onProgress(98, "生成文件…");
  return new Blob(mp3Data, { type: "audio/mpeg" });
}

/**
 * 备用：MediaRecorder 录制（可能得到 m4a/webm，再提示）
 */
async function convertWithMediaRecorder(file, onProgress) {
  onProgress(10, "使用备用方案提取…");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.muted = false;
  video.volume = 1;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("无法加载视频"));
    setTimeout(() => reject(new Error("加载超时")), 15000);
  });

  if (!video.captureStream && !video.mozCaptureStream) {
    URL.revokeObjectURL(url);
    throw new Error("当前浏览器不支持音轨采集");
  }

  await video.play();
  const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length) {
    video.pause();
    URL.revokeObjectURL(url);
    throw new Error("没有音轨可提取");
  }
  const audioStream = new MediaStream(audioTracks);

  let mime = "";
  const candidates = [
    "audio/mp4",
    "audio/mpeg",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  for (const m of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) {
      mime = m;
      break;
    }
  }
  if (!mime) {
    video.pause();
    URL.revokeObjectURL(url);
    throw new Error("浏览器不支持录音编码");
  }

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
      onProgress(10 + Math.min(80, Math.round(p * 80)), "提取中 " + Math.round(p * 100) + "%");
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
    progressText.textContent = ext === "mp3" ? "完成！" : "完成（备用格式 " + ext + "）";
    result.hidden = false;
  } catch (err) {
    console.error(err);
    const msg = String(err && err.message ? err.message : err);
    let tip = "转换失败：" + msg;
    if (/decode|无法解码|不支持/i.test(msg)) {
      tip = "无法解码该视频。请导出为手机常见的 MP4（H.264 + AAC）后再试。";
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