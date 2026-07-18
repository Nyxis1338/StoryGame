// static/js/story.js - 公共逻辑，首页/剧情页都能调用
let currentStoryId = null;
let currentPageId = null;

// 核心：无刷新加载单页内容
async function loadPage(storyId, pageId) {
    try {
        const loadingSpinner = document.getElementById("loadingSpinner");
        const readingContent = document.getElementById("readingContent");
        const welcomeScreen = document.getElementById("welcomeScreen");
        const storyContent = document.getElementById("storyContent");
        const storyOptions = document.getElementById("storyOptions");

        // 显示加载动画
        if (loadingSpinner) loadingSpinner.style.display = "block";
        if (readingContent) readingContent.style.opacity = "0.5";

        const res = await fetch(`/api/story/${storyId}/page/${pageId}`);
        const data = await res.json();

        if (data.error) {
            if (storyContent) storyContent.innerHTML = `<p style="color: var(--accent-red);">章节不存在或已损坏</p>`;
            if (storyOptions) storyOptions.innerHTML = "";
            return;
        }

        // 隐藏欢迎屏，显示阅读区
        if (welcomeScreen) welcomeScreen.style.display = "none";
        if (readingContent) readingContent.style.display = "block";

        // 渲染正文
        if (storyContent) storyContent.innerHTML = data.content;

        // 渲染选项（结局页由模板逻辑处理，这里只处理普通页）
        if (storyOptions && data.page_type !== "ending") {
            storyOptions.innerHTML = "";
            const shuffledOptions = [...data.options].sort(() => Math.random() - 0.5);
            shuffledOptions.forEach(opt => {
                const btn = document.createElement("button");
                btn.className = "option-btn";
                if (opt.jump_local_id > 100) btn.classList.add("danger");
                btn.textContent = opt.text;
                btn.addEventListener("click", () => loadPage(storyId, opt.jump_local_id));
                storyOptions.appendChild(btn);
            });
        }

        // 更新地址栏
        history.pushState({}, "", `/story/${storyId}/page/${pageId}`);
        currentStoryId = storyId;
        currentPageId = pageId;

    } catch (err) {
        console.error("加载失败:", err);
        const storyContent = document.getElementById("storyContent");
        if (storyContent) storyContent.innerHTML = `<p style="color: var(--accent-red);">加载失败，请重试</p>`;
    } finally {
        const loadingSpinner = document.getElementById("loadingSpinner");
        const readingContent = document.getElementById("readingContent");
        if (loadingSpinner) loadingSpinner.style.display = "none";
        if (readingContent) readingContent.style.opacity = "1";
    }
}

// 暴露给全局，方便其他JS调用
window.loadPage = loadPage;