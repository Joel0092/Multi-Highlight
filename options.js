const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

exportBtn.onclick = () => {
  chrome.storage.local.get(['keywords', 'caseSensitive'], (data) => {
    if (!data.keywords || data.keywords.length === 0) {
      showMessage('当前没有保存的高亮配置', 'warning');
      return;
    }
    
    const config = {
      keywords: data.keywords,
      caseSensitive: data.caseSensitive || false,
      exportTime: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi-highlight-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showMessage('配置方案导出成功！', 'success');
  });
};

importBtn.onclick = () => {
  importFile.click();
};

importFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // 检查文件类型
  if (!file.name.endsWith('.json')) {
    showMessage('请选择JSON格式的配置文件', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      
      // 验证配置文件格式
      if (!data.keywords || !Array.isArray(data.keywords)) {
        throw new Error('配置文件格式错误：缺少keywords数组');
      }
      
      // 验证关键词数据
      for (let i = 0; i < data.keywords.length; i++) {
        const keyword = data.keywords[i];
        if (!keyword.text || !keyword.color) {
          throw new Error(`配置文件格式错误：第${i + 1}个关键词缺少必要字段`);
        }
      }
      
      // 保存配置，确保启用高亮
      const configToSave = {
        keywords: data.keywords,
        caseSensitive: data.caseSensitive || false,
        isHighlightEnabled: true // 确保导入后高亮功能被启用
      };
      
      chrome.storage.local.set(configToSave, () => {
        if (chrome.runtime.lastError) {
          showMessage('保存配置失败：' + chrome.runtime.lastError.message, 'error');
        } else {
          showMessage(`成功导入 ${data.keywords.length} 个高亮配置！`, 'success');
          
          // 通知所有标签页更新高亮
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              try {
                chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHT' }, (response) => {
                  // 处理响应（如果有）
                  const lastError = chrome.runtime.lastError;
                  // 忽略无法发送消息的标签页错误
                });
              } catch (e) {
                // 忽略无法发送消息的标签页
              }
            });
          });
          
          // 更新UI显示
          updateKeywordsList();
        }
      });
      
    } catch (error) {
      console.error('导入配置失败:', error);
      showMessage('导入失败：' + error.message, 'error');
    }
  };
  
  reader.onerror = () => {
    showMessage('读取文件失败', 'error');
  };
  
  reader.readAsText(file);
  
  // 清空文件输入，允许重复选择同一文件
  e.target.value = '';
};

// 显示消息提示
function showMessage(message, type = 'info') {
  // 移除现有的消息
  const existingMessage = document.querySelector('.message-toast');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // 创建消息元素
  const messageEl = document.createElement('div');
  messageEl.className = `message-toast message-${type}`;
  messageEl.textContent = message;
  
  // 添加样式
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  // 根据类型设置颜色
  switch (type) {
    case 'success':
      messageEl.style.background = '#4CAF50';
      break;
    case 'error':
      messageEl.style.background = '#f44336';
      break;
    case 'warning':
      messageEl.style.background = '#ff9800';
      break;
    default:
      messageEl.style.background = '#2196F3';
  }
  
  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(messageEl);
  
  // 3秒后自动移除
  setTimeout(() => {
    messageEl.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 300);
  }, 3000);
}

// 页面加载完成后显示当前配置信息
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['keywords', 'caseSensitive', 'firstInstall'], (data) => {
    // 检查是否是首次安装
    if (data.firstInstall) {
      // 显示欢迎信息
      const welcomeInfo = document.createElement('div');
      welcomeInfo.className = 'version-info';
      welcomeInfo.style.background = '#e3f2fd';
      welcomeInfo.style.border = '1px solid #2196F3';
      welcomeInfo.innerHTML = `
        <h4 style="color: #1976D2;">🎉 欢迎使用 Multi Highlight！</h4>
        <ul class="feature-list">
          <li>这是您首次安装扩展，请查看下方使用指南</li>
          <li>点击浏览器工具栏中的扩展图标开始使用</li>
          <li>选中文本后右键可快速添加高亮</li>
          <li>所有设置会自动保存到浏览器本地存储</li>
        </ul>
        <div style="margin-top: 15px; padding: 10px; background: #fff; border-radius: 4px; border-left: 4px solid #2196F3;">
          <strong>💡 快速开始：</strong>
          <ol style="margin: 10px 0 0 20px;">
            <li>打开任意网页</li>
            <li>点击浏览器工具栏中的扩展图标</li>
            <li>输入要高亮的关键词并选择颜色</li>
            <li>点击"添加"按钮即可看到高亮效果</li>
          </ol>
        </div>
      `;
      
      // 插入到页面顶部
      const content = document.querySelector('.content');
      if (content) {
        content.insertBefore(welcomeInfo, content.firstChild);
      }
      
      // 标记已不是首次安装
      chrome.storage.local.set({ firstInstall: false });
    }
    
    // 显示当前配置状态
    if (data.keywords && data.keywords.length > 0) {
      const configInfo = document.createElement('div');
      configInfo.className = 'version-info';
      configInfo.innerHTML = `
        <h4>📊 当前配置状态</h4>
        <ul class="feature-list">
          <li>已保存 ${data.keywords.length} 个高亮关键词</li>
          <li>大小写敏感：${data.caseSensitive ? '开启' : '关闭'}</li>
          <li>配置已自动保存到浏览器本地存储</li>
        </ul>
      `;
      
      // 插入到配置管理部分
      const configSection = document.querySelector('.section:nth-child(4)');
      if (configSection) {
        configSection.insertBefore(configInfo, configSection.querySelector('.btn-group'));
      }
    }
  });
});

// 更新关键词列表显示
function updateKeywordsList() {
  // 获取当前配置
  chrome.storage.local.get(['keywords', 'caseSensitive'], (data) => {
    // 更新配置状态显示
    const configInfo = document.querySelector('.version-info');
    if (configInfo) {
      configInfo.innerHTML = `
        <h4>📊 当前配置状态</h4>
        <ul class="feature-list">
          <li>已保存 ${data.keywords ? data.keywords.length : 0} 个高亮关键词</li>
          <li>大小写敏感：${data.caseSensitive ? '开启' : '关闭'}</li>
          <li>配置已自动保存到浏览器本地存储</li>
        </ul>
      `;
    }
  });
}

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
  // Ctrl+E 导出配置
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    exportBtn.click();
  }
  
  // Ctrl+I 导入配置
  if (e.ctrlKey && e.key === 'i') {
    e.preventDefault();
    importBtn.click();
  }
});

// 添加拖拽导入支持
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.json')) {
      // 模拟文件选择
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      importFile.files = dataTransfer.files;
      
      // 触发change事件
      const event = new Event('change', { bubbles: true });
      importFile.dispatchEvent(event);
    } else {
      showMessage('请拖拽JSON格式的配置文件', 'warning');
    }
  }
});

 