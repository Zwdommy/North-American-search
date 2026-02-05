# openclaw_simple_bridge.py - 简化的OpenClaw桥接服务
# 为North American Search项目提供简单的OpenClaw集成功能

import subprocess
import json
import os
from flask import Flask, request, jsonify

app = Flask(__name__)

def run_openclaw_command(instruction):
    """运行OpenClaw指令"""
    try:
        # 使用OpenClaw的本地模式，但需要先配置
        # 尝试使用agent命令，但需要指定会话
        
        # 方案1: 使用系统命令执行
        if instruction.startswith('echo'):
            # 简单的echo测试
            result = subprocess.run(instruction, shell=True, capture_output=True, text=True, timeout=30)
            return {
                'success': result.returncode == 0,
                'returnCode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr
            }
        
        # 方案2: 尝试使用OpenClaw的agent命令，但需要配置
        # 这里需要先运行openclaw setup来初始化配置
        
        # 方案3: 使用Python直接执行系统命令
        if 'open' in instruction.lower() and 'notepad' in instruction.lower():
            # 打开记事本
            if os.name == 'nt':  # Windows
                result = subprocess.run(['notepad'], capture_output=True, text=True, timeout=10)
            else:
                result = subprocess.run(['gedit'], capture_output=True, text=True, timeout=10)
            
            return {
                'success': True,
                'returnCode': 0,
                'stdout': 'Notepad opened successfully',
                'stderr': ''
            }
        
        # 默认方案: 尝试执行系统命令
        result = subprocess.run(instruction, shell=True, capture_output=True, text=True, timeout=30)
        return {
            'success': result.returncode == 0,
            'returnCode': result.returncode,
            'stdout': result.stdout,
            'stderr': result.stderr
        }
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'returnCode': -1,
            'stdout': '',
            'stderr': 'Command timed out after 30 seconds'
        }
    except Exception as e:
        return {
            'success': False,
            'returnCode': -1,
            'stdout': '',
            'stderr': f'Error executing command: {str(e)}'
        }

@app.route('/api/openclaw/run', methods=['POST'])
def openclaw_run():
    """处理OpenClaw指令"""
    try:
        data = request.get_json(silent=True) or {}
        instruction = (data.get('instruction') or '').strip()
        
        if not instruction:
            return jsonify({'error': 'Missing instruction'}), 400
        
        print(f"执行OpenClaw指令: {instruction}")
        
        # 运行指令
        result = run_openclaw_command(instruction)
        
        # 返回结果
        ok = result['success']
        return jsonify({
            'success': ok,
            'returnCode': result['returnCode'],
            'stdout': result['stdout'],
            'stderr': result['stderr']
        }), (200 if ok else 500)
        
    except Exception as e:
        return jsonify({'error': f'OpenClaw run failed: {str(e)}'}), 500

@app.route('/api/openclaw/health', methods=['GET'])
def openclaw_health():
    """OpenClaw健康检查"""
    return jsonify({
        'status': 'ok',
        'message': 'OpenClaw simple bridge is running',
        'version': '1.0.0'
    })

if __name__ == '__main__':
    print("OpenClaw简化桥接服务启动...")
    print("提供基础的系统命令执行功能")
    print("端点: http://localhost:5001/api/openclaw/run")
    app.run(host='0.0.0.0', port=5001, debug=False)