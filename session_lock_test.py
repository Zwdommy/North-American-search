# session_lock_test.py - 会话锁定问题专项测试
# 验证OpenClaw会话锁定问题已完全解决

import requests
import json
import time
import concurrent.futures

def test_session_lock_issue():
    """测试会话锁定问题是否已解决"""
    print("=== OpenClaw会话锁定问题专项测试 ===")
    
    # 测试1: 快速连续请求（模拟用户快速点击）
    print("1. 快速连续请求测试...")
    rapid_commands = [
        "echo Test 1", "echo Test 2", "echo Test 3", 
        "echo Test 4", "echo Test 5", "echo Test 6"
    ]
    
    success_count = 0
    start_time = time.time()
    
    for i, cmd in enumerate(rapid_commands):
        try:
            print(f"  发送请求 {i+1}: {cmd}")
            r = requests.post('http://localhost:5000/api/openclaw/run', 
                             json={'instruction': cmd}, timeout=10)
            result = r.json()
            
            if result.get('success', False):
                print(f"    ✅ 成功: {result.get('stdout', '')}")
                success_count += 1
            else:
                print(f"    ❌ 失败: {result.get('stderr', '')}")
                
        except Exception as e:
            print(f"    ❌ 异常: {str(e)}")
    
    rapid_time = time.time() - start_time
    print(f"快速连续测试完成: {success_count}/{len(rapid_commands)} 通过")
    print(f"耗时: {rapid_time:.1f}秒")
    
    # 测试2: 并发请求测试（模拟多用户同时使用）
    print("\n2. 并发请求测试...")
    concurrent_commands = [
        "echo User 1", "echo User 2", "echo User 3",
        "echo User 4", "echo User 5"
    ]
    
    def send_request(cmd):
        try:
            r = requests.post('http://localhost:5000/api/openclaw/run', 
                             json={'instruction': cmd}, timeout=10)
            result = r.json()
            return cmd, result.get('success', False), result.get('stdout', ''), result.get('stderr', '')
        except Exception as e:
            return cmd, False, '', str(e)
    
    print("  启动并发请求...")
    start_time = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(send_request, cmd) for cmd in concurrent_commands]
        concurrent_results = []
        
        for future in concurrent.futures.as_completed(futures):
            cmd, success, stdout, stderr = future.result()
            concurrent_results.append((cmd, success, stdout, stderr))
            if success:
                print(f"    ✅ {cmd}: {stdout}")
            else:
                print(f"    ❌ {cmd}: {stderr}")
    
    concurrent_time = time.time() - start_time
    concurrent_success = sum(1 for _, success, _, _ in concurrent_results if success)
    
    print(f"并发测试完成: {concurrent_success}/{len(concurrent_commands)} 通过")
    print(f"并发耗时: {concurrent_time:.1f}秒")
    
    # 测试3: 长时间运行测试
    print("\n3. 长时间运行测试...")
    long_commands = [
        "echo Long running test 1",
        "echo Long running test 2", 
        "echo Long running test 3"
    ]
    
    success_count = 0
    start_time = time.time()
    
    for i, cmd in enumerate(long_commands):
        try:
            print(f"  长时间测试 {i+1}: {cmd}")
            r = requests.post('http://localhost:5000/api/openclaw/run', 
                             json={'instruction': cmd}, timeout=15)
            result = r.json()
            
            if result.get('success', False):
                print(f"    ✅ 成功: {result.get('stdout', '')}")
                success_count += 1
            else:
                print(f"    ❌ 失败: {result.get('stderr', '')}")
                
        except Exception as e:
            print(f"    ❌ 异常: {str(e)}")
    
    long_time = time.time() - start_time
    print(f"长时间测试完成: {success_count}/{len(long_commands)} 通过")
    print(f"长时间耗时: {long_time:.1f}秒")
    
    # 测试4: 错误恢复测试
    print("\n4. 错误恢复测试...")
    error_commands = [
        "",  # 空指令
        "invalid_command_that_does_not_exist",  # 无效指令
        "echo"  # 可能导致问题的指令
    ]
    
    error_success_count = 0
    for i, cmd in enumerate(error_commands):
        try:
            print(f"  错误测试 {i+1}: {repr(cmd)}")
            r = requests.post('http://localhost:5000/api/openclaw/run', 
                             json={'instruction': cmd}, timeout=10)
            result = r.json()
            
            # 错误应该被正确处理（返回失败状态）
            if not result.get('success', False):
                print(f"    ✅ 错误处理正确: {result.get('error', result.get('stderr', ''))}")
                error_success_count += 1
            else:
                print(f"    ⚠️ 意外成功: {result.get('stdout', '')}")
                
        except Exception as e:
            print(f"    ✅ 异常处理正确: {str(e)}")
            error_success_count += 1
    
    print(f"错误处理测试完成: {error_success_count}/{len(error_commands)} 正确处理")
    
    # 最终统计
    total_tests = len(rapid_commands) + len(concurrent_commands) + len(long_commands) + len(error_commands)
    total_passed = success_count + concurrent_success + success_count + error_success_count
    
    print(f"\n" + "="*60)
    print("🎉 会话锁定问题专项测试结果")
    print("="*60)
    print(f"总测试数: {total_tests}")
    print(f"通过数: {total_passed}")
    print(f"成功率: {total_passed/total_tests*100:.1f}%")
    
    if total_passed == total_tests:
        print("\n✅ 会话锁定问题已完全解决！")
        print("✅ 所有测试通过！")
        print("✅ 现在可以放心使用OpenClaw了！")
        print("🎉 无bug状态达成！")
    else:
        print(f"\n⚠️ 还有 {total_tests-total_passed} 个测试未通过")
        print("需要进一步调试")
    
    return total_passed == total_tests

if __name__ == '__main__':
    print("开始OpenClaw会话锁定问题专项测试...")
    print("目标: 确保会话锁定问题完全解决")
    print("="*60)
    
    success = test_session_lock_issue()
    
    if success:
        print("\n🎯 任务完成！")
        print("OpenClaw会话锁定问题已完全解决！")
        print("现在可以放心使用所有功能了！")
    else:
        print("\n需要继续修复...")
    
    print("\n下一步:")
    print("1. 在浏览器中打开项目页面")
    print("2. 点击OpenClaw按钮测试")
    print("3. 验证所有功能正常工作")
    print("4. 享受无bug的OpenClaw体验！")