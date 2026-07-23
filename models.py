import hashlib
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Story(db.Model):
    __tablename__ = 'story'

    story_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    story_name = db.Column(db.String(100), nullable=False)
    story_desc = db.Column(db.Text, nullable=False)
    is_published = db.Column(db.Boolean, default=0)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    update_time = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, default=0)

    # 关联关系
    pages = db.relationship('StoryPage', backref='story', lazy=True, cascade='all, delete-orphan')
    options = db.relationship('StoryPageOption', backref='story', lazy=True, cascade='all, delete-orphan')


class StoryPage(db.Model):
    __tablename__ = 'story_page'

    global_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    story_id = db.Column(db.Integer, db.ForeignKey('story.story_id'), nullable=False)
    page_id = db.Column(db.Integer, nullable=False)          # 原 local_page_id
    page_type = db.Column(db.String(20), default='process')  # process, true_ending, false_ending
    content = db.Column(db.Text, nullable=False)
    draft_content = db.Column(db.Text, nullable=True)
    has_draft = db.Column(db.Boolean, default=0)
    pos_x = db.Column(db.Integer, default=50)
    pos_y = db.Column(db.Integer, default=50)

    __table_args__ = (
        db.UniqueConstraint('story_id', 'page_id', name='uq_story_page'),
    )


class StoryPageOption(db.Model):
    __tablename__ = 'story_page_options'

    option_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    story_id = db.Column(db.Integer, db.ForeignKey('story.story_id'), nullable=False)
    source_page = db.Column(db.Integer, nullable=False)
    target_page = db.Column(db.Integer, nullable=False)
    option_text = db.Column(db.Text, nullable=False)
    source_anchor = db.Column(db.String(10), default='right')
    target_anchor = db.Column(db.String(10), default='left')

    # 外键约束（确保 page_id 存在于 story_page 中）
    __table_args__ = (
        db.ForeignKeyConstraint(
            ['source_page', 'story_id'],
            ['story_page.page_id', 'story_page.story_id']
        ),
        db.ForeignKeyConstraint(
            ['target_page', 'story_id'],
            ['story_page.page_id', 'story_page.story_id']
        ),
        db.UniqueConstraint(
            'story_id', 'source_page', 'target_page', 'source_anchor', 'target_anchor',
            name='uq_unique_edge'
        ),
    )

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