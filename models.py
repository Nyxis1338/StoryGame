from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

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
    # ✅ 新增软删除字段
    is_deleted = db.Column(db.Boolean, default=0)

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

    draft_content = db.Column(db.Text, nullable=True)
    draft_options = db.Column(db.Text, nullable=True)
    has_draft = db.Column(db.Boolean, default=0)

    __table_args__ = (
        db.UniqueConstraint('story_id', 'local_page_id', name='uq_story_page'),
    )

    def get_options_list(self):
        import json
        if not self.options:
            return []
        try:
            return json.loads(self.options)
        except (json.JSONDecodeError, TypeError):
            return []

    def get_draft_options_list(self):
        import json
        if not self.draft_options:
            return []
        try:
            return json.loads(self.draft_options)
        except (json.JSONDecodeError, TypeError):
            return []

    def set_options_from_list(self, options_list):
        import json
        self.options = json.dumps(options_list, ensure_ascii=False)

    def set_draft_options_from_list(self, options_list):
        import json
        self.draft_options = json.dumps(options_list, ensure_ascii=False)