function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRegex(keyword, caseSensitive) {
  let pattern = escapeRegExp(keyword);
  return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
}

function highlightAll() {
  removeHighlights();
  chrome.storage.local.get(['keywords', 'caseSensitive'], (data) => {
    if (!data.keywords || !data.keywords.length) return;
    data.keywords.forEach(item => {
      highlightKeyword(item.text, item.color, data.caseSensitive);
    });
  });
}

function highlightKeyword(keyword, color, caseSensitive) {
  if (!keyword) return;
  const regex = getRegex(keyword, caseSensitive);
  walk(document.body, node => {
    if (node.nodeType === 3 && node.nodeValue.trim()) {
      let match;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      const text = node.nodeValue;
      while ((match = regex.exec(text)) !== null) {
        const before = text.slice(lastIdx, match.index);
        if (before) frag.appendChild(document.createTextNode(before));
        const mark = document.createElement('mark');
        mark.textContent = match[0];
        mark.style.background = color;
        // 根据背景色自动判断字体颜色
        if (isLightColor(color)) {
          mark.style.color = '#222';
        } else {
          mark.style.color = '#fff';
        }
        mark.className = 'multi-find-highlight';
        // 让发光色与背景色同步
        mark.style.boxShadow = `0 0 2px 1px ${hexToRgba(color,0.8)}, 0 0 4px 2px ${hexToRgba(color,0.5)}, 2px 2px 4px 0px rgba(0,0,0,0.25)`;
        // 防止高亮影响 a 标签点击
        mark.style.pointerEvents = 'none';
        frag.appendChild(mark);
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      }
      if (frag.childNodes.length) {
        node.parentNode.replaceChild(frag, node);
      }
    }
  });
}

function removeHighlights() {
  document.querySelectorAll('mark.multi-find-highlight').forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });
}

function walk(node, callback) {
  if (node.nodeType === 3) {
    callback(node);
  } else if (node.nodeType === 1) {
    // 跳过不需要高亮的标签
    if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(node.tagName)) return;
    // 递归遍历子节点
    for (let i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i], callback);
    }
    // 递归遍历 shadowRoot
    if (node.shadowRoot) {
      walk(node.shadowRoot, callback);
    }
  }
}

// 16进制转rgba
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

// 判断颜色是否为亮色
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

// 注入荧光高亮基础样式（不含box-shadow）
(function injectHighlightStyle() {
  if (document.getElementById('multi-find-highlight-style')) return;
  const style = document.createElement('style');
  style.id = 'multi-find-highlight-style';
  style.textContent = `
    mark.multi-find-highlight {
      position: relative;
      border-radius: 4px;
      color: #222;
      padding: 0 2px;
      background-clip: padding-box;
      /* 兼容不同背景色 */
    }
  `;
  document.head.appendChild(style);
})();

// 监听 DOM 变化，自动高亮（适配 SPA/AJAX 动态页面）
(function observeDomForHighlight() {
  let lastKeywords = '';
  const observer = new MutationObserver(() => {
    // 只在关键词有变化或页面内容变化时重新高亮，防止死循环
    chrome.storage.local.get(['keywords', 'caseSensitive'], (data) => {
      const current = JSON.stringify(data.keywords);
      if (current !== lastKeywords) {
        lastKeywords = current;
        highlightAll();
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_HIGHLIGHT') {
    highlightAll();
  }
});

// 监听 storage 变化，实现多页面自动同步
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    // 关键词变化时重新高亮
    if (changes.keywords) {
      highlightAll();
    }
    // 大小写敏感设置变化时重新高亮
    if (changes.caseSensitive) {
      highlightAll();
    }
    // 高亮开关状态变化时处理
    if (changes.isHighlightEnabled) {
      if (changes.isHighlightEnabled.newValue === false) {
        removeHighlights();
      } else {
        highlightAll();
      }
    }
  }
});

window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TOGGLE_MULTI_HIGHLIGHT') {
    if (event.data.enabled === false) {
      removeHighlights();
    } else {
      highlightAll();
    }
  }
});



highlightAll(); 