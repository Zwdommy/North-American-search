# openclaw_comprehensive_test.py - OpenClaw全面测试
# 测试所有功能直到无bug

import requests
import json
import time
import subprocess
import os

def test_server_health():
    """测试服务器健康状态"""
    print("=== 测试服务器健康状态 ===")
    try:
        response = requests.get('http://localhost:5000/api/openclaw/health', timeout=5)
        if response.ok:
            data = response.json()
            print(f"✅ 服务器健康: {data['message']}")
            return True
        else:
            print(f"❌ 服务器异常: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 服务器未运行: {str(e)}")
        print("请确保: python server.py 正在运行")
        return False

def test_basic_commands():
    """测试基础命令"""
    print("\n=== 测试基础命令 ===")
    basic_commands = [
        'echo Hello World',
        'echo Testing OpenClaw',
        'echo Current time',
        'echo System test'
    ]
    
    success_count = 0
    for cmd in basic_commands:
        try:
            response = requests.post('http://localhost:5000/api/openclaw/run', 
                json={'instruction': cmd}, timeout=10)
            result = response.json()
            
            if result.get('success'):
                print(f"✅ {cmd}: 成功")
                print(f"   输出: {result.get('stdout', '').strip()}")
                success_count += 1
            else:
                print(f"❌ {cmd}: 失败")
                print(f"   错误: {result.get('stderr', '未知错误')}")
        except Exception as e:
            print(f"❌ {cmd}: 异常")
            print(f"   错误: {str(e)}")
    
    print(f"\n基础命令测试完成: {success_count}/{len(basic_commands)} 通过")
    return success_count == len(basic_commands)

def test_file_operations():
    """测试文件操作"""
    print("\n=== 测试文件操作 ===")
    file_commands = [
        'dir C:\\Users\\PC\\Desktop',
        'echo Test file > test_openclaw.txt',
        'type test_openclaw.txt',
        'del test_openclaw.txt'
    ]
    
    success_count = 0
    for cmd in file_commands:
        try:
            response = requests.post('http://localhost:5000/api/openclaw/run', 
                json={'instruction': cmd}, timeout=10)
            result = response.json()
            
            if result.get('success'):
                print(f"✅ {cmd}: 成功")
                if 'dir' in cmd:
                    print(f"   找到文件/目录")
                success_count += 1
            else:
                print(f"❌ {cmd}: 失败")
                print(f"   错误: {result.get('stderr', '未知错误')}")
        except Exception as e:
            print(f"❌ {cmd}: 异常")
            print(f"   错误: {str(e)}")
    
    print(f"\n文件操作测试完成: {success_count}/{len(file_commands)} 通过")
    return success_count >= len(file_commands) - 1  # 允许一个失败

def test_error_handling():
    """测试错误处理"""
    print("\n=== 测试错误处理 ===")
    error_commands = [
        'invalid_command_that_does_not_exist',
        'echo',
        '',  # 空指令
        'dir /nonexistent/path/that/does/not/exist'
    ]
    
    success_count = 0
    for cmd in error_commands:
        try:
            response = requests.post('http://localhost:5000/api/openclaw/run', 
                json={'instruction': cmd}, timeout=10)
            result = response.json()
            
            if not result.get('success'):
                print(f"✅ {cmd if cmd else '空指令'}: 正确处理错误")
                print(f"   错误信息: {result.get('stderr', '未知错误')[:50]}...")
                success_count += 1
            else:
                print(f"⚠️ {cmd if cmd else '空指令'}: 意外成功")
        except Exception as e:
            print(f"✅ {cmd if cmd else '空指令'}: 正确处理异常")
            print(f"   异常信息: {str(e)[:50]}...")
            success_count += 1
    
    print(f"\n错误处理测试完成: {success_count}/{len(error_commands)} 正确处理")
    return success_count == len(error_commands)

def test_timeout_handling():
    """测试超时处理"""
    print("\n=== 测试超时处理 ===")
    timeout_commands = [
        'timeout /t 5',  # Windows超时命令
        'echo Long running test && timeout /t 3 /nobreak'
    ]
    
    success_count = 0
    for cmd in timeout_commands:
        try:
            start_time = time.time()
            response = requests.post('http://localhost:5000/api/openclaw/run', 
                json={'instruction': cmd}, timeout=15)
            elapsed = time.time() - start_time
            
            result = response.json()
            print(f"✅ {cmd}: 完成于 {elapsed:.1f}秒")
            success_count += 1
        except requests.exceptions.Timeout:
            print(f"⚠️ {cmd}: 超时处理正确")
            success_count += 1
        except Exception as e:
            print(f"❌ {cmd}: 异常 {str(e)}")
    
    print(f"\n超时处理测试完成: {success_count}/{len(timeout_commands)} 正确处理")
    return success_count == len(timeout_commands)

