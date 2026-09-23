import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const PASSWORD = "@55ff";
const STORAGE_KEY = "nav_profile_v1";

/* ========== 个人资料 DOM ========== */
const avatarImg = document.getElementById("avatarImg");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");
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
const saveBtn = document.getElementById("saveBtn");

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
  avatarUrlInput.value = data.avatarUrl || "";
  bgUrlInput.value = data.bgUrl || "";

  if (data.avatarUrl) {
    avatarImg.src = data.avatarUrl;
    avatarImg.hidden = false;
    avatarPlaceholder.hidden = true;
  } else {
    avatarImg.hidden = true;
    avatarPlaceholder.hidden = false;
    avatarImg.removeAttribute("src");
  }

  if (data.bgUrl) {
    customBg.style.backgroundImage = `url("${data.bgUrl}")`;
    customBg.classList.add("show");
  } else {
    customBg.style.backgroundImage = "";
    customBg.classList.remove("show");
  }
}

function saveProfile(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  applyProfile(data);
}

/* 文件转 base64（用于本地上传头像/背景，存 localStorage） */
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
  if (pwdInput.value === PASSWORD) {
    settingsForm.hidden = false;
  } else {
    settingsForm.hidden = true;
  }
});

saveBtn.addEventListener("click", async () => {
  if (pwdInput.value !== PASSWORD) {
    alert("密码错误");
    return;
  }

  let avatarUrl = avatarUrlInput.value.trim();
  let bgUrl = bgUrlInput.value.trim();

  if (avatarFileInput.files[0]) {
    try {
      avatarUrl = await fileToDataURL(avatarFileInput.files[0]);
    } catch {
      alert("头像读取失败");
      return;
    }
  }

  if (bgFileInput.files[0]) {
    try {
      bgUrl = await fileToDataURL(bgFileInput.files[0]);
    } catch {
      alert("背景图读取失败");
      return;
    }
  }

  try {
    saveProfile({
      name: nameInput.value.trim(),
      bio: bioInput.value.trim(),
      avatarUrl,
      bgUrl,
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
loadProfile();