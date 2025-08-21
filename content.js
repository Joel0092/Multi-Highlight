function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRegex(keyword, caseSensitive) {
  let pattern = escapeRegExp(keyword);
  return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
}

function highlightAll() {
  // 使用Promise优化异步操作，减少延迟
  return new Promise((resolve) => {
    // 先清除旧高亮
    removeHighlights();
    
    chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
      // 如果高亮被禁用或没有关键词，则直接返回
      if (!data.keywords || !data.keywords.length || data.isHighlightEnabled === false) {
        resolve();
        return;
      }
      
      try {
        // 过滤有效关键词和可见关键词
        const validKeywords = data.keywords.filter(item => 
          item.text && 
          item.text.trim() && 
          item.visible !== false // 只高亮visible不为false的关键词
        );
        if (!validKeywords.length) {
          resolve();
          return;
        }
        
        // 预先编译所有正则表达式，避免重复创建
        const regexCache = new Map();
        validKeywords.forEach(item => {
          if (item.text && item.text.trim()) {
            regexCache.set(item, getRegex(item.text, data.caseSensitive));
          }
        });
        
        // 优先处理主文档，提高用户感知速度
        const startTime = performance.now();
        
        // 使用requestAnimationFrame确保在下一帧渲染前执行高亮
        requestAnimationFrame(() => {
          // 处理主文档
          validKeywords.forEach(item => {
            if (regexCache.has(item)) {
              highlightKeyword(item.text, item.color, data.caseSensitive, regexCache.get(item));
            }
          });
          
          // 缓存所有iframe文档，避免重复获取
          const iframeDocBodies = [];
          const iframes = document.querySelectorAll('iframe');
          if (iframes.length > 0) {
            iframes.forEach(iframe => {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc && iframeDoc.body) {
                  iframeDocBodies.push(iframeDoc.body);
                }
              } catch (e) {
                // 跨域iframe无法访问，忽略错误
              }
            });
          }
          
          // 处理所有缓存的iframe
          if (iframeDocBodies.length > 0) {
            // 使用requestIdleCallback或setTimeout处理iframe，避免阻塞主线程
            const processIframes = () => {
              iframeDocBodies.forEach(body => {
                validKeywords.forEach(item => {
                  if (regexCache.has(item)) {
                    highlightIframeContent(body, item.text, item.color, data.caseSensitive, regexCache.get(item));
                  }
                });
              });
              
              const processingTime = performance.now() - startTime;
              console.log(`高亮处理完成，耗时: ${processingTime.toFixed(2)}ms`);
              resolve();
            };
            
            // 如果支持requestIdleCallback，使用它在浏览器空闲时处理iframe
            if (window.requestIdleCallback) {
              requestIdleCallback(processIframes, { timeout: 1000 });
            } else {
              // 否则使用setTimeout，但给主线程一些时间来响应用户交互
              setTimeout(processIframes, 0);
            }
          } else {
            const processingTime = performance.now() - startTime;
            console.log(`高亮处理完成，耗时: ${processingTime.toFixed(2)}ms`);
            resolve();
          }
        });
      } catch (e) {
        // 忽略整体高亮过程中可能出现的错误
        console.error("高亮处理出错：", e.message);
        resolve();
      }
    });
  });
}

// 专门用于处理iframe内容的高亮函数
function highlightIframeContent(iframeBody, keyword, color, caseSensitive, precompiledRegex) {
  // 参数验证
  if (!keyword || !iframeBody) return;
  
  try {
    // 快速检查是否为可编辑区域
    if (iframeBody.isContentEditable || 
        (iframeBody.getAttribute && iframeBody.getAttribute('contenteditable') === 'true')) {
      return; // 跳过可编辑区域
    }
    
    // 检查iframe是否为邮件编辑器 - 使用简化检查
    if (iframeBody.id) {
      const id = iframeBody.id.toLowerCase();
      if (id.includes('editor') || id.includes('compose') || id.includes('mail')) {
        return; // 跳过邮件编辑器
      }
    }
    
    if (iframeBody.className) {
      const className = iframeBody.className.toLowerCase();
      if (className.includes('editor') || className.includes('compose') || className.includes('mail')) {
        return; // 跳过邮件编辑器
      }
    }
  } catch (e) {
    // 忽略检查错误
  }
  
  try {
    // 获取iframe的document对象
    const iframeDoc = iframeBody.ownerDocument || document;
    if (!iframeDoc) return;
    
    // 使用预编译的正则表达式或创建新的正则表达式
    const regex = precompiledRegex || getRegex(keyword, caseSensitive);
    if (!regex) return;
    
    // 优化：使用关键词和大小写设置组合作为缓存键
    if (!iframeBody.dataset) iframeBody.dataset = {};
    const keywordHash = `${keyword}_${caseSensitive ? 'cs' : 'ci'}`;
    const processedKeywords = iframeBody.dataset.processedKeywords || '';
    if (processedKeywords.includes(keywordHash)) {
      return; // 已处理过此关键词配置
    }
    
    // 记录已处理的关键词
    iframeBody.dataset.processedKeywords = processedKeywords + '|' + keywordHash;
    
    // 优化：预先检查文档是否包含关键词，避免不必要的遍历
    const textContent = iframeBody.textContent || '';
    if (!regex.test(textContent)) {
      return; // 文档不包含关键词，跳过处理
    }
    
    // 遍历iframe内容
    walk(iframeBody, node => {
      try {
        // 只处理文本节点，且内容不为空
        if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) {
          processTextNode(node, iframeDoc, regex, color);
        }
      } catch (e) {
        // 忽略单个节点处理错误
      }
    });
  } catch (e) {
    // 忽略处理iframe内容时可能出现的错误
  }
}

