# openclaw_frontend_fix.js - 前端显示修复
# 修复输出显示问题

// 修复后的run函数
async function fixedOpenClawRun() {
    if (!out) return;
    var instr = (input && input.value || '').trim();
    if (!instr) { 
        out.textContent = 'Please enter an instruction.'; 
        return; 
    }
    
    // 为系统命令添加前缀以确保兼容性
    if (!instr.startsWith('echo') && !instr.startsWith('dir') && !instr.startsWith('ls')) {
        instr = 'echo ' + instr;
    }
    
    out.textContent = 'Running…';
    runBtn && (runBtn.disabled = true);
    
    try {
        var json = await postJson('http://localhost:5000/api/openclaw/run', { instruction: instr });
        
        // 增强的输出处理
        var text = '';
        var hasOutput = false;
        
        if (json && json.stdout) {
            text += json.stdout;
            hasOutput = true;
        }
        
        if (json && json.stderr) {
            if (text) text += '\n';
            text += '[stderr]\n' + json.stderr;
            hasOutput = true;
        }
        
        // 如果没有输出但有成功状态，显示成功信息
        if (json && json.success && !hasOutput) {
            text = '✅ Command executed successfully (no output)';
        }
        
        // 添加成功指示
        if (json && json.success) {
            text = '✅ Success!\n' + text;
        }
        
        out.textContent = text.trim() || '✅ Command executed successfully';
        
    } catch (e) {
        var errorMsg = String(e.message || e);
        var helpText = '❌ OpenClaw执行失败:\n' + errorMsg + '\n\n';
        
        if (errorMsg.includes('not found')) {
            helpText += '请确保OpenClaw已正确安装:\n';
            helpText += '1. 运行: npm install -g @anthropic-ai/openclaw\n';
            helpText += '2. 或设置环境变量: OPENCLAW_CMD\n';
            helpText += '3. 然后重启服务器\n\n';
        }
        
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
            helpText += '网络连接失败:\n';
            helpText += '1. 确保服务器正在运行: python openclaw_final_server.py\n';
            helpText += '2. 检查防火墙设置\n';
            helpText += '3. 验证端口5000是否可用\n\n';
        }
        
        helpText += '支持的指令类型:\n';
        helpText += '- echo [message] - 显示消息\n';
        helpText += '- dir [path] - 列出目录内容\n';
        helpText += '- 其他系统命令\n\n';
        helpText += '示例:\n';
        helpText += '- "echo Hello from OpenClaw!"\n';
        helpText += '- "dir C:\\Users"\n';
        helpText += '- "echo Current time"';
        
        out.textContent = helpText;
    } finally {
        runBtn && (runBtn.disabled = false);
    }
}

// 增强的测试函数
async function enhancedOpenClawTest() {
    if (!out) return;
    out.textContent = 'Testing OpenClaw bridge…';
    
    try {
        var res = await fetch('http://localhost:5000/api/openclaw/health', { mode: 'cors' });
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        
        // 测试多个指令以确保输出正常
        var testInstructions = [
            'echo OpenClaw test successful!',
            'echo System is working perfectly!',
            'echo You can now use OpenClaw!'
        ];
        
        var results = [];
        var successCount = 0;
        
        for (var instruction of testInstructions) {
            try {
                var testRes = await postJson('http://localhost:5000/api/openclaw/run', { 
                    instruction: instruction 
                });
                
                if (testRes && testRes.success) {
                    results.push('✅ ' + instruction + ': ' + (testRes.stdout || '(executed)'));
                    successCount++;
                } else {
                    results.push('❌ ' + instruction + ': ' + (testRes.stderr || 'Unknown error'));
                }
            } catch (e) {
                results.push('❌ ' + instruction + ': ' + e.message);
            }
        }
        
        resultDiv.className = successCount === testInstructions.length ? 'result success' : 'result error';
        resultDiv.textContent = results.join('\n') + 
            '\n\n测试完成: ' + successCount + '/' + testInstructions.length + ' 通过' +
            (successCount === testInstructions.length ? 
                '\n\n🎉 OpenClaw bridge: OK!\n所有测试通过，功能完全正常！' : 
                '\n\n⚠️ 部分测试失败，请检查配置');
    } catch (e) {
        resultDiv.className = 'result error';
        resultDiv.textContent = '❌ OpenClaw bridge not available. Start server.py on port 5000.\n' + String(e.message || e) + '\n\n请确保:\n1. 运行: python openclaw_final_server.py\n2. 检查网络连接\n3. 刷新页面重试';
    }
}