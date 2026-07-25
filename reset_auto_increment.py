# reset_auto_increment.py
import sqlite3
import os

def reset_auto_increment():
    db_path = 'game.db'
    if not os.path.exists(db_path):
        print(f"❌ 数据库文件 {db_path} 不存在")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 关闭外键检查，避免操作时冲突
    cursor.execute("PRAGMA foreign_keys = OFF")

    try:
        # ============================================================
        # 1. 重置 story_page 的 global_id
        # ============================================================
        print("🔄 正在重置 story_page.global_id ...")

        # 创建新表（结构相同，但不复制数据）
        cursor.execute("""
            CREATE TABLE story_page_new (
                global_id INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id INTEGER NOT NULL,
                page_id INTEGER NOT NULL,
                page_type TEXT DEFAULT 'process',
                content TEXT NOT NULL,
                draft_content TEXT,
                has_draft BOOLEAN DEFAULT 0,
                pos_x INTEGER DEFAULT 50,
                pos_y INTEGER DEFAULT 50,
                FOREIGN KEY (story_id) REFERENCES story(story_id),
                UNIQUE(story_id, page_id)
            )
        """)

        # 按 story_id, page_id 排序插入旧数据，让 global_id 自动生成
        cursor.execute("""
            INSERT INTO story_page_new (
                story_id, page_id, page_type, content,
                draft_content, has_draft, pos_x, pos_y
            )
            SELECT
                story_id, page_id, page_type, content,
                draft_content, has_draft, pos_x, pos_y
            FROM story_page
            ORDER BY story_id, page_id
        """)

        # 删除旧表，重命名新表
        cursor.execute("DROP TABLE story_page")
        cursor.execute("ALTER TABLE story_page_new RENAME TO story_page")

        print("✅ story_page.global_id 重置完成")

        # ============================================================
        # 2. 重置 story_page_options 的 option_id
        # ============================================================
        print("🔄 正在重置 story_page_options.option_id ...")

        cursor.execute("""
            CREATE TABLE story_page_options_new (
                option_id INTEGER PRIMARY KEY AUTOINCREMENT,
                story_id INTEGER NOT NULL,
                source_page INTEGER NOT NULL,
                target_page INTEGER NOT NULL,
                option_text TEXT NOT NULL,
                source_anchor TEXT DEFAULT 'right',
                target_anchor TEXT DEFAULT 'left',
                FOREIGN KEY (story_id) REFERENCES story(story_id),
                FOREIGN KEY (source_page, story_id) REFERENCES story_page(page_id, story_id),
                FOREIGN KEY (target_page, story_id) REFERENCES story_page(page_id, story_id)
            )
        """)

        # 按 story_id, source_page, target_page 排序插入
        cursor.execute("""
            INSERT INTO story_page_options_new (
                story_id, source_page, target_page,
                option_text, source_anchor, target_anchor
            )
            SELECT
                story_id, source_page, target_page,
                option_text, source_anchor, target_anchor
            FROM story_page_options
            ORDER BY story_id, source_page, target_page
        """)

        cursor.execute("DROP TABLE story_page_options")
        cursor.execute("ALTER TABLE story_page_options_new RENAME TO story_page_options")

        print("✅ story_page_options.option_id 重置完成")

        # 提交事务
        conn.commit()
        print("🎉 所有自增ID已重置并按业务顺序排列")

    except Exception as e:
        conn.rollback()
        print(f"❌ 操作失败: {e}")
    finally:
        # 重新开启外键检查
        cursor.execute("PRAGMA foreign_keys = ON")
        conn.close()

if __name__ == "__main__":
    reset_auto_increment()