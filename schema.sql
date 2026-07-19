-- 管理员配置表
CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_pwd TEXT NOT NULL
);

-- 故事表
CREATE TABLE IF NOT EXISTS story (
    story_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_name TEXT NOT NULL,
    story_desc TEXT NOT NULL,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_published BOOLEAN DEFAULT 0
);

-- 故事草稿表（故事级别）
CREATE TABLE IF NOT EXISTS story_draft (
    draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER,
    draft_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES story(story_id) ON DELETE CASCADE
);

-- 故事页面表（正式数据）
CREATE TABLE IF NOT EXISTS story_page (
    global_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    local_page_id INTEGER NOT NULL,
    page_type TEXT NOT NULL CHECK(page_type IN ('start','process','ending')),
    content TEXT NOT NULL,
    options TEXT NOT NULL,  -- JSON格式：[{"text":"选项","jump_local_id":2}]
    is_true_ending INTEGER DEFAULT 0 CHECK(is_true_ending IN (0,1)),
    pos_x INTEGER DEFAULT 50,
    pos_y INTEGER DEFAULT 50,
    UNIQUE(story_id, local_page_id),
    FOREIGN KEY (story_id) REFERENCES story(story_id)
);

-- 故事页面草稿表（页面级别）
CREATE TABLE IF NOT EXISTS story_page_draft (
    draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER NOT NULL,
    local_page_id INTEGER NOT NULL,
    draft_data TEXT NOT NULL,  -- JSON格式：完整页面数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES story(story_id) ON DELETE CASCADE
);

-- 初始化管理员密码
INSERT INTO admin_config (admin_pwd) VALUES ('storygame');

-- 插入6个故事的基本信息
INSERT INTO story (story_name, story_desc, is_published) VALUES
('别墅毒杀案', '经典侦探推理剧本，找出别墅下毒的真凶', 1),
('美术馆失窃案', '知名油画深夜被盗，四位嫌疑人各有谎言，找出真正的窃贼', 1),
('校园画室失踪案', '美术社团深夜画室，一幅参赛原画凭空消失，锁定四名社团成员，找出偷画之人', 1),
('古董店午夜失窃案', '深夜古董店价值百万的玉佩消失，门窗完好，嫌疑人共四人：守店老人、学徒、古玩买家、保洁阿姨，多条线索分散在不同分支，集齐物证才能锁定真凶', 1),
('山间民宿失踪游客案', '深山民宿一名女游客一夜之间凭空消失，民宿仅有5人留宿，山路昨夜封闭无法下山，多条隐藏线索分布在不同调查分支，错选分支会永久丢失关键证据', 1),
('雨夜别墅遗产案', '暴雨封山深夜，独居富豪死于书房，遗嘱离奇失踪。四名亲属全员撒谎、互相包庇、制造伪证，存在完美伪真相陷阱，需要深挖隐藏物证才能击穿双层谎言，找到真正幕后凶手。', 1);