// 全局共享的processTextNode函数，用于处理文本节点高亮
function processTextNode(node, doc, regex, color) {
  // 快速检查文本是否包含关键词
  regex.lastIndex = 0;
  if (!regex.test(node.nodeValue)) return false;
  
  // 检查父节点
  const parent = node.parentNode;
  if (!parent) return false;
  
  // 跳过已经高亮的内容
  if (parent.nodeName === 'MARK' && parent.classList.contains('multi-find-highlight')) {
    return false;
  }
  
  // 跳过输入框和编辑区域内的文本
  if (parent.isContentEditable || 
      parent.tagName === 'INPUT' || 
      parent.tagName === 'TEXTAREA' || 
      (parent.getAttribute && parent.getAttribute('contenteditable') === 'true') ||
      parent.closest && (parent.closest('[contenteditable="true"]') || 
                        parent.closest('input') || 
                        parent.closest('textarea'))) {
    return false;
  }
  
  // 检查是否在邮件编辑器内 - 但允许在收件人区域高亮
  const isInEmailEditor = parent.closest && (
    parent.closest('[id*="editor"]') || 
    parent.closest('[id*="compose"]') || 
    parent.closest('[class*="editor"]') || 
    parent.closest('[class*="compose"]')
  );
  
  // 检查是否为收件人区域
  const isRecipientArea = parent.closest && (
    parent.closest('[id*="recipient"]') ||
    parent.closest('[id*="to-field"]') ||
    parent.closest('[class*="recipient"]') ||
    parent.closest('[class*="address"]') ||
    parent.closest('[class*="contact"]')
  );
  
  // 如果在邮件编辑器内但不是收件人区域，则跳过
  if (isInEmailEditor && !isRecipientArea) {
    return false;
  }
  
  let match;
  const frag = doc.createDocumentFragment();
  let lastIdx = 0;
  const text = node.nodeValue;
  
  // 重置regex的lastIndex
  regex.lastIndex = 0;
  
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIdx, match.index);
    if (before) frag.appendChild(doc.createTextNode(before));
    
    const mark = doc.createElement('mark');
    mark.textContent = match[0];
    mark.style.background = color;
    // 根据背景色自动判断字体颜色
    mark.style.color = (color === '#ffff00' || color === '#00ff00' || color === '#00e5ff' || color === '#00ffd0') ? '#000' : '#fff';
    mark.className = 'multi-find-highlight';
    // 添加荧光效果
    mark.style.boxShadow = `0 0 12px ${hexToRgba(color,0.8)}`;
    mark.style.textShadow = '0 0 2px rgba(0,0,0,0.2)';
    // 防止高亮影响 a 标签点击
    mark.style.pointerEvents = 'none';
    frag.appendChild(mark);
    lastIdx = match.index + match[0].length;
  }
  
  if (lastIdx < text.length) {
    frag.appendChild(doc.createTextNode(text.slice(lastIdx)));
  }
  
  if (frag.childNodes.length > 1 && node.parentNode) { // 确保有实际变化
    try {
      node.parentNode.replaceChild(frag, node);
      return true; // 成功替换
    } catch (e) {
      // 忽略替换节点时可能出现的错误
      return false;
    }
  }
  
  return false; // 没有替换
}

function highlightKeyword(keyword, color, caseSensitive, precompiledRegex) {
  if (!keyword) return;
  
  // 使用预编译的正则表达式或创建新的正则表达式
  const regex = precompiledRegex || getRegex(keyword, caseSensitive);
  
  // 优化：预先检查文档是否包含关键词，避免不必要的遍历
  const bodyText = document.body.textContent || '';
  if (!regex.test(bodyText)) return; // 文档不包含关键词，跳过处理
  
  // 使用优化的walk函数遍历DOM
  walk(document.body, node => {
    try {
      // 只处理文本节点，且内容不为空
      if (node.nodeType === 3 && node.nodeValue && node.nodeValue.trim()) {
        processTextNode(node, document, regex, color);
      }
    } catch (e) {
      // 忽略单个节点处理错误
    }
  });
}

