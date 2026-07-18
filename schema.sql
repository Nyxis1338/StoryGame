DROP TABLE IF EXISTS story_page;
DROP TABLE IF EXISTS story;
DROP TABLE IF EXISTS admin_config;

-- 管理员配置表：存储后台操作密码
CREATE TABLE admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_pwd TEXT NOT NULL
);

-- 插入初始管理员密码 storygame
INSERT INTO admin_config(admin_pwd) VALUES ('storygame');

-- 故事主表不变
CREATE TABLE story (
    story_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_name TEXT NOT NULL,
    story_desc TEXT NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 剧情页面表（全局global_id + 故事内local_page_id）
CREATE TABLE story_page (
    global_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    local_page_id INTEGER NOT NULL,
    page_type TEXT NOT NULL CHECK(page_type IN ('start','process','ending')),
    content TEXT NOT NULL,
    options TEXT NOT NULL,
    is_true_ending INTEGER DEFAULT 0 CHECK(is_true_ending IN (0,1)),
    pos_x INTEGER DEFAULT 50,  -- 新增：思维导图X坐标
    pos_y INTEGER DEFAULT 50,  -- 新增：思维导图Y坐标
    UNIQUE(story_id, local_page_id),
    FOREIGN KEY (story_id) REFERENCES story(story_id)
);

-- ========== 故事1：别墅毒杀案 ==========
INSERT INTO story(story_name, story_desc)
VALUES ('别墅毒杀案', '经典侦探推理剧本，找出别墅下毒的真凶');

INSERT INTO story_page(story_id, local_page_id, page_type, content, options, is_true_ending) VALUES
(1,
1,
'start',
'# 别墅毒杀案 开篇
深夜私人别墅，富豪倒在书房书桌前，桌上一杯红茶残留毒物。
管家、妻子、生意伙伴三人都有作案动机。你作为到场侦探，第一步该做什么？',
'[{"text":"直接审问富豪妻子，认定她有动机","jump_local_id":3},{"text":"先检查红茶杯残留物，化验毒物","jump_local_id":2}]',
0),

(1,
2,
'process',
'你检测茶杯，杯壁只有富豪指纹，但杯底有微量安眠药粉末。管家承认红茶是他冲泡，但声称无下毒机会。',
'[{"text":"搜查管家储物间","jump_local_id":4},{"text":"传唤生意伙伴问话","jump_local_id":5}]',
0),

(1,
4,
'ending',
'真相揭晓：管家长期被富豪克扣工资，安眠药混合慢性毒药放入红茶，证据完整，推理完全正确！案件告破。',
'[]',
1),

(1,
5,
'ending',
'你误将妻子定为凶手，遗漏茶杯毒物关键线索，真正凶手逍遥法外，案件成为悬案。',
'[]',
0);

-- ========== 故事2：美术馆失窃案 ==========
INSERT INTO story(story_name, story_desc)
VALUES ('美术馆失窃案', '知名油画深夜被盗，四位嫌疑人各有谎言，找出真正的窃贼');

INSERT INTO story_page(story_id, local_page_id, page_type, content, options, is_true_ending) VALUES
(2,
1,
'start',
'# 美术馆失窃案
凌晨两点，市美术馆镇馆之宝《秋日湖面》失窃。
安保系统被人为关闭，监控全部损坏。
四位嫌疑人：保洁阿姨、值班保安、油画修复师、参展富商。
馆长委托你前来调查，你第一步选择调查谁？',
'[{"text":"立刻单独询问值班保安","jump_local_id":3},{"text":"先查看失窃展厅现场痕迹","jump_local_id":2}]',
0),

(2,
2,
'process',
'展厅地面留有细小油画颜料碎屑，颜色与失窃画作底色完全一致。墙角掉落一枚刻着修复工坊logo的金属小刀。
保洁称昨晚未进入展厅；保安说监控是设备自然故障。',
'[{"text":"传唤油画修复师对峙小刀线索","jump_local_id":4},{"text":"搜查富商随身背包","jump_local_id":5}]',
0),

(2,
3,
'process',
'保安一口咬定没有任何人深夜进入展厅，说辞毫无破绽。你忽略了现场物证，错失关键线索。',
'[{"text":"返回展厅重新勘察痕迹","jump_local_id":2},{"text":"直接审问修复师","jump_local_id":6}]',
0),

(2,
4,
'process',
'修复师看到小刀瞬间神色慌乱，承认工具是自己的，但声称上周不慎遗失。
你调取工坊出库记录，案发前三天他领取了同款溶剂，可溶解画框固定胶。',
'[{"text":"申请搜查修复师工作室","jump_local_id":7},{"text":"相信修复师说辞，转而去盘问富商","jump_local_id":5}]',
0),

(2,
5,
'ending',
'你全程怀疑富商，没有追踪颜料与工具线索。真正的修复师带着油画连夜出城，案件无法侦破。',
'[]',
0),

(2,
6,
'ending',
'没有现场物证支撑，修复师拒不认罪，缺少关键证据，只能无罪释放，画作下落不明。',
'[]',
0),

(2,
7,
'ending',
'在修复师工作室夹层找到完整失窃油画，颜料碎屑、专用工具、溶剂记录形成完整证据链。修复师因债务铤而走险，推理成功！',
'[]',
1);


-- 草稿故事表
CREATE TABLE IF NOT EXISTS story_draft (
    draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER,  -- 关联正式表
    draft_data TEXT NOT NULL,  -- JSON格式存储草稿
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES story(story_id) ON DELETE CASCADE
);

-- 草稿剧情页表
CREATE TABLE IF NOT EXISTS story_page_draft (
    draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER,
    local_page_id INTEGER,
    draft_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES story(story_id) ON DELETE CASCADE
);