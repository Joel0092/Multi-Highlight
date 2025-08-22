

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
      keywords: [
        { id: "1", text: "拒单联系运营 不要发末单", color: "#ff4500", enabled: true },
        { id: "2", text: "客人取消订单的话麻烦先通知运营BD，不要直接发取消", color: "#ff4500", enabled: true },
        { id: "3", text: "任何状态下取消一定要钉钉运营", color: "#ff4500", enabled: true },
        { id: "4", text: "hktuyitrip", color: "#ff4500", enabled: true },
        { id: "5", text: "发单时同步【发卡】", color: "#ffff00", enabled: true },
        { id: "6", text: "heytripgo", color: "#ff4500", enabled: true },
        { id: "7", text: "酒店说满房先不要直接关后台的房，告知运营即可！！！", color: "#ff0000", enabled: true },
        { id: "8", text: "应付日期", color: "#a020f0", enabled: true },
        { id: "9", text: "酒店拒单就不用发取消了，直接关单就行", color: "#ff8000", enabled: true },
        { id: "10", text: "需要保密", color: "#a020f0", enabled: true },
        { id: "11", text: "未确认的逾时或者取消 请备注unconfirmed发取消单", color: "#ffff00", enabled: true },
        { id: "12", text: "M3", color: "#ff1493", enabled: true },
        { id: "13", text: "限时取消", color: "#ff1493", enabled: true },
        { id: "14", text: "不需要关房，不需要关房", color: "#ff4500", enabled: true },
        { id: "15", text: "One Bedroom Upper Garden Suite", color: "#ffff00", enabled: true },
        { id: "16", text: "不用帮运营关房", color: "#ff4500", enabled: true },
        { id: "17", text: "被拒单后不用关房", color: "#ff4500", enabled: true },
        { id: "18", text: "付款链接", color: "#a020f0", enabled: true },
        { id: "19", text: "confirmation number", color: "#00ff00", enabled: true },
        { id: "20", text: "before", color: "#ff8000", enabled: true },
        { id: "21", text: "cf#", color: "#00ff00", enabled: true },
        { id: "22", text: "xiwantrip", color: "#ff4500", enabled: true },
        { id: "23", text: "hotel number", color: "#00ff00", enabled: true },
        { id: "24", text: "confirmation no", color: "#00ff00", enabled: true },
        { id: "25", text: "RSV#", color: "#00ff00", enabled: true },
        { id: "26", text: "number reservation", color: "#00ff00", enabled: true },
        { id: "27", text: "HCN", color: "#00ff00", enabled: true },
        { id: "28", text: "Hotel Confirmation", color: "#00ff00", enabled: true },
        { id: "29", text: "Hotel number", color: "#00ff00", enabled: true },
        { id: "30", text: "reservation number", color: "#00ff00", enabled: true },
        { id: "31", text: "confirmation code", color: "#00ff00", enabled: true },
        { id: "32", text: "Confirmation number", color: "#00ff00", enabled: true },
        { id: "33", text: "保密渠道", color: "#a020f0", enabled: true },
        { id: "34", text: "渠道保密", color: "#a020f0", enabled: true },
        { id: "35", text: "付款日期", color: "#a020f0", enabled: true }
      ],
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
  // 检查是否已存在面板
  if (document.getElementById('multi-highlight-panel')) {
    document.getElementById('multi-highlight-panel').remove();
    return;
  }
  
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
    <div style="margin-bottom: 10px; font-size: 14px; display:flex; align-items:center; gap:12px;">
      <label><input type="checkbox" id="case-sensitive"> 区分大小写</label>
      <label style="display:flex; align-items:center; gap:6px;">
        <div id="color-filter-circle" class="color-btn small" style="border: 1px solid black;" title="选择筛选颜色（全部）"></div>
        颜色筛选
        <select id="color-filter" style="display:none;">
          <option value="">全部</option>
          ${highlightColors.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </label>
      </div>
    <div id="search-section" style="display:none; background:#fff; border:1px solid #ffe066; border-radius:6px; padding:8px 10px; margin: 0 0 10px 0;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <span style="color:#e09f3e; font-size:12px;">搜索结果</span>
        <button id="clear-search" style="border:none; background:transparent; color:#e09f3e; cursor:pointer; font-size:12px;">清除</button>
      </div>
      <ul id="search-result-list" style="list-style:none; padding:0; margin:0; max-height:120px; overflow-y:auto;"></ul>
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
  // 删除：const searchBtn = panel.querySelector('#search-keyword');
  const keywordList = panel.querySelector('#keyword-list');
  const searchSection = panel.querySelector('#search-section');
  const searchResultList = panel.querySelector('#search-result-list');
  const clearSearchBtn = panel.querySelector('#clear-search');
  const guideBtn = panel.querySelector('#guide-btn');
  const exportBtn = panel.querySelector('#export-config');
  const importBtn = panel.querySelector('#import-config');
  const caseSensitive = panel.querySelector('#case-sensitive');
  // 新增：颜色筛选选择框
  const colorFilter = panel.querySelector('#color-filter');
  const colorFilterCircle = panel.querySelector('#color-filter-circle');
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

  // 新增：颜色筛选弹窗（含"全部"）
  window.showColorFilterPopup = function({ anchor, currentColor, onSelect }) {
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
      flex-wrap: nowrap;
      white-space: nowrap;
    `;

    // “全部”按钮（清空筛选）
    const allBtn = document.createElement('div');
    allBtn.className = 'color-btn small';
    allBtn.title = '全部';
    allBtn.style.background = 'repeating-linear-gradient(45deg, #f5f5f5 0px, #f5f5f5 6px, #ffffff 6px, #ffffff 12px)';
    allBtn.style.cursor = 'pointer';
    allBtn.style.pointerEvents = 'auto';
    if (!currentColor) allBtn.classList.add('active');
    allBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onSelect('');
      popup.remove();
    });
    popup.appendChild(allBtn);

    // 颜色按钮
    highlightColors.forEach(color => {
      const btn = document.createElement('div');
      btn.className = 'color-btn small';
      btn.style.background = color;
      btn.title = color;
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
      if (color === currentColor) btn.classList.add('active');
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onSelect(color);
        popup.remove();
      });
      popup.appendChild(btn);
    });

    // 挂载并定位
    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    let top = rect.bottom + 4 + window.scrollY;
    if (left + popupRect.width > window.innerWidth - 10) left = window.innerWidth - popupRect.width - 10;
    if (top + popupRect.height > window.innerHeight - 10) {
      top = rect.top - popupRect.height - 4 + window.scrollY;
      if (top < 10) top = 10;
    }
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

  // 新增：颜色筛选圆形按钮逻辑
  if (colorFilterCircle) {
    const updateCircleStyle = () => {
      const val = colorFilter ? colorFilter.value : '';
      if (val) {
        colorFilterCircle.style.background = val;
        colorFilterCircle.style.border = '1px solid rgba(0,0,0,0.15)';
        colorFilterCircle.title = `选择筛选颜色（${val}）`;
      } else {
        colorFilterCircle.style.background = 'repeating-linear-gradient(45deg, #f5f5f5 0px, #f5f5f5 6px, #ffffff 6px, #ffffff 12px)';
        colorFilterCircle.style.border = '1px dashed #ccc';
        colorFilterCircle.title = '选择筛选颜色（全部）';
      }
    };
    // 初始化
    updateCircleStyle();

    colorFilterCircle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = colorFilter ? colorFilter.value : '';
      showColorFilterPopup({
        anchor: colorFilterCircle,
        currentColor: current,
        onSelect: (val) => {
          if (colorFilter) colorFilter.value = val || '';
          updateCircleStyle();
          renderKeywordList();
          renderSearchResults(keywordInput.value.trim());
        }
      });
    });
    colorFilterCircle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        colorFilterCircle.click();
      }
    });

    // 让隐藏的select变化也能同步圆形按钮样式
    if (colorFilter) {
      const origOnChange = colorFilter.onchange;
      colorFilter.onchange = (ev) => {
        if (origOnChange) origOnChange.call(colorFilter, ev);
        updateCircleStyle();
      };
    }
  }
  // 渲染关键词列表
  function renderKeywordList() {
    keywordList.innerHTML = '';
    keywords.forEach((item, idx) => {
      // 颜色过滤：若选择了颜色，仅显示对应颜色的关键词
      const filterColor = colorFilter ? colorFilter.value : '';
      if (filterColor && item.color !== filterColor) return;

      const li = document.createElement('li');
      li.dataset.index = idx;
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
        color: ${(item.color === '#ffff00' || item.color === '#00ff00' || item.color === '#00e5ff' || item.color === '#00ffd0') ? '#000' : '#fff'};
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

      // 创建可见性切换按钮
      const visibilityBtn = document.createElement('button');
      const isVisible = item.visible !== false;
      visibilityBtn.innerHTML = isVisible ? 
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : 
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
      visibilityBtn.title = isVisible ? '点击隐藏高亮' : '点击显示高亮';
      visibilityBtn.style.cssText = `background: none; border: none; color: ${isVisible ? '#e09f3e' : '#999'}; cursor: pointer; font-size: 16px; margin-right: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;`;
      visibilityBtn.onclick = function(e) {
        e.stopPropagation();
        try {
          // 获取当前关键词的最新状态
          chrome.storage.local.get(['keywords'], function(data) {
            const currentKeywords = data.keywords || [];
            if (currentKeywords[idx]) {
              // 切换可见性
              const newVisibility = currentKeywords[idx].visible === false ? true : false;
              currentKeywords[idx].visible = newVisibility;
              
              // 立即更新按钮外观
              const isVisible = newVisibility;
              visibilityBtn.innerHTML = isVisible ? 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
              visibilityBtn.title = isVisible ? '点击隐藏高亮' : '点击显示高亮';
              visibilityBtn.style.color = isVisible ? '#e09f3e' : '#999';
              
              // 保存更新后的关键词
              chrome.storage.local.set({ keywords: currentKeywords }, function() {
                // 通知内容脚本更新高亮
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                  if (tabs && tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      type: 'UPDATE_HIGHLIGHT',
                      keywords: currentKeywords
                    });
                  }
                  // 更新全局变量
                  keywords = currentKeywords;
                  // 重新渲染关键词列表
                  renderKeywordList();
                });
              });
            }
          });
        } catch (err) {
          console.error('处理眼睛按钮点击时出错:', err);
        }
      };
      
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
      li.appendChild(visibilityBtn);
      li.appendChild(removeBtn);
      keywordList.appendChild(li);
    });
  }

  // 搜索渲染函数（修复未定义）
  function renderSearchResults(term) {
    const q = term || '';
    const t = q.trim();
    if (!t) {
      searchSection.style.display = 'none';
      searchResultList.innerHTML = '';
      return;
    }
    const isCase = !!caseSensitive.checked;
    const needle = isCase ? t : t.toLowerCase();
    const filterColor = colorFilter ? colorFilter.value : '';
    const results = keywords
      .map((k, idx) => ({ k, idx }))
      .filter(({ k }) => (isCase ? k.text.includes(needle) : k.text.toLowerCase().includes(needle)))
      .filter(({ k }) => !filterColor || k.color === filterColor);

    searchResultList.innerHTML = '';
    results.forEach(({ k, idx }) => {
      const li = document.createElement('li');
      li.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px dashed #ffe066; border-radius:4px; margin-bottom:6px; padding:4px 8px;';

      const colorDot = document.createElement('div');
      colorDot.className = 'color-btn small';
      colorDot.style.background = k.color;
      colorDot.style.marginRight = '8px';

      const textSpan = document.createElement('span');
      textSpan.textContent = k.text;
      textSpan.style.cssText = 'flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';

      const goBtn = document.createElement('button');
      goBtn.textContent = '定位';
      goBtn.style.cssText = 'background:#fff; color:#e09f3e; border:1px solid #e09f3e; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:12px;';
      goBtn.onclick = () => {
        const target = keywordList.querySelector(`li[data-index="${idx}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const oldOutline = target.style.outline;
          target.style.outline = '2px solid #e09f3e';
          setTimeout(() => { target.style.outline = oldOutline || ''; }, 1200);
        }
      };

      const left = document.createElement('div');
      left.style.cssText = 'display:flex; align-items:center; gap:8px; flex:1; min-width:0;';
      left.appendChild(colorDot);
      left.appendChild(textSpan);

      li.appendChild(left);
      li.appendChild(goBtn);
      searchResultList.appendChild(li);
    });

    searchSection.style.display = results.length ? 'block' : 'none';
  }

  // 保存配置
  function saveConfig() {
    chrome.storage.local.set({
      keywords,
      caseSensitive: caseSensitive.checked,
      isHighlightEnabled: isHighlightEnabled // 保存高亮开关状态
    }, () => {
      // 通知所有已打开的页面更新高亮
      chrome.storage.local.set({ keywords }, () => {
        if (chrome.runtime.lastError) {
          console.error('storage.set 保存关键词失败:', chrome.runtime.lastError.message);
        } else {
          // 设置扩展图标徽章作为操作反馈
          try {
            chrome.action.setBadgeText({ text: '+' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1200);
          } catch (e) {
            console.warn('设置徽章提示失败：', e);
          }
        }
        // 通知所有已打开的页面更新高亮
        try {
          chrome.tabs.query({}, function(tabs) {
            for (let tab of tabs) {
              if (tab && tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'UPDATE_HIGHLIGHT' }, () => {
                  if (chrome.runtime.lastError) {
                    console.warn('发送 UPDATE_HIGHLIGHT 失败：', chrome.runtime.lastError.message);
                  }
                });
                chrome.tabs.sendMessage(tab.id, { type: 'POPUP_UPDATE_KEYWORDS' }, () => {
                  if (chrome.runtime.lastError) {
                    console.warn('发送 POPUP_UPDATE_KEYWORDS 失败：', chrome.runtime.lastError.message);
                  }
                });
                chrome.tabs.sendMessage(tab.id, {
                  type: 'SHOW_NOTIFICATION',
                  message: `已添加关键词 "${selection}"`
                }, () => {
                  if (chrome.runtime.lastError) {
                    // 常见于不可注入的页面（如 chrome:// 或 PDF viewer），仅记录告警
                    console.warn('发送 SHOW_NOTIFICATION 失败：', chrome.runtime.lastError.message);
                  }
                });
              }
            }
          });
        } catch (err) {
          console.error('发送更新高亮消息时出错:', err);
        }
      });
    });
  }

  // 添加关键词
  addBtn.onclick = () => {
    const text = keywordInput.value.trim();
    if (!text) return alert('请输入关键词');
    if (keywords.some(k => k.text === text)) return alert('已存在该关键词');
    keywords.push({ text, color: selectedColor, visible: true });
    keywordInput.value = '';
    saveConfig();
    renderKeywordList();
    renderSearchResults('');
  };

  // 搜索关键词
  // 移除搜索按钮点击绑定
  // if (searchBtn) {
  //   searchBtn.onclick = () => {
  //     renderSearchResults(keywordInput.value.trim());
  //   };
  // }
  // 搜索相关：仅保留清除按钮（输入事件触发即时检索）
  if (clearSearchBtn) {
    clearSearchBtn.onclick = () => {
      keywordInput.value = '';
      renderSearchResults('');
    };
  }
  // 事件委托兜底：仅处理清除按钮
  panel.addEventListener('click', (e) => {
    const clearTrigger = e.target.closest('#clear-search');
    if (clearTrigger) {
      e.preventDefault();
      keywordInput.value = '';
      renderSearchResults('');
    }
  });

  // 其他事件绑定
  caseSensitive.onchange = () => {
    saveConfig();
    // 搜索结果根据大小写设置实时更新
    renderSearchResults(keywordInput.value.trim());
  };

  // 新增：颜色筛选变更时刷新列表与搜索结果，并根据所选颜色调整下拉背景/文字色
  if (colorFilter) {
    const applyFilterStyle = () => {
      const val = colorFilter.value;
      if (val) {
        colorFilter.style.background = val;
        // 指定的几个颜色使用黑色字体，其余使用白色
        if (val === '#ffff00' || val === '#00ff00' || val === '#00e5ff' || val === '#00ffd0') {
          colorFilter.style.color = '#000';
        } else {
          colorFilter.style.color = '#fff';
        }
      } else {
        colorFilter.style.background = '#fff';
        colorFilter.style.color = '#333';
      }
    };
    colorFilter.onchange = () => {
      applyFilterStyle();
      renderKeywordList();
      renderSearchResults(keywordInput.value.trim());
    };
    // 初始化一次样式
    applyFilterStyle();
  }
  // 确保主输入框的复制粘贴快捷键正常工作 + 回车=添加关键词
  keywordInput.addEventListener('keydown', (e) => {
    // 正在中文等输入法组合输入时不响应
    if (e.isComposing) return;

    // 回车键等同于点击“添加”按钮
    if (e.key === 'Enter') {
      e.preventDefault();
      if (addBtn) addBtn.click();
      return;
    }

    // 允许复制粘贴快捷键正常工作
    if (e.ctrlKey || e.metaKey) {
      return; // 不阻止 Ctrl/Cmd 组合键
    }
  });
  // 输入联动自动检索
  keywordInput.addEventListener('input', () => {
    renderSearchResults(keywordInput.value.trim());
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

// 处理右键菜单点击：添加为高亮（顶层监听器）
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-highlight' && info.selectionText) {
    const selection = (info.selectionText || '').trim();
    if (!selection) return;

    // 预通知，便于用户感知和诊断
    try {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'SHOW_NOTIFICATION', message: `正在添加高亮 "${selection}"` }, () => {
          if (chrome.runtime.lastError) {
            console.warn('预通知发送失败：', chrome.runtime.lastError.message);
          }
        });
      }
    } catch (e) {
      console.warn('发送预通知异常：', e);
    }

    const highlightColors = ['#ffff00','#00ff00','#00e5ff','#ff00ff','#ff8000','#a020f0','#00ffd0','#ff0000','#ff1493','#ff4500'];

    chrome.storage.local.get(['keywords'], (data) => {
      const keywords = Array.isArray(data.keywords) ? data.keywords : [];
      if (keywords.some(k => k.text === selection)) {
        try {
          if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'SHOW_NOTIFICATION', message: `关键词 "${selection}" 已存在` }, () => {
              if (chrome.runtime.lastError) {
                console.warn('发送“已存在”通知失败：', chrome.runtime.lastError.message);
              }
            });
          }
        } catch (err) {
          console.error('发送“已存在”通知时出错:', err);
        }
        return;
      }

      const color = highlightColors[keywords.length % highlightColors.length];
      keywords.push({ id: Date.now().toString(), text: selection, color, visible: true, caseSensitive: false, wholeWord: false });

      chrome.storage.local.set({ keywords }, () => {
        if (chrome.runtime.lastError) {
          console.error('storage.set 保存关键词失败:', chrome.runtime.lastError.message);
        } else {
          try {
            chrome.action.setBadgeText({ text: '+' });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1200);
          } catch (e) {
            console.warn('设置徽章提示失败：', e);
          }
        }

        try {
          chrome.tabs.query({}, function(tabs) {
            for (let t of tabs) {
              if (t && t.id) {
                chrome.tabs.sendMessage(t.id, { type: 'UPDATE_HIGHLIGHT' }, () => {
                  if (chrome.runtime.lastError) {
                    console.warn('发送 UPDATE_HIGHLIGHT 失败：', chrome.runtime.lastError.message);
                  }
                });
                chrome.tabs.sendMessage(t.id, { type: 'POPUP_UPDATE_KEYWORDS' }, () => {
                  if (chrome.runtime.lastError) {
                    console.warn('发送 POPUP_UPDATE_KEYWORDS 失败：', chrome.runtime.lastError.message);
                  }
                });
                chrome.tabs.sendMessage(t.id, { type: 'SHOW_NOTIFICATION', message: `已添加关键词 "${selection}"` }, () => {
                  if (chrome.runtime.lastError) {
                    console.warn('发送 SHOW_NOTIFICATION 失败：', chrome.runtime.lastError.message);
                  }
                });
              }
            }
          });
        } catch (err) {
          console.error('发送更新高亮消息时出错:', err);
        }
      });
    });
  }
});

// 顶层消息监听：打开设置页
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'OPEN_OPTIONS_PAGE') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('打开设置页面失败:', chrome.runtime.lastError);
        try { sendResponse({ success: false, error: chrome.runtime.lastError.message }); } catch (_) {}
      } else {
        console.log('设置页面已打开，标签页ID:', tab && tab.id);
        try { sendResponse({ success: true, tabId: tab && tab.id }); } catch (_) {}
      }
    });
    return true; // 异步响应
  }
});


// 确保浏览器启动或服务工作线程唤醒后右键菜单存在（MV3中建议在启动时创建/恢复）
chrome.runtime.onStartup.addListener(() => {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'add-highlight',
        title: '添加为高亮',
        contexts: ['selection']
      });
    });
  } catch (e) {
    console.warn('初始化右键菜单时出错：', e);
  }
});