// static/js/reader.js - 剧情页专属逻辑
document.addEventListener("DOMContentLoaded", () => {
    const storyOptions = document.getElementById("storyOptions");
    if (!storyOptions) return; // 不是剧情页直接退出

    // ✅ 从全局变量读取数据（不再用{{ }}）
    const storyId = window.STORY_DATA?.storyId;
    const rawOptions = window.STORY_DATA?.options || [];

    if (!storyId) {
        console.error("未获取到story_id，请检查page.html中的STORY_DATA定义");
        return;
    }

    // 随机打乱选项顺序
    const shuffledOptions = [...rawOptions].sort(() => Math.random() - 0.5);
    
    // 渲染选项
    shuffledOptions.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        // 危险选项（跳转ID>100）标红
        if (opt.jump_local_id > 100) btn.classList.add("danger");
        btn.textContent = opt.text;
        btn.addEventListener("click", () => {
            // 调用公共加载函数
            window.loadPage(storyId, opt.jump_local_id);
        });
        storyOptions.appendChild(btn);
    });
});