// 优化的removeHighlights函数，使用批量处理减少DOM操作
function removeHighlights() {
  try {
    // 清除主文档中的高亮 - 使用批量处理
    const highlights = document.querySelectorAll('mark.multi-find-highlight');
    if (highlights.length > 0) {
      // 按父节点分组，减少normalize()调用次数
      const parentMap = new Map();
      
      highlights.forEach(el => {
        try {
          if (el && el.parentNode) {
            // 将相同父节点的元素分组
            if (!parentMap.has(el.parentNode)) {
              parentMap.set(el.parentNode, []);
            }
            parentMap.get(el.parentNode).push(el);
          }
        } catch (e) {
          // 忽略单个元素处理错误
        }
      });
      
      // 批量处理每个父节点下的高亮元素
      parentMap.forEach((elements, parent) => {
        try {
          // 创建一个文档片段来存储所有替换内容
          const frag = document.createDocumentFragment();
          let lastNode = null;
          let needsNormalize = false;
          
          // 获取父节点的所有子节点
          const childNodes = Array.from(parent.childNodes);
          
          // 处理每个子节点
          childNodes.forEach(node => {
            if (node.nodeType === 1 && node.tagName === 'MARK' && node.className === 'multi-find-highlight') {
              // 如果是高亮元素，替换为文本节点
              frag.appendChild(document.createTextNode(node.textContent));
              needsNormalize = true;
            } else {
              // 否则保留原节点
              frag.appendChild(node.cloneNode(true));
            }
          });
          
          // 清空父节点并添加处理后的内容
          while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
          }
          parent.appendChild(frag);
          
          // 只在必要时调用normalize
          if (needsNormalize) {
            parent.normalize();
          }
        } catch (e) {
          // 忽略批量处理错误
        }
      });
    }
    
    // 清除所有iframe中的高亮 - 使用缓存减少重复获取
    const iframes = document.querySelectorAll('iframe');
    if (iframes.length > 0) {
      iframes.forEach(iframe => {
        try {
          const iframeDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
          if (iframeDoc && iframeDoc.body) {
            // 清除iframe中的处理标记，允许重新处理
            if (iframeDoc.body.dataset && iframeDoc.body.dataset.processedKeywords) {
              iframeDoc.body.dataset.processedKeywords = '';
            }
            
            const iframeHighlights = iframeDoc.querySelectorAll('mark.multi-find-highlight');
            if (iframeHighlights.length > 0) {
              // 按父节点分组，减少normalize()调用次数
              const parentMap = new Map();
              
              iframeHighlights.forEach(el => {
                try {
                  if (el && el.parentNode) {
                    // 将相同父节点的元素分组
                    if (!parentMap.has(el.parentNode)) {
                      parentMap.set(el.parentNode, []);
                    }
                    parentMap.get(el.parentNode).push(el);
                  }
                } catch (e) {
                  // 忽略单个元素处理错误
                }
              });
              
              // 批量处理每个父节点下的高亮元素
              parentMap.forEach((elements, parent) => {
                try {
                  // 创建一个文档片段来存储所有替换内容
                  const frag = iframeDoc.createDocumentFragment();
                  let needsNormalize = false;
                  
                  // 获取父节点的所有子节点
                  const childNodes = Array.from(parent.childNodes);
                  
                  // 处理每个子节点
                  childNodes.forEach(node => {
                    if (node.nodeType === 1 && node.tagName === 'MARK' && node.className === 'multi-find-highlight') {
                      // 如果是高亮元素，替换为文本节点
                      frag.appendChild(iframeDoc.createTextNode(node.textContent));
                      needsNormalize = true;
                    } else {
                      // 否则保留原节点
                      frag.appendChild(node.cloneNode(true));
                    }
                  });
                  
                  // 清空父节点并添加处理后的内容
                  while (parent.firstChild) {
                    parent.removeChild(parent.firstChild);
                  }
                  parent.appendChild(frag);
                  
                  // 只在必要时调用normalize
                  if (needsNormalize) {
                    parent.normalize();
                  }
                } catch (e) {
                  // 忽略批量处理错误
                }
              });
            }
          }
        } catch (e) {
          // 跨域iframe无法访问，忽略错误
        }
      });
    }
  } catch (e) {
    // 忽略整体清除过程中可能出现的错误
  }
}

