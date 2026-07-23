# migrate_from_backup.py
import sqlite3
import json
import sys

def log(msg):
    print(msg)

def migrate():
    old_db = 'game1.db'   # 备份数据库
    new_db = 'game.db'    # 新数据库（已创建空表结构）

    log("🔄 开始从 game1.db 迁移数据到 game.db ...")

    # 连接数据库（禁用外键约束以简化导入顺序）
    conn_old = sqlite3.connect(old_db)
    conn_new = sqlite3.connect(new_db)
    conn_new.execute("PRAGMA foreign_keys = OFF")
    cursor_old = conn_old.cursor()
    cursor_new = conn_new.cursor()

    try:
        # ---------- 1. 迁移 story 表 ----------
        log("📥 迁移 story 表...")
        cursor_old.execute("""
            SELECT story_id, story_name, story_desc, is_published, create_time, update_time, is_deleted
            FROM story
        """)
        stories = cursor_old.fetchall()
        for s in stories:
            cursor_new.execute("""
                INSERT OR REPLACE INTO story (story_id, story_name, story_desc, is_published, create_time, update_time, is_deleted)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, s)
        log(f"   ✅ 已迁移 {len(stories)} 条故事记录")

        # ---------- 2. 迁移 story_page 表 ----------
        log("📥 迁移 story_page 表...")
        # 先获取旧表的列名，以便处理可能缺失的字段
        cursor_old.execute("PRAGMA table_info(story_page)")
        old_columns = [col[1] for col in cursor_old.fetchall()]
        has_draft_content = 'draft_content' in old_columns
        has_has_draft = 'has_draft' in old_columns
        has_pos_x = 'pos_x' in old_columns
        has_pos_y = 'pos_y' in old_columns
        has_is_true_ending = 'is_true_ending' in old_columns

        cursor_old.execute("SELECT * FROM story_page")
        pages = cursor_old.fetchall()
        page_count = 0
        for p in pages:
            # 获取列索引
            idx_global_id = 0
            idx_story_id = 1
            idx_local_page_id = 2
            idx_page_type = 3
            idx_content = 4
            idx_options = 5  # 可能不用于本表迁移，但保留
            idx_is_true_ending = old_columns.index('is_true_ending') if has_is_true_ending else None
            idx_draft_content = old_columns.index('draft_content') if has_draft_content else None
            idx_has_draft = old_columns.index('has_draft') if has_has_draft else None
            idx_pos_x = old_columns.index('pos_x') if has_pos_x else None
            idx_pos_y = old_columns.index('pos_y') if has_pos_y else None

            # 映射 page_type
            old_type = p[idx_page_type]  # 'start', 'process', 'ending'
            if old_type == 'start' or old_type == 'process':
                new_type = 'process'
            else:  # 'ending'
                is_true = p[idx_is_true_ending] if idx_is_true_ending is not None else 0
                new_type = 'true_ending' if is_true else 'false_ending'

            # 提取字段
            global_id = p[idx_global_id]
            story_id = p[idx_story_id]
            page_id = p[idx_local_page_id]
            content = p[idx_content]
            draft_content = p[idx_draft_content] if idx_draft_content is not None else None
            has_draft = p[idx_has_draft] if idx_has_draft is not None else 0
            pos_x = p[idx_pos_x] if idx_pos_x is not None else 50
            pos_y = p[idx_pos_y] if idx_pos_y is not None else 50

            cursor_new.execute("""
                INSERT OR REPLACE INTO story_page
                (global_id, story_id, page_id, page_type, content, draft_content, has_draft, pos_x, pos_y)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (global_id, story_id, page_id, new_type, content, draft_content, has_draft, pos_x, pos_y))
            page_count += 1
        log(f"   ✅ 已迁移 {page_count} 条页面记录")

        # ---------- 3. 迁移 story_page_options（从 edges 和 options） ----------
        log("📥 迁移 story_page_options（从 story.edges 和 story_page.options）...")

        # 先检查旧 story 表是否有 edges 字段
        cursor_old.execute("PRAGMA table_info(story)")
        old_story_columns = [col[1] for col in cursor_old.fetchall()]
        has_edges = 'edges' in old_story_columns

        # 存储所有需要插入的选项（去重用）
        options_set = set()

        # 3.1 从 story.edges 导入
        if has_edges:
            cursor_old.execute("SELECT story_id, edges FROM story WHERE edges IS NOT NULL AND edges != ''")
            for story_id, edges_json in cursor_old.fetchall():
                try:
                    edges = json.loads(edges_json)
                    for edge in edges:
                        source = edge.get('source')
                        target = edge.get('target')
                        label = edge.get('label', '')
                        source_anchor = edge.get('sourceAnchor', 'right')
                        target_anchor = edge.get('targetAnchor', 'left')
                        if source and target:
                            key = (story_id, source, target, label, source_anchor, target_anchor)
                            options_set.add(key)
                except json.JSONDecodeError:
                    continue

        # 3.2 从 story_page.options 导入
        cursor_old.execute("SELECT story_id, local_page_id, options FROM story_page WHERE options IS NOT NULL AND options != ''")
        for story_id, source_page, options_json in cursor_old.fetchall():
            try:
                options = json.loads(options_json)
                for opt in options:
                    target = opt.get('jump_local_id')
                    text = opt.get('text', '')
                    if target:
                        # 默认锚点（原 options 中没有锚点信息）
                        key = (story_id, source_page, target, text, 'right', 'left')
                        options_set.add(key)
            except json.JSONDecodeError:
                continue

        # 插入到新表
        option_count = 0
        for (story_id, source_page, target_page, option_text, source_anchor, target_anchor) in options_set:
            # 检查是否已存在（防止重复）
            cursor_new.execute("""
                SELECT 1 FROM story_page_options
                WHERE story_id = ? AND source_page = ? AND target_page = ? AND option_text = ?
            """, (story_id, source_page, target_page, option_text))
            if cursor_new.fetchone() is None:
                cursor_new.execute("""
                    INSERT INTO story_page_options
                    (story_id, source_page, target_page, option_text, source_anchor, target_anchor)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (story_id, source_page, target_page, option_text, source_anchor, target_anchor))
                option_count += 1

        log(f"   ✅ 已迁移 {option_count} 条分支/连线记录")

        # 提交事务
        conn_new.commit()
        log("✅ 所有数据迁移完成！")

    except Exception as e:
        log(f"❌ 迁移过程中出错: {e}")
        conn_new.rollback()
        raise
    finally:
        # 恢复外键约束
        conn_new.execute("PRAGMA foreign_keys = ON")
        conn_old.close()
        conn_new.close()
        log("🔒 数据库连接已关闭")

if __name__ == "__main__":
    migrate()