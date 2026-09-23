import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

/* ========== DOM ========== */
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

/* ========== 文件选择 ========== */
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

/* ========== 加载 ffmpeg ==========
 * Worker 必须从本站同域名加载，否则会报：
 * Failed to construct 'Worker': Script at '...cdn.../worker.js' cannot be accessed from origin '...'
 * core / wasm 体积大，用 CDN + toBlobURL 即可（blob 不触发跨域 Worker 限制）
 */
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

  // 本站 worker（解决跨域）
  const workerURL = new URL("ffmpeg/worker.js", window.location.href).href;

  // core / wasm 仍走 CDN，转成 blob 避免 CORS
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

/* ========== 转换 ========== */
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