// 优化的walk函数，使用迭代而非递归，减少调用栈开销
function walk(node, callback) {
  try {
    if (!node) return;
    
    // 使用迭代代替递归，减少调用栈开销
    const nodeStack = [node];
    const skipTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT", "SVG", "CANVAS", "VIDEO", "AUDIO"]);
    
    while (nodeStack.length > 0) {
      const currentNode = nodeStack.pop();
      
      if (!currentNode) continue;
      
      if (currentNode.nodeType === 3) { // 文本节点
        callback(currentNode);
      } else if (currentNode.nodeType === 1) { // 元素节点
        // 快速检查是否跳过此标签
        if (skipTags.has(currentNode.tagName)) continue;
        
        // 检查是否为可编辑区域
        if (currentNode.isContentEditable) continue;
        
        // 处理iframe内容
        if (currentNode.tagName === "IFRAME") {
          try {
            const iframeDoc = currentNode.contentDocument || (currentNode.contentWindow && currentNode.contentWindow.document);
            if (iframeDoc && iframeDoc.body) {
              // 将iframe的body添加到栈中而不是立即处理
              nodeStack.push(iframeDoc.body);
            }
          } catch (e) {
            // 跨域iframe无法访问，忽略错误
          }
          continue; // 处理完iframe后继续下一个节点
        }
        
        // 处理shadowRoot
        if (currentNode.shadowRoot) {
          nodeStack.push(currentNode.shadowRoot);
        }
        
        // 将子节点按倒序添加到栈中，这样处理时会按正序处理
        const childNodes = currentNode.childNodes;
        if (childNodes && childNodes.length) {
          for (let i = childNodes.length - 1; i >= 0; i--) {
            nodeStack.push(childNodes[i]);
          }
        }
      }
    }
  } catch (e) {
    // 忽略遍历过程中可能出现的错误
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

// 实现单个关键词高亮开关功能
function toggleKeywordHighlight(keywordId, enabled) {
  try {
    chrome.storage.local.get(['keywords'], (data) => {
      const keywords = data.keywords || [];
      const updatedKeywords = keywords.map(keyword => {
        if (keyword.id === keywordId) {
          return { ...keyword, enabled: enabled };
        }
        return keyword;
      });
      
      chrome.storage.local.set({ keywords: updatedKeywords }, () => {
        // 更新高亮
        highlightAll();
      });
    });
  } catch (err) {
    console.error('切换关键词高亮状态时出错:', err);
  }
}

// 优化的样式注入函数，减少资源消耗并提高性能
(function injectHighlightStyle() {
  // 高亮样式内容 - 提取为常量避免重复创建
  const HIGHLIGHT_STYLE = `
    mark.multi-find-highlight {
      position: relative;
      border-radius: 3px;
      color: #222;
      padding: 0 1px;
      background-clip: padding-box;
      /* 荧光效果 */
      box-shadow: 0 0 12px rgba(0, 0, 0, 0.5);
      text-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
      /* 优化渲染性能 */
      will-change: auto;
      contain: content;
    }
  `;
  
  // 已处理的iframe集合，避免重复处理
  const processedIframes = new WeakSet();
  
  // 为主文档注入样式
  function injectStyleToMainDocument() {
    if (!document.getElementById('multi-find-highlight-style') && document.head) {
      const style = document.createElement('style');
      style.id = 'multi-find-highlight-style';
      style.textContent = HIGHLIGHT_STYLE;
      document.head.appendChild(style);
    }
  }
  
  // 为所有可访问的iframe注入样式 - 使用节流函数限制频率
  const throttledInjectStyleToIframes = throttle(function() {
    const iframes = document.querySelectorAll('iframe');
    let newIframesFound = false;
    
    iframes.forEach(iframe => {
      // 跳过已处理的iframe
      if (processedIframes.has(iframe)) return;
      
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && iframeDoc.head && !iframeDoc.getElementById('multi-find-highlight-style')) {
          const iframeStyle = iframeDoc.createElement('style');
          iframeStyle.id = 'multi-find-highlight-style';
          iframeStyle.textContent = HIGHLIGHT_STYLE;
          iframeDoc.head.appendChild(iframeStyle);
          
          // 标记为已处理
          processedIframes.add(iframe);
          newIframesFound = true;
          
          // 新 iframe 加载完成后补触发一次（立即 + 尾触发）
          try {
            if (!iframe.__mlh_onload_bound) {
              iframe.addEventListener('load', () => {
                try {
                  chrome.storage.local.get(['isHighlightEnabled'], (data) => {
                    if (data && data.isHighlightEnabled === false) return;
                    requestAnimationFrame(() => {
                      highlightAll();
                      setTimeout(() => highlightAll(), 300);
                    });
                  });
                } catch (e) {
                  requestAnimationFrame(() => {
                    highlightAll();
                    setTimeout(() => highlightAll(), 300);
                  });
                }
              });
              iframe.__mlh_onload_bound = true;
            }
          } catch (e) { /* 忽略绑定失败 */ }
        }
      } catch (e) {
        // 跨域iframe无法访问，忽略错误
      }
    });
    
    return newIframesFound; // 返回是否找到新iframe
  }, 1000); // 1秒节流间隔
  
  // 初始注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectStyleToMainDocument();
      throttledInjectStyleToIframes();
    }, { once: true }); // 使用once选项确保事件只触发一次
  } else {
    injectStyleToMainDocument();
    throttledInjectStyleToIframes();
  }
  
  // 使用节流函数处理DOM变化，限制处理频率
  const throttledProcessMutations = throttle((mutations) => {
    const hasIframeChanges = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => 
        node.nodeType === 1 && (node.tagName === 'IFRAME' || (node.querySelector && node.querySelector('iframe')))
      );
    });
    
    if (hasIframeChanges) {
      throttledInjectStyleToIframes();
    }
  }, 1000); // 1秒节流间隔
  
  // 优化的观察器配置，减少不必要的触发
  const observerConfig = { 
    childList: true, 
    subtree: true,
    // 不监听属性和文本变化，减少触发次数
    attributes: false,
    characterData: false
  };
  
  // 创建观察器
  const observer = new MutationObserver(throttledProcessMutations);
  
  // 确保body已加载
  if (document.body) {
    observer.observe(document.body, observerConfig);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, observerConfig);
    }, { once: true }); // 使用once选项确保事件只触发一次
  }
  
  // 针对邮箱页面，定期检查并注入样式，但大幅降低频率
  const isEmailPage = window.location.href.includes('mail.') || 
                     window.location.href.includes('outlook.') || 
                     window.location.href.includes('gmail.') || 
                     window.location.href.includes('yahoo.mail');
  
  let styleInterval = null;
  
  if (isEmailPage) {
    // 邮箱页面上，降低检查频率到8秒一次
    styleInterval = setInterval(() => {
      // 如果没有找到新iframe，逐渐降低检查频率
      const newIframesFound = throttledInjectStyleToIframes();
      
      // 如果连续多次没有找到新iframe，可以考虑清除定时器
      if (!newIframesFound && styleInterval) {
        // 这里可以实现动态调整间隔时间的逻辑
      }
    }, 8000); // 8秒检查一次
    
    // 页面卸载时清除定时器和观察器
    window.addEventListener('unload', () => {
      if (styleInterval) clearInterval(styleInterval);
      if (observer) observer.disconnect();
    }, { once: true }); // 使用once选项确保事件只触发一次
  }
})();

