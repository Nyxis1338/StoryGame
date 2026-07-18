from user import create_user_app
from admin import create_admin_app
import multiprocessing
import config

def run_user():
    """运行读者端服务"""
    user_app = create_user_app()
    user_app.run(
        port=config.USER_PORT,
        debug=True,
        use_reloader=False,  # 多进程下禁用重载器
        host="0.0.0.0"
    )

def run_admin():
    """运行管理端服务"""
    admin_app = create_admin_app()
    admin_app.run(
        port=config.ADMIN_PORT,
        debug=True,
        use_reloader=False,  # 多进程下禁用重载器
        host="127.0.0.1"    # 仅本地访问
    )

if __name__ == "__main__":
    # 创建两个进程
    user_process = multiprocessing.Process(target=run_user)
    admin_process = multiprocessing.Process(target=run_admin)
    
    # 启动进程
    user_process.start()
    admin_process.start()
    
    print(f"读者端运行在: http://0.0.0.0:{config.USER_PORT}")
    print(f"管理端运行在: http://127.0.0.1:{config.ADMIN_PORT}")
    
    try:
        # 等待进程结束
        user_process.join()
        admin_process.join()
    except KeyboardInterrupt:
        print("\n正在关闭服务...")
        user_process.terminate()
        admin_process.terminate()
        user_process.join()
        admin_process.join()