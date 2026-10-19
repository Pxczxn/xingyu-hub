/*
 * 移动端触摸目标尺寸检查
 *
 * WCAG 2.1 Level AAA 要求：
 * - 所有可交互元素至少 44x44 CSS 像素
 * - 或者有足够的间距（与其他目标至少 8px）
 *
 * 这个脚本用于开发环境检查，不打包到生产环境
 */

interface TouchTargetIssue {
  element: Element;
  width: number;
  height: number;
  selector: string;
  location: string;
}

const MIN_SIZE = 44; // WCAG AAA 标准
const MIN_SIZE_AA = 24; // WCAG AA 标准（更宽松）

/**
 * 检查单个元素的触摸目标尺寸
 */
function checkElement(element: Element): TouchTargetIssue | null {
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  // 只检查可见元素
  if (width === 0 || height === 0) return null;

  // 尺寸不足
  if (width < MIN_SIZE || height < MIN_SIZE) {
    return {
      element,
      width,
      height,
      selector: getSelector(element),
      location: getLocation(element),
    };
  }

  return null;
}

/**
 * 获取元素的 CSS 选择器
 */
function getSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  
  const classes = Array.from(element.classList)
    .filter(c => !c.startsWith('_')) // 过滤 CSS Modules 类名
    .slice(0, 3)
    .join('.');
  
  const tag = element.tagName.toLowerCase();
  return classes ? `${tag}.${classes}` : tag;
}

/**
 * 获取元素在页面中的位置描述
 */
function getLocation(element: Element): string {
  const ancestors: string[] = [];
  let current: Element | null = element;
  
  while (current && ancestors.length < 3) {
    if (current.getAttribute('aria-label')) {
      ancestors.push(`[aria-label="${current.getAttribute('aria-label')}"]`);
    } else if (current.id) {
      ancestors.push(`#${current.id}`);
    }
    current = current.parentElement;
  }
  
  return ancestors.reverse().join(' > ') || 'unknown';
}

/**
 * 检查所有可交互元素
 */
export function checkTouchTargets(): TouchTargetIssue[] {
  const interactiveSelectors = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const issues: TouchTargetIssue[] = [];
  
  interactiveSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(element => {
      const issue = checkElement(element);
      if (issue) {
        issues.push(issue);
      }
    });
  });

  return issues;
}

/**
 * 在控制台输出检查报告
 */
export function reportTouchTargets() {
  const issues = checkTouchTargets();
  
  if (issues.length === 0) {
    console.log(
      '%c✓ 触摸目标检查通过',
      'color: #10b981; font-weight: bold; font-size: 14px;'
    );
    return;
  }

  console.group(
    `%c⚠ 发现 ${issues.length} 个触摸目标过小`,
    'color: #f59e0b; font-weight: bold; font-size: 14px;'
  );
  
  issues.forEach(({ element, width, height, selector, location }) => {
    const meetsAA = width >= MIN_SIZE_AA && height >= MIN_SIZE_AA;
    const level = meetsAA ? 'AA✓ AAA✗' : 'AA✗ AAA✗';
    
    console.group(`${selector} (${width}×${height}px) ${level}`);
    console.log('位置:', location);
    console.log('元素:', element);
    console.log('建议尺寸: 至少 44×44px');
    console.groupEnd();
  });
  
  console.groupEnd();
}

/**
 * 高亮页面上的问题元素
 */
export function highlightTouchTargetIssues() {
  // 移除之前的高亮
  document.querySelectorAll('.touch-target-issue-highlight').forEach(el => el.remove());
  
  const issues = checkTouchTargets();
  
  issues.forEach(({ element }) => {
    const rect = element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'touch-target-issue-highlight';
    highlight.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px dashed #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      pointer-events: none;
      z-index: 10000;
    `;
    document.body.appendChild(highlight);
  });
  
  // 5 秒后自动移除高亮
  setTimeout(() => {
    document.querySelectorAll('.touch-target-issue-highlight').forEach(el => el.remove());
  }, 5000);
}

// 开发环境自动检查
if (import.meta.env.DEV) {
  // 页面加载完成后检查
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(reportTouchTargets, 1000);
    });
  } else {
    setTimeout(reportTouchTargets, 1000);
  }
  
  // 暴露到全局，方便调试。用 Object.assign 而不是 `(window as any)`：
  // 这是仅开发环境存在的调试入口，不需要为一个全局属性打开 any 逃生门。
  Object.assign(window, {
    checkTouchTargets: {
      report: reportTouchTargets,
      highlight: highlightTouchTargetIssues,
      check: checkTouchTargets,
    },
  });
}