// 节流函数 - 限制函数调用频率
function throttle(func, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

// 防抖函数 - 延迟函数调用直到一段时间内没有再次调用
function debounce(func, delay) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// 优化的DOM观察器，减少不必要的触发和资源消耗
(function observeDomForHighlight() {
  let lastKeywords = '';
  let lastHighlightTime = 0;
  let isInputActive = false;
  let pendingHighlight = false;
  let observerPaused = false;
  
  // 统一的重新高亮调度：立即 + 尾触发（覆盖异步渲染）
  function scheduleRehighlight(reason) {
    try {
      chrome.storage.local.get(['isHighlightEnabled'], (data) => {
        if (data && data.isHighlightEnabled === false) return;
        // 下一帧先做一次，随后延时再补一次
        requestAnimationFrame(() => {
          try { lastHighlightTime = Date.now(); } catch (e) {}
          highlightAll();
          setTimeout(() => {
            try { lastHighlightTime = Date.now(); } catch (e) {}
            highlightAll();
          }, 300);
        });
      });
    } catch (e) {
      // 兜底直接触发
      requestAnimationFrame(() => {
        highlightAll();
        setTimeout(() => highlightAll(), 300);
      });
    }
  }

  // 监听 SPA 路由变化：pushState/replaceState 包装 + popstate/hashchange
  if (!window.__mlh_route_wrapped) {
    try {
      const wrapHistory = (type) => {
        const orig = history[type];
        if (typeof orig === 'function') {
          history[type] = function() {
            const ret = orig.apply(this, arguments);
            try { window.dispatchEvent(new Event('mlh-route-change')); } catch (e) {}
            return ret;
          };
        }
      };
      wrapHistory('pushState');
      wrapHistory('replaceState');
      window.addEventListener('popstate', () => scheduleRehighlight('route-popstate'));
      window.addEventListener('hashchange', () => scheduleRehighlight('route-hashchange'));
      window.addEventListener('mlh-route-change', () => scheduleRehighlight('route-history'));
      window.__mlh_route_wrapped = true;
    } catch (e) {
      // 忽略包装失败
    }
  }
  
  // 检测用户是否正在输入文本 - 使用事件委托减少事件监听器数量
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      isInputActive = true;
      // 暂停观察器以减少CPU使用
      if (observer && !observerPaused) {
        observer.disconnect();
        observerPaused = true;
      }
    }
  }, { passive: true }); // 使用passive选项提高事件性能
  
  document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      isInputActive = false;
      
      // 恢复观察器
      if (observerPaused && document.body) {
        setTimeout(() => {
          observer.observe(document.body, observerConfig);
          observerPaused = false;
        }, 100);
      }
      
      // 输入结束后延迟执行一次高亮，使用防抖函数避免频繁触发
      debouncedHighlight();
    }
  }, { passive: true }); // 使用passive选项提高事件性能
  
  // 使用防抖函数处理高亮，避免频繁触发
  const debouncedHighlight = debounce(() => {
    if (pendingHighlight) return; // 避免重复触发
    
    pendingHighlight = true;
    chrome.storage.local.get(['isHighlightEnabled'], (data) => {
      if (data.isHighlightEnabled !== false) {
        // 确保页面加载完成后立即执行高亮操作
if (document.readyState === 'loading') {
  // 如果页面仍在加载中，等待DOMContentLoaded事件
  document.addEventListener('DOMContentLoaded', () => {
    // 立即执行高亮，不使用防抖或节流
    chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
      if (data.isHighlightEnabled !== false) {
        // 设置最后高亮时间
        lastHighlightTime = Date.now();
        highlightAll();
      }
    });
  }, { once: true }); // 确保事件只触发一次
} else {
  // 如果页面已加载完成，立即执行高亮
  chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
    if (data.isHighlightEnabled !== false) {
      // 设置最后高亮时间
      lastHighlightTime = Date.now();
      highlightAll();
    }
  });
}
      }
      pendingHighlight = false;
    });
  }, 800); // 800ms防抖延迟
  
  // 使用节流函数处理DOM变化，限制处理频率
  const throttledProcessMutations = throttle((mutations) => {
    // 如果用户正在输入，不执行高亮操作
    if (isInputActive || pendingHighlight) return;
    
    // 检查是否有iframe被添加或修改
    const hasIframeChanges = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => 
        node.nodeType === 1 && (node.tagName === 'IFRAME' || (node.querySelector && node.querySelector('iframe')))
      );
    });
    
    // 检查是否有大量DOM变化（可能是内容加载）
    const hasSignificantChanges = mutations.length > 5 || mutations.some(mutation => {
      return mutation.addedNodes.length > 5 || mutation.removedNodes.length > 5;
    });
    
    // 当前时间
    const now = Date.now();
    // 限制高亮频率，避免频繁执行导致性能问题
    const timeSinceLastHighlight = now - lastHighlightTime;
    
    // 只在以下情况重新高亮：
    // 1. iframe有变化
    // 2. 有大量DOM变化（内容加载）
    // 3. 距离上次高亮已经过去至少2000ms（防止频繁触发）
    if ((hasIframeChanges || hasSignificantChanges) && timeSinceLastHighlight > 2000) {
      lastHighlightTime = now;
      
      // 使用防抖函数延迟执行高亮，避免短时间内多次触发
      if (!pendingHighlight) {
        pendingHighlight = true;
        setTimeout(() => {
          chrome.storage.local.get(['isHighlightEnabled'], (data) => {
            if (data.isHighlightEnabled !== false) {
              highlightAll();
            }
            pendingHighlight = false;
          });
        }, 300); // 300ms延迟，等待DOM稳定
      }
    }
  }, 1000); // 1000ms节流间隔
  
  // 优化的观察器配置，减少不必要的触发
  const observerConfig = { 
    childList: true, 
    subtree: true,
    // 不监听属性和文本变化，减少触发次数
    attributes: false,
    characterData: false
  };
  
  // 创建观察器
  const observer = new MutationObserver(throttledProcessMutations);
  
  // 确保body已加载
  if (document.body) {
    observer.observe(document.body, observerConfig);
  } else {
    // 如果body还未加载，等待DOMContentLoaded事件
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, observerConfig);
    }, { once: true }); // 使用once选项确保事件只触发一次
  }
  
  // 定期检查关键词变化，使用节流函数限制频率
  const checkKeywordsInterval = setInterval(() => {
    // 如果用户正在输入或已有待处理的高亮，跳过检查
    if (isInputActive || pendingHighlight) return;
    
    const now = Date.now();
    if (now - lastHighlightTime > 3000) { // 至少3秒间隔
      chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
        // 如果高亮被禁用，则不处理
        if (data.isHighlightEnabled === false) return;
        
        const current = JSON.stringify(data.keywords || []);
        if (current !== lastKeywords) {
          lastKeywords = current;
          lastHighlightTime = now;
          highlightAll();
        }
      });
    }
  }, 3000); // 3秒检查一次关键词变化
  
  // 针对邮箱页面，定期检查iframe内容变化，但大幅降低频率
  const isEmailPage = window.location.href.includes('mail.') || 
                     window.location.href.includes('outlook.') || 
                     window.location.href.includes('gmail.') || 
                     window.location.href.includes('yahoo.mail');
  
  let emailCheckInterval = null;
  
  if (isEmailPage) {
    // 邮箱页面上，移除定时检查，改为监听DOM变化
    
    // 添加监听器，监听整个文档的变化，特别关注收件人栏
    const emailObserver = new MutationObserver(throttle((mutations) => {
      // 如果用户正在输入或已有待处理的高亮，跳过处理
      if (isInputActive || pendingHighlight) return;
      
      // 检查是否需要触发高亮
      let shouldHighlight = false;
      
      // 检查是否有收件人相关元素的变化
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'attributes') {
          const targetNode = mutation.target;
          
          // 检查是否与收件人相关
          if (targetNode.id && (
              targetNode.id.toLowerCase().includes('recipient') || 
              targetNode.id.toLowerCase().includes('address') || 
              targetNode.id.toLowerCase().includes('contact') || 
              targetNode.id.toLowerCase().includes('to') ||
              targetNode.id.toLowerCase().includes('mail') ||
              targetNode.id.toLowerCase().includes('compose') ||
              // 中文与常见字段
              targetNode.id.toLowerCase().includes('subject') ||
              targetNode.id.toLowerCase().includes('cc') ||
              targetNode.id.toLowerCase().includes('bcc') ||
              targetNode.id.includes('发件人') ||
              targetNode.id.includes('收件人') ||
              targetNode.id.includes('抄送') ||
              targetNode.id.includes('密送') ||
              targetNode.id.includes('主题')
          )) {
            shouldHighlight = true;
            break;
          }
          
          // 检查类名
          if (targetNode.className && typeof targetNode.className === 'string' && (
              targetNode.className.toLowerCase().includes('recipient') || 
              targetNode.className.toLowerCase().includes('address') || 
              targetNode.className.toLowerCase().includes('contact') || 
              targetNode.className.toLowerCase().includes('to') ||
              targetNode.className.toLowerCase().includes('mail') ||
              targetNode.className.toLowerCase().includes('compose') ||
              // 中文与常见字段
              targetNode.className.toLowerCase().includes('subject') ||
              targetNode.className.toLowerCase().includes('cc') ||
              targetNode.className.toLowerCase().includes('bcc') ||
              targetNode.className.includes('发件人') ||
              targetNode.className.includes('收件人') ||
              targetNode.className.includes('抄送') ||
              targetNode.className.includes('密送') ||
              targetNode.className.includes('主题')
          )) {
            shouldHighlight = true;
            break;
          }
          
          // 检查是否有新的iframe加载
          if (targetNode.tagName === 'IFRAME' || 
              (mutation.addedNodes && Array.from(mutation.addedNodes).some(node => node.tagName === 'IFRAME'))) {
            shouldHighlight = true;
            break;
          }
        }
      }
      
      // 如果需要触发高亮，立即执行
      if (shouldHighlight) {
        chrome.storage.local.get(['isHighlightEnabled'], (data) => {
          if (data.isHighlightEnabled === false) return;
          
          // 使用requestAnimationFrame确保在下一帧渲染前执行高亮
          requestAnimationFrame(() => {
            lastHighlightTime = Date.now();
            highlightAll();
          });
        });
      }
    }, 100)); // 节流100毫秒，提高响应速度
    
    // 开始监听整个文档
    emailObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'style', 'display']
    });
    
    // 页面加载完成后立即执行一次高亮
    chrome.storage.local.get(['isHighlightEnabled'], (data) => {
      if (data.isHighlightEnabled === false) return;
      
      // 使用requestAnimationFrame确保在下一帧渲染前执行高亮
      requestAnimationFrame(() => {
        lastHighlightTime = Date.now();
        highlightAll();
      });
    });
    
    // 页面卸载时断开观察器
    window.addEventListener('unload', () => {
      emailObserver.disconnect();
    }, { once: true });
  }
  
  // 页面卸载时清除所有定时器和观察器
  window.addEventListener('unload', () => {
    if (observer) observer.disconnect();
    clearInterval(checkKeywordsInterval);
    if (emailCheckInterval) clearInterval(emailCheckInterval);
  }, { once: true }); // 使用once选项确保事件只触发一次
})();

