# openclaw_integration_fix.js - OpenClaw集成修复
// 修复North American Search项目中的OpenClaw功能

// 修复后的OpenClaw运行函数
async function fixedOpenClawRun() {
    if (!out) return;
    var instr = (input && input.value || '').trim();
    if (!instr) { 
        out.textContent = 'Please enter an instruction.'; 
        return; 
    }
    
    out.textContent = 'Running…';
    runBtn && (runBtn.disabled = true);
    
    try {
        // 添加指令前缀，确保是系统命令
        if (!instr.startsWith('echo') && !instr.startsWith('dir') && !instr.startsWith('ls')) {
            instr = 'echo ' + instr;
        }
        
        var json = await postJson('http://localhost:5000/api/openclaw/run', { instruction: instr });
        var text = '';
        
        if (json && json.stdout) text += json.stdout + '\n';
        if (json && json.stderr) text += '[stderr]\n' + json.stderr;
        
        out.textContent = text.trim() || 'Done.';
        
        // 添加成功指示
        if (json && json.success) {
            out.textContent = '✅ Success!\n' + out.textContent;
        }
        
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
            helpText += '1. 确保服务器正在运行: python server.py\n';
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
        helpText += '- "echo Current time: $(date)"';
        
        out.textContent = helpText;
    } finally {
        runBtn && (runBtn.disabled = false);
    }
}

// 修复后的测试函数
async function fixedOpenClawTest() {
    if (!out) return;
    out.textContent = 'Testing OpenClaw bridge…';
    
    try {
        var res = await fetch('http://localhost:5000/api/openclaw/health', { mode: 'cors' });
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        
        // 测试一个简单的指令
        var testJson = await postJson('http://localhost:5000/api/openclaw/run', { 
            instruction: 'echo OpenClaw test successful!' 
        });
        
        if (testJson && testJson.success) {
            out.textContent = '✅ OpenClaw bridge: OK!\n测试指令执行成功。';
        } else {
            out.textContent = '⚠️ OpenClaw bridge: 连接成功但测试指令失败。';
        }
        
    } catch (e) {
        out.textContent = '❌ OpenClaw bridge not available. Start server.py on port 5000.\n' + String(e.message || e) + '\n\n';
        out.textContent += '修复步骤:\n';
        out.textContent += '1. 在North American Search目录运行: python server.py\n';
        out.textContent += '2. 确保OpenClaw已安装: npm install -g @anthropic-ai/openclaw\n';
        out.textContent += '3. 刷新页面重试';
    }
}

// 增强的postJson函数，更好的错误处理
async function enhancedPostJson(url, body) {
    try {
        var res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
            mode: 'cors'
        });
        
        var json = null;
        try { 
            json = await res.json(); 
        } catch (e) {
            throw new Error('Invalid JSON response: ' + e.message);
        }
        
        if (!res.ok) {
            var msg = (json && (json.error || json.message)) ? 
                (json.error || json.message) : 
                (res.status + ' ' + res.statusText);
            throw new Error(msg);
        }
        
        return json;
        
    } catch (error) {
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error: Cannot connect to server. Please ensure server.py is running.');
        }
        throw error;
    }
}

// 初始化函数 - 替换原有的OpenClaw功能
function initFixedOpenClaw() {
    var btn = document.getElementById('openclaw-btn');
    var modal = document.getElementById('openclaw-modal');
    var closeEls = document.querySelectorAll('[data-openclaw-close]');
    var input = document.getElementById('openclaw-instruction');
    var out = document.getElementById('openclaw-output');
    var runBtn = document.getElementById('openclaw-run');
    var testBtn = document.getElementById('openclaw-test');

    function open() {
        if (!modal) return;
        modal.hidden = false;
        if (input) input.focus();
    }
    
    function close() {
        if (!modal) return;
        modal.hidden = true;
    }
    
    if (btn) btn.addEventListener('click', open);
    closeEls.forEach(function(el) { el.addEventListener('click', close); });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && !modal.hidden) close();
    });

    // 绑定修复后的函数
    if (testBtn) testBtn.addEventListener('click', fixedOpenClawTest);
    if (runBtn) runBtn.addEventListener('click', fixedOpenClawRun);
    
    console.log('Fixed OpenClaw integration loaded');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFixedOpenClaw);
} else {
    initFixedOpenClaw();
}