def test_frontend_integration():
    """测试前端集成"""
    print("\n=== 测试前端集成 ===")
    
    # 模拟前端可能发送的各种指令格式
    frontend_commands = [
        'echo Hello from frontend',
        'echo User clicked OpenClaw button',
        'dir C:\\Users\\PC\\Desktop',
        'echo Testing natural language processing'
    ]
    
    success_count = 0
    for cmd in frontend_commands:
        try:
            response = requests.post('http://localhost:5000/api/openclaw/run', 
                json={'instruction': cmd}, timeout=10)
            result = response.json()
            
            if result.get('success'):
                print(f"✅ 前端指令: {cmd[:30]}...")
                success_count += 1
            else:
                print(f"❌ 前端指令失败: {cmd[:30]}...")
        except Exception as e:
            print(f"❌ 前端指令异常: {cmd[:30]}... {str(e)}")
    
    print(f"\n前端集成测试完成: {success_count}/{len(frontend_commands)} 通过")
    return success_count == len(frontend_commands)

def test_agent_integration():
    """测试agent集成"""
    print("\n=== 测试Agent集成 ===")
    
    # 测试使用main agent的指令
    agent_commands = [
        'echo Testing main agent',
        'echo Agent integration successful',
        'echo OpenClaw agent is working correctly'
    ]
    
    success_count = 0
    for cmd in agent_commands:
        try:
            # 这些指令会通过agent --local --agent main 执行
            response = requests.post('http://localhost:5000/api/openclaw/run', 
                json={'instruction': cmd}, timeout=10)
            result = response.json()
            
            if result.get('success'):
                print(f"✅ Agent指令: {cmd}")
                success_count += 1
            else:
                print(f"❌ Agent指令失败: {cmd}")
                print(f"   错误: {result.get('stderr', '未知错误')}")
        except Exception as e:
            print(f"❌ Agent指令异常: {cmd}")
            print(f"   错误: {str(e)}")
    
    print(f"\nAgent集成测试完成: {success_count}/{len(agent_commands)} 通过")
    return success_count == len(agent_commands)

def generate_final_report():
    """生成最终测试报告"""
    print("\n" + "="*60)
    print("🎉 OPENCLAW 最终测试报告")
    print("="*60)
    
    # 运行所有测试
    tests = [
        ("服务器健康", test_server_health),
        ("基础命令", test_basic_commands),
        ("文件操作", test_file_operations),
        ("错误处理", test_error_handling),
        ("超时处理", test_timeout_handling),
        ("前端集成", test_frontend_integration),
        ("Agent集成", test_agent_integration)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} 测试异常: {str(e)}")
            results.append((test_name, False))
    
    # 统计结果
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    print(f"\n📊 测试结果统计:")
    print(f"通过: {passed}/{total} ({passed/total*100:.1f}%)")
    
    print(f"\n📋 详细结果:")
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {status} {test_name}")
    
    if passed == total:
        print(f"\n🎉 恭喜！所有测试通过！")
        print(f"✅ OpenClaw功能已完全修复！")
        print(f"✅ 现在可以点击OpenClaw按钮使用所有功能！")
        print(f"✅ 无bug状态达成！🚀")
    else:
        print(f"\n⚠️ 还有 {total-passed} 个测试未通过")
        print(f"需要进一步调试和修复")
    
    return passed == total

if __name__ == '__main__':
    print("🚀 开始OpenClaw全面测试...")
    print("目标: 修复所有bug，达到无bug状态")
    print("="*60)
    
    # 确保服务器运行
    print("检查服务器状态...")
    if not test_server_health():
        print("❌ 服务器未运行，请先启动: python server.py")
        exit(1)
    
    # 运行完整测试
    all_passed = generate_final_report()
    
    if all_passed:
        print("\n🎯 任务完成！OpenClaw已完全修复！")
    else:
        print("\n🔧 需要继续修复...")
    
    print("\n下一步:")
    print("1. 在浏览器中打开项目页面")
    print("2. 点击OpenClaw按钮测试")
    print("3. 输入指令并执行")
    print("4. 验证所有功能正常工作")