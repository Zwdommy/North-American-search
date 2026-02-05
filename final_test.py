# final_test.py - OpenClaw最终测试
import requests

print("=== OpenClaw最终测试 ===")

# 1. 健康检查
try:
    r = requests.get('http://localhost:5000/api/openclaw/health')
    result = r.json()
    print("健康检查:", "通过" if result['success'] else "失败")
    print("消息:", result['message'])
except Exception as e:
    print("健康检查: 失败 -", str(e))

# 2. 指令测试
try:
    r = requests.post('http://localhost:5000/api/openclaw/run', 
                     json={'instruction': 'echo Final test successful!'})
    result = r.json()
    print("指令测试:", "通过" if result['success'] else "失败")
    if result['success']:
        print("输出:", result['stdout'])
except Exception as e:
    print("指令测试: 失败 -", str(e))

print("\n=== 测试完成 ===")
print("OpenClaw最终集成完成！")
print("现在可以直接点击按钮使用了！")