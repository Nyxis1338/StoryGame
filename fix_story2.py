import sqlite3
import json
import os

DB_PATH = "game.db"
TARGET_STORY_ID = 2  # 明确指向你要的第2个故事

def fix_story2():
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件不存在：{DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        # 1. 先彻底清空story_id=2的所有旧草稿，打印删除数量
        cur.execute("DELETE FROM story_page_draft WHERE story_id = ?", (TARGET_STORY_ID,))
        deleted_count = cur.rowcount
        print(f"✅ 已清空story_id={TARGET_STORY_ID}的旧草稿，共删除{deleted_count}条数据")

        # 2. 从正式表读取story_id=2的真实数据（包括你存的options）
        formal_pages = cur.execute("""
            SELECT local_page_id, content, options, page_type, is_true_ending
            FROM story_page
            WHERE story_id = ?
            ORDER BY local_page_id
        """, (TARGET_STORY_ID,)).fetchall()

        if not formal_pages:
            print(f"❌ 正式表中没有story_id={TARGET_STORY_ID}的数据，请先确认故事存在")
            return

        # 3. 给每个页面设置初始坐标（避免叠放），并打包成草稿格式
        inserted_count = 0
        for idx, page in enumerate(formal_pages):
            local_page_id = page["local_page_id"]
            # 自动生成初始坐标：横向排列，每行4个
            pos_x = 150 + (idx % 4) * 250
            pos_y = 200 + (idx // 4) * 180

            # 解析正式表的options（你的真实JSON数据）
            try:
                options = json.loads(page["options"]) if page["options"] else []
            except json.JSONDecodeError:
                print(f"⚠️ 页面{local_page_id}的options格式错误，已设为空数组")
                options = []

            draft_data = {
                "content": page["content"],
                "options": options,  # 用你正式表里的真实options
                "page_type": page["page_type"],
                "is_true_ending": page["is_true_ending"],
                "pos_x": pos_x,
                "pos_y": pos_y
            }

            # 插入草稿表
            cur.execute("""
                INSERT INTO story_page_draft (story_id, local_page_id, draft_data)
                VALUES (?, ?, ?)
            """, (TARGET_STORY_ID, local_page_id, json.dumps(draft_data, ensure_ascii=False)))
            inserted_count += 1

        # 4. 提交事务，确认结果
        conn.commit()
        print(f"✅ 成功同步{TARGET_STORY_ID}号故事的{inserted_count}个页面到草稿表")
        print(f"✅ 所有选项已同步，可正常显示在编辑弹窗中")

        # 5. 验证：查询草稿表的数据，确认options存在
        verify = cur.execute("""
            SELECT local_page_id, draft_data 
            FROM story_page_draft 
            WHERE story_id = ?
            ORDER BY local_page_id
        """, (TARGET_STORY_ID,)).fetchall()

        print("\n----- 验证草稿数据 -----")
        for row in verify:
            data = json.loads(row["draft_data"])
            opt_count = len(data.get("options", []))
            print(f"页面{row['local_page_id']}：包含{opt_count}个选项")
        print("------------------------")

    except Exception as e:
        conn.rollback()
        print(f"❌ 执行失败，已回滚：{e}")
    finally:
        conn.close()

if __name__ == "__main__":
    # 先确认story_id对应正确（可选，运行前注释掉）
    # confirm()
    fix_story2()