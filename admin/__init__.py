from flask import Flask
from .routes import bp as admin_bp
import config

def create_admin_app():
    app = Flask(
        __name__,
        template_folder="templates",
        static_folder="../static"  # 共用根目录static
    )
    app.config.from_object("config")
    app.secret_key = config.SECRET_KEY
    app.register_blueprint(admin_bp)
    return app