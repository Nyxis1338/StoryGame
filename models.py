from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import hashlib

db = SQLAlchemy()


class Story(db.Model):
    __tablename__ = 'story'

    story_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    story_name = db.Column(db.String(100), nullable=False)
    story_desc = db.Column(db.Text, nullable=False)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    is_published = db.Column(db.Boolean, default=0)
    has_draft = db.Column(db.Boolean, default=0)
    update_time = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, default=0)
    edges = db.Column(db.JSON, default=list)

    pages = db.relationship(
        'StoryPage',
        backref='story',
        lazy=True,
        cascade='all, delete-orphan'
    )


class StoryPage(db.Model):
    __tablename__ = 'story_page'

    global_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    story_id = db.Column(db.Integer, db.ForeignKey('story.story_id'), nullable=False)
    local_page_id = db.Column(db.Integer, nullable=False)
    page_type = db.Column(db.String(20), default='process')
    content = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text, nullable=False, default='[]')
    is_true_ending = db.Column(db.Integer, default=0)
    pos_x = db.Column(db.Integer, default=50)
    pos_y = db.Column(db.Integer, default=50)

    # 草稿字段
    draft_content = db.Column(db.Text, nullable=True)
    draft_options = db.Column(db.Text, nullable=True)
    has_draft = db.Column(db.Boolean, default=0)

    __table_args__ = (
        db.UniqueConstraint('story_id', 'local_page_id', name='uq_story_page'),
    )

    def get_options_list(self):
        """将 options JSON 字符串解析为 Python 列表"""
        import json
        if not self.options:
            return []
        try:
            return json.loads(self.options)
        except (json.JSONDecodeError, TypeError):
            return []

    def get_draft_options_list(self):
        """将 draft_options JSON 字符串解析为 Python 列表"""
        import json
        if not self.draft_options:
            return []
        try:
            return json.loads(self.draft_options)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_options_from_list(self, options_list):
        """将 Python 列表转为 JSON 字符串存入 options"""
        import json
        self.options = json.dumps(options_list, ensure_ascii=False)

    def set_draft_options_from_list(self, options_list):
        """将 Python 列表转为 JSON 字符串存入 draft_options"""
        import json
        self.draft_options = json.dumps(options_list, ensure_ascii=False)


class AdminConfig(db.Model):
    """管理员配置表 - 存储密码等配置"""
    __tablename__ = 'admin_config'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    admin_pwd = db.Column(db.String(64), nullable=False)

    @staticmethod
    def hash_password(password):
        """MD5 加密密码"""
        return hashlib.md5(password.encode()).hexdigest()

    def verify_password(self, password):
        """验证密码是否正确"""
        return self.admin_pwd == self.hash_password(password)