// 显示通知消息的函数
function showNotification(message) {
  // 检查是否已存在通知元素
  let notification = document.getElementById('multi-highlight-notification');
  if (!notification) {
    // 创建通知元素
    notification = document.createElement('div');
    notification.id = 'multi-highlight-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #333;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(notification);
  }
  
  // 设置消息内容
  notification.textContent = message;
  
  // 显示通知
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);
  
  // 3秒后隐藏通知
  setTimeout(() => {
    notification.style.opacity = '0';
    // 完全隐藏后移除元素
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'UPDATE_HIGHLIGHT' || msg.action === 'updateHighlights') {
    try {
      // 确保在处理消息时重新获取最新的存储数据
      chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
        // 如果高亮被禁用，则只清除高亮
        if (data.isHighlightEnabled === false) {
          removeHighlights();
        } else {
          // 否则重新应用高亮
          highlightAll();
        }
        
        // 返回成功响应
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
    } catch (e) {
      // 出错时也返回响应，避免消息挂起
      if (sendResponse) {
        sendResponse({ success: false, error: e.message });
      }
    }
    // 确保消息处理完成后返回true，表示异步响应
    return true;
  } else if (msg.type === 'TOGGLE_HIGHLIGHT') {
    // 切换高亮开关状态
    try {
      const { enabled } = msg;
      chrome.storage.local.set({ isHighlightEnabled: enabled }, () => {
        if (enabled === false) {
          removeHighlights();
        } else {
          highlightAll();
        }
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
    } catch (e) {
      if (sendResponse) {
        sendResponse({ success: false, error: e.message });
      }
    }
    return true;
  } else if (msg.type === 'TOGGLE_KEYWORD') {
    // 切换单个关键词的高亮状态
    try {
      const { keywordId, enabled } = msg;
      chrome.storage.local.get(['keywords'], (data) => {
        const keywords = data.keywords || [];
        const updatedKeywords = keywords.map(keyword => {
          if (keyword.id === keywordId) {
            return { ...keyword, visible: enabled };
          }
          return keyword;
        });
        
        chrome.storage.local.set({ keywords: updatedKeywords }, () => {
          // 更新高亮
          highlightAll();
          if (sendResponse) {
            sendResponse({ success: true });
          }
        });
      });
    } catch (e) {
      if (sendResponse) {
        sendResponse({ success: false, error: e.message });
      }
    }
    return true;
  } else if (msg.type === 'POPUP_UPDATE_KEYWORDS') {
    // 如果弹窗存在，更新关键词列表
    const panel = document.getElementById('multi-highlight-panel');
    if (panel) {
      // 重新加载关键词并更新列表
      chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
        // 更新全局变量
        window.multiHighlightKeywords = data.keywords || [];
        // 重新渲染关键词列表
        if (typeof renderKeywordList === 'function') {
          renderKeywordList();
        } else {
          // 如果renderKeywordList函数不存在，尝试重新创建面板
          if (panel.parentNode) {
            panel.parentNode.removeChild(panel);
            // 延迟一点时间后重新创建面板
            setTimeout(() => {
              if (typeof toggleMultiHighlightPanel === 'function') {
                toggleMultiHighlightPanel();
              }
            }, 100);
          }
        }
      });
    }
    return true;
  } else if (msg.type === 'SHOW_NOTIFICATION') {
    // 显示通知消息
    try {
      if (typeof showNotification === 'function') {
        showNotification(msg.message);
      }
      if (sendResponse) {
        sendResponse({ success: true });
      }
    } catch (e) {
      if (sendResponse) {
        sendResponse({ success: false, error: e.message });
      }
    }
    return true;
  }
  // 其他消息类型也返回true，确保异步响应机制正常工作
  return true;
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


// 确保页面加载完成后立即执行高亮操作
if (document.readyState === 'loading') {
  // 如果页面仍在加载中，等待DOMContentLoaded事件
  document.addEventListener('DOMContentLoaded', () => {
    // 立即执行高亮，不使用防抖或节流
    chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
      if (data.isHighlightEnabled !== false) {
        // 设置最后高亮时间
        if (typeof lastHighlightTime !== 'undefined') {
          lastHighlightTime = Date.now();
        }
        highlightAll();
      }
    });
  }, { once: true }); // 确保事件只触发一次
} else {
  // 如果页面已加载完成，立即执行高亮
  chrome.storage.local.get(['keywords', 'caseSensitive', 'isHighlightEnabled'], (data) => {
    if (data.isHighlightEnabled !== false) {
      // 设置最后高亮时间
      if (typeof lastHighlightTime !== 'undefined') {
        lastHighlightTime = Date.now();
      }
      highlightAll();
    }
  });
}