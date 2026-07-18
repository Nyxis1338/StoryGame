// static/js/index.js - 首页专属逻辑，和其他页面互不干扰
document.addEventListener("DOMContentLoaded", () => {
    const storySearch = document.getElementById("storySearch");
    const searchIcon = document.getElementById("searchIcon");
    const storyList = document.getElementById("storyList");
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const storySidebar = document.getElementById("storySidebar");

    // 1. 搜索过滤逻辑
    function filterStories() {
        if (!storySearch || !storyList) return;
        const keyword = storySearch.value.toLowerCase().trim();
        const cards = storyList.querySelectorAll(".story-card");
        
        cards.forEach(card => {
            const title = card.querySelector(".story-title")?.textContent.toLowerCase() || "";
            const desc = card.querySelector(".story-desc")?.textContent.toLowerCase() || "";
            card.style.display = (title.includes(keyword) || desc.includes(keyword)) ? "block" : "none";
        });
    }

    // 绑定搜索事件：输入、回车、点击搜索图标
    storySearch?.addEventListener("input", filterStories);
    storySearch?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") filterStories();
    });
    searchIcon?.addEventListener("click", filterStories);

    // 2. 开始阅读按钮点击
    document.addEventListener("click", (e) => {
        const startBtn = e.target.closest(".start-read-btn");
        if (startBtn) {
            e.preventDefault();
            const storyId = startBtn.dataset.storyId;
            window.loadPage(storyId, 1); // 调用公共逻辑加载第一章
            // 移动端自动关闭侧边栏
            if (window.innerWidth <= 1024) {
                storySidebar?.classList.remove("active");
            }
        }
    });

    // 3. 移动端菜单切换
    mobileMenuBtn?.addEventListener("click", () => {
        storySidebar?.classList.toggle("active");
    });

    // 4. 浏览器前进/后退支持
    window.addEventListener("popstate", () => {
        const path = window.location.pathname;
        const match = path.match(/\/story\/(\d+)\/page\/(\d+)/);
        if (match) {
            window.loadPage(match[1], match[2]);
        } else {
            // 回到首页，显示欢迎屏
            const welcomeScreen = document.getElementById("welcomeScreen");
            const readingContent = document.getElementById("readingContent");
            if (welcomeScreen) welcomeScreen.style.display = "flex";
            if (readingContent) readingContent.style.display = "none";
        }
    });
});