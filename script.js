// ========== 汉堡菜单 ==========
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
  menuToggle.classList.toggle("active");
  navLinks.classList.toggle("open");
});

// 点击菜单项后自动关闭（手机端）
navLinks.querySelectorAll(".nav-item").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("active");
    navLinks.classList.remove("open");
  });
});

// ========== 背景音乐 ==========
const musicBtn = document.getElementById("musicBtn");
const musicIcon = document.getElementById("musicIcon");
const bgMusic = document.getElementById("bgMusic");

let isPlaying = false;

// 浏览器通常禁止自动播放有声音的媒体，需要用户点击后才能播放
musicBtn.addEventListener("click", async () => {
  try {
    if (isPlaying) {
      bgMusic.pause();
      musicIcon.textContent = "▶";
      isPlaying = false;
    } else {
      await bgMusic.play();
      musicIcon.textContent = "❚❚";
      isPlaying = true;
    }
  } catch (err) {
    console.warn("音乐播放失败，请检查音频源是否可访问：", err);
    alert("音乐加载失败，请检查音频链接是否有效。");
  }
});

// 音乐结束后重置图标（虽然设置了 loop，保险起见）
bgMusic.addEventListener("ended", () => {
  musicIcon.textContent = "▶";
  isPlaying = false;
});

// ========== 导航高亮（滚动时） ==========
const sections = document.querySelectorAll("section[id]");
const navItems = document.querySelectorAll(".nav-item");

function updateActiveNav() {
  const scrollY = window.scrollY + 100;

  sections.forEach((section) => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute("id");

    if (scrollY >= top && scrollY < top + height) {
      navItems.forEach((item) => {
        item.classList.remove("active");
        if (item.getAttribute("href") === `#${id}`) {
          item.classList.add("active");
        }
      });
    }
  });
}

window.addEventListener("scroll", updateActiveNav);
updateActiveNav();