

chrome.runtime.onInstalled.addListener((details) => {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'add-highlight',
    title: '添加为高亮',
    contexts: ['selection']
  });
  
  // 检查是否是首次安装
  if (details.reason === 'install') {
    // 设置默认配置
    const defaultConfig = {
      keywords: [],
      caseSensitive: false,
      isHighlightEnabled: true,
      firstInstall: true
    };
    
    chrome.storage.local.set(defaultConfig, () => {
      // 置顶扩展图标
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      
      // 延迟打开设置页面，确保配置已保存
      setTimeout(() => {
        chrome.tabs.create({
          url: chrome.runtime.getURL('options.html')
        });
      }, 500);
    });
  }
});

// 处理扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  // 移除NEW徽章
  chrome.action.setBadgeText({ text: '' });
  
  // 注入脚本到当前页面
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: toggleMultiHighlightPanel
  });
});



// 辅助函数：16进制转rgba
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 辅助函数：判断颜色是否为亮色
function isLightColor(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);
  // 亮度公式
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 180;
}

// 在页面中切换多重高亮面板的函数
function toggleMultiHighlightPanel() {
  // 颜色配置
  const highlightColors = [
    '#ffff00', // 鲜艳黄
    '#00ff00', // 鲜艳绿
    '#00e5ff', // 鲜艳蓝
    '#ff00ff', // 鲜艳粉
    '#ff8000', // 鲜艳橙
    '#a020f0', // 鲜艳紫
    '#00ffd0', // 鲜艳青
    '#ff0000', // 鲜艳红
    '#ff1493', // 鲜艳深粉
    '#ff4500'  // 鲜艳深橙
  ];
  // 插入统一圆形按钮样式（只插一次）
  if (!document.getElementById('multi-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'multi-highlight-style';
    style.textContent = `
      .color-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #eee;
        outline: none;
        cursor: pointer;
        padding: 0;
        box-sizing: border-box;
        transition: all 0.2s;
        position: relative;
        background: #ffff00;
        display: inline-block;
      }
      .color-btn.small {
        width: 18px;
        height: 18px;
      }
      .color-btn.active {
        border: 3px solid #333;
        box-shadow: 0 0 0 2px #fff;
      }
      .color-btn:focus {
        outline: none;
      }
    `;
    document.head.appendChild(style);
  }

  // 美化眼睛按钮样式
  const style = document.createElement('style');
  style.textContent = `
    #toggle-highlight:hover {
      background: #ffe066;
      border-radius: 50%;
    }
    #eye-icon svg {
      width: 22px;
      height: 22px;
      display: block;
    }
    #export-config:hover, #import-config:hover {
      background: #e09f3e !important;
      color: #fff !important;
      box-shadow: 0 2px 8px rgba(224, 159, 62, 0.3);
      transform: translateY(-1px);
    }
    #close-panel:hover {
      background: #e09f3e !important;
      color: #fff !important;
      box-shadow: 0 2px 8px rgba(224, 159, 62, 0.3);
      transform: scale(1.1);
    }
    #add-keyword:hover {
      background: #d18f2e !important;
      box-shadow: 0 2px 8px rgba(224, 159, 62, 0.4);
      transform: scale(1.05);
    }
    #guide-btn:hover {
      background: #e09f3e !important;
      color: #fff !important;
      box-shadow: 0 2px 8px rgba(224, 159, 62, 0.3);
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);

  // 检查是否已存在面板
  let panel = document.getElementById('multi-highlight-panel');
  if (panel) {
    panel.remove();
    return;
  }

  // 创建面板
  panel = document.createElement('div');
  panel.id = 'multi-highlight-panel';
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: #fffbe6;
    border: 2px solid #e09f3e;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: '微软雅黑', Arial, sans-serif;
    padding: 16px;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // 面板内容
  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 id="panel-title" style="margin: 0; color: #e09f3e; font-size: 20px;">Multi Highlight</h2>
        <button id="toggle-highlight" title="开关高亮" style="width: 32px; height: 32px; border: none; background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;">
          <span id="eye-icon"></span>
        </button>
      </div>
      <button id="close-panel" style="width: 28px; height: 28px; border: 1px solid #e09f3e; border-radius: 50%; background: #fff; color: #e09f3e; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.2s;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <input type="text" id="keyword-input" placeholder="输入关键词或短语..." style="flex: 1; padding: 4px 8px; border: 1px solid #e09f3e; border-radius: 4px;">
      <div id="color-circle-panel" class="color-btn" tabindex="0" title="选择颜色"></div>
      <button id="add-keyword" style="background: #e09f3e; color: #fff; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; transition: all 0.2s;">添加</button>
    </div>
    <div style="margin-bottom: 10px; font-size: 14px;">
      <label><input type="checkbox" id="case-sensitive"> 区分大小写</label>
    </div>
    <ul id="keyword-list" style="list-style: none; padding: 0; margin: 0 0 12px 0; max-height: 160px; overflow-y: auto;"></ul>
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="guide-btn" style="display: flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid #e09f3e; border-radius: 6px; background: #fff; color: #e09f3e; cursor: pointer; font-size: 13px; transition: all 0.2s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        指南
      </button>
      <button id="export-config" style="display: flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid #e09f3e; border-radius: 6px; background: #fff; color: #e09f3e; cursor: pointer; font-size: 13px; transition: all 0.2s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        导出
      </button>
      <button id="import-config" style="display: flex; align-items: center; gap: 4px; padding: 6px 10px; border: 1px solid #e09f3e; border-radius: 6px; background: #fff; color: #e09f3e; cursor: pointer; font-size: 13px; transition: all 0.2s;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17,8 12,3 7,8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        导入
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  // 绑定事件
  const closeBtn = panel.querySelector('#close-panel');
  const keywordInput = panel.querySelector('#keyword-input');
  const colorCirclePanel = panel.querySelector('#color-circle-panel');
  const addBtn = panel.querySelector('#add-keyword');
  const keywordList = panel.querySelector('#keyword-list');
  const guideBtn = panel.querySelector('#guide-btn');
  const exportBtn = panel.querySelector('#export-config');
  const importBtn = panel.querySelector('#import-config');
  const caseSensitive = panel.querySelector('#case-sensitive');
  const panelTitle = panel.querySelector('#panel-title');
  const toggleHighlightBtn = panel.querySelector('#toggle-highlight');
  const eyeIcon = panel.querySelector('#eye-icon');

  let keywords = [];
  let selectedColor = '#ffff00';
  let isHighlightEnabled = true; // 新增：控制高亮开关

  // 关闭按钮
  closeBtn.onclick = () => panel.remove();

  // 加载配置
  chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
    keywords = data.keywords || [];
    caseSensitive.checked = !!data.caseSensitive;
    isHighlightEnabled = !!data.isHighlightEnabled; // 加载高亮开关状态
    updateEyeIcon(); // 更新眼睛图标
    renderKeywordList();
  });

  // 统一的颜色选择弹窗（重写，保证弹出和切换）
  function showColorPopup({ anchor, currentColor, onSelect }) {
    console.log('showColorPopup called', anchor, currentColor);
    // 移除已有弹窗
    document.querySelectorAll('.color-popup').forEach(p => p.remove());
    // 创建弹窗
    const popup = document.createElement('div');
    popup.className = 'color-popup';
    popup.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      background: #fff;
      border: 1px solid #e09f3e;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      padding: 8px 10px;
      display: flex;
      gap: 4px;
      flex-wrap: nowrap;   /* 不换行 */
      min-width: unset;
      white-space: nowrap; /* 不换行 */
    `;
    
    highlightColors.forEach(color => {
      const btn = document.createElement('div');
      btn.className = 'color-btn small';
      btn.style.background = color;
      btn.title = color;
      btn.style.zIndex = 2147483647;
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
      if (color === currentColor) btn.classList.add('active');
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log('color selected', color);
        onSelect(color);
        popup.remove();
      });
      popup.appendChild(btn);
    });
    
    document.body.appendChild(popup);
    console.log('popup appended', popup);
    
    const rect = anchor.getBoundingClientRect();
    let left = rect.right - popup.offsetWidth; // 右对齐，向左延展
    let top = rect.bottom + 4;
    // 先设置初始位置
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    // 获取弹窗尺寸
    const popupRect = popup.getBoundingClientRect();
    // 如果左侧溢出，则贴紧左边
    if (popupRect.left < 10) {
      left = 10;
    }
    // 如果下方溢出，显示在按钮上方
    if (popupRect.bottom > window.innerHeight - 10) {
      top = rect.top - popupRect.height - 4;
      if (top < 10) top = 10;
    }
    // 应用最终位置
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    // 点击其他地方关闭弹窗
    setTimeout(() => {
      const close = (e) => {
        if (!popup.contains(e.target) && !anchor.contains(e.target)) {
          popup.remove();
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 10);
  }

  // 主色按钮
  colorCirclePanel.style.background = selectedColor;
  colorCirclePanel.style.zIndex = 2147483647;
  colorCirclePanel.style.cursor = 'pointer';
  colorCirclePanel.style.pointerEvents = 'auto';
  
  // 添加鼠标事件监听器
  colorCirclePanel.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('colorCirclePanel clicked', selectedColor);
    showColorPopup({
      anchor: colorCirclePanel,
      currentColor: selectedColor,
      onSelect: (color) => {
        selectedColor = color;
        colorCirclePanel.style.background = color;
        saveConfig();
        renderKeywordList();
      }
    });
  });
  colorCirclePanel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      colorCirclePanel.click();
    }
  });

  // 渲染关键词列表
  function renderKeywordList() {
    keywordList.innerHTML = '';
    keywords.forEach((item, idx) => {
      const li = document.createElement('li');
      li.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid #ffe066; border-radius: 4px; margin-bottom: 6px; padding: 4px 8px;';

      // 列表颜色按钮
      const colorBtn = document.createElement('div');
      colorBtn.tabIndex = 0;
      colorBtn.className = 'color-btn small';
      colorBtn.style.background = item.color;
      colorBtn.title = '更改颜色';
      colorBtn.style.marginRight = '12px';
      colorBtn.style.zIndex = 2147483647;
      colorBtn.style.pointerEvents = 'auto';
      colorBtn.style.cursor = 'pointer';
      colorBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('colorBtn clicked', idx, item.color);
        showColorPopup({
          anchor: colorBtn,
          currentColor: item.color,
          onSelect: (color) => {
            console.log('color selected', color);
            keywords[idx].color = color;
            saveConfig();
            renderKeywordList();
          }
        });
      });
      colorBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          colorBtn.click();
        }
      });

      // 创建文本容器，支持编辑和高亮预览
      const textContainer = document.createElement('div');
      textContainer.style.cssText = 'flex: 1; margin-right: 8px; min-width: 0;';

      const textSpan = document.createElement('span');
      textSpan.textContent = item.text;
      textSpan.style.cssText = `
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 2px;
        background: ${item.color};
        color: ${isLightColor(item.color) ? '#222' : '#fff'};
        box-shadow: 0 0 2px 1px ${hexToRgba(item.color, 0.8)}, 0 0 4px 2px ${hexToRgba(item.color, 0.5)};
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        max-width: 100%;
      `;
      textSpan.title = '点击编辑';

      // 悬停效果
      textSpan.onmouseenter = () => {
        textSpan.style.transform = 'scale(1.05)';
        textSpan.style.boxShadow = `0 0 4px 2px ${hexToRgba(item.color, 0.9)}, 0 0 8px 4px ${hexToRgba(item.color, 0.6)}`;
      };

      textSpan.onmouseleave = () => {
        textSpan.style.transform = 'scale(1)';
        textSpan.style.boxShadow = `0 0 2px 1px ${hexToRgba(item.color, 0.8)}, 0 0 4px 2px ${hexToRgba(item.color, 0.5)}`;
      };

      // 单击编辑功能
      textSpan.onclick = () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = item.text;
        input.style.cssText = `
          width: 100%;
          padding: 2px 4px;
          border: 1px solid #e09f3e;
          border-radius: 2px;
          font-size: inherit;
          background: #fff;
          color: #333;
        `;

        const saveEdit = () => {
          const newText = input.value.trim();
          if (newText && newText !== item.text) {
            // 检查是否与其他关键词重复
            if (keywords.some((k, i) => i !== idx && k.text === newText)) {
              alert('已存在该关键词');
              return;
            }
            item.text = newText;
            saveConfig();
            renderKeywordList();
          } else {
            renderKeywordList(); // 重新渲染，取消编辑
          }
        };

        const cancelEdit = () => {
          renderKeywordList(); // 重新渲染，取消编辑
        };

        input.onblur = saveEdit;
        input.onkeydown = (e) => {
          // 允许复制粘贴快捷键正常工作
          if (e.ctrlKey || e.metaKey) {
            return; // 不阻止 Ctrl/Cmd 组合键
          }
          
          if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        };

        // 确保编辑输入框支持右键菜单
        input.addEventListener('contextmenu', (e) => {
          // 不阻止默认右键菜单
          return true;
        });

        textContainer.innerHTML = '';
        textContainer.appendChild(input);
        input.focus();
        input.select();
      };

      textContainer.appendChild(textSpan);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'background: none; border: none; color: #e09f3e; cursor: pointer; font-size: 16px;';
      removeBtn.title = '删除';
      removeBtn.onclick = () => {
        keywords.splice(idx, 1);
        saveConfig();
        renderKeywordList();
      };

      li.appendChild(colorBtn);
      li.appendChild(textContainer);
      li.appendChild(removeBtn);
      keywordList.appendChild(li);
    });
  }

  // 保存配置
  function saveConfig() {
    chrome.storage.local.set({
      keywords,
      caseSensitive: caseSensitive.checked,
      isHighlightEnabled: isHighlightEnabled // 保存高亮开关状态
    }, () => {
      // 通知所有已打开的页面更新高亮
      chrome.tabs.query({}, function(tabs) {
        for (let tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHT' });
        }
      });
    });
  }

  // 添加关键词
  addBtn.onclick = () => {
    const text = keywordInput.value.trim();
    if (!text) return alert('请输入关键词');
    if (keywords.some(k => k.text === text)) return alert('已存在该关键词');
    keywords.push({ text, color: selectedColor });
    keywordInput.value = '';
    saveConfig();
    renderKeywordList();
  };

  // 其他事件绑定
  caseSensitive.onchange = () => {
    saveConfig();
  };

  // 确保主输入框的复制粘贴快捷键正常工作
  keywordInput.addEventListener('keydown', (e) => {
    // 允许复制粘贴快捷键正常工作
    if (e.ctrlKey || e.metaKey) {
      return; // 不阻止 Ctrl/Cmd 组合键
    }
  });

  // 确保主输入框支持右键菜单
  keywordInput.addEventListener('contextmenu', (e) => {
    // 不阻止默认右键菜单
    return true;
  });

  // 指南按钮事件
  if (guideBtn) {
    guideBtn.onclick = () => {
      console.log('指南按钮被点击');
      
      // 通过消息传递给background script来打开设置页面
      chrome.runtime.sendMessage({
        type: 'OPEN_OPTIONS_PAGE'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('发送消息失败:', chrome.runtime.lastError);
          // 备用方法：直接使用window.open
          const optionsUrl = chrome.runtime.getURL('options.html');
          window.open(optionsUrl, '_blank');
        } else {
          console.log('设置页面打开成功');
        }
      });
    };
  } else {
    console.error('指南按钮未找到！');
  }

  // 导出功能
  exportBtn.onclick = () => {
    const data = { keywords, caseSensitive: caseSensitive.checked, isHighlightEnabled: isHighlightEnabled };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'multi-find-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入功能
  importBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (!Array.isArray(data.keywords)) throw new Error();
          keywords = data.keywords;
          caseSensitive.checked = !!data.caseSensitive;
          isHighlightEnabled = !!data.isHighlightEnabled; // 导入高亮开关状态
          saveConfig();
          renderKeywordList();
          alert('导入成功');
        } catch {
          alert('导入失败，文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 高亮开关按钮
  toggleHighlightBtn.onclick = () => {
    isHighlightEnabled = !isHighlightEnabled;
    updateEyeIcon();
    saveConfig();
    renderKeywordList();
    // 通知内容脚本开关高亮
    window.postMessage({ type: 'TOGGLE_MULTI_HIGHLIGHT', enabled: isHighlightEnabled }, '*');
  };

  // 更新眼睛图标
  function updateEyeIcon() {
    if (isHighlightEnabled) {
      eyeIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#e09f3e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="8" ry="5.5"/><circle cx="12" cy="12" r="2.5" fill="#e09f3e"/></svg>`;
    } else {
      eyeIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="8" ry="5.5"/><circle cx="12" cy="12" r="2.5" fill="#aaa"/><line x1="4" y1="20" x2="20" y2="4" stroke="#aaa" stroke-width="2"/></svg>`;
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-highlight' && info.selectionText) {
    // 颜色配置
    const highlightColors = [
      '#ffff00', // 鲜艳黄
      '#00ff00', // 鲜艳绿
      '#00e5ff', // 鲜艳蓝
      '#ff00ff', // 鲜艳粉
      '#ff8000', // 鲜艳橙
      '#a020f0', // 鲜艳紫
      '#00ffd0', // 鲜艳青
      '#ff0000', // 鲜艳红
      '#ff1493', // 鲜艳深粉
      '#ff4500'  // 鲜艳深橙
    ];
    
    chrome.storage.local.get(['keywords'], (data) => {
      const keywords = data.keywords || [];
      if (keywords.some(k => k.text === info.selectionText)) {
        chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHT' });
        return;
      }
      // 自动分配下一个荧光色
      const color = highlightColors[keywords.length % highlightColors.length];
      keywords.push({ text: info.selectionText, color });
      chrome.storage.local.set({ keywords }, () => {
        // 通知所有已打开的页面更新高亮
        chrome.tabs.query({}, function(tabs) {
          for (let tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHT' });
          }
        });
      });
    });
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_OPTIONS_PAGE') {
    // 打开设置页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('options.html')
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('打开设置页面失败:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('设置页面已打开，标签页ID:', tab.id);
        sendResponse({ success: true, tabId: tab.id });
      }
    });
    return true; // 保持消息通道开放
  }
}); 