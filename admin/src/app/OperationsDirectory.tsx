import {useState, useEffect, useRef, type KeyboardEvent, type MouseEvent} from 'react';
import {Link} from 'react-router-dom';
import {UCellIcon, type UCellIconName} from '@ucell/design-system';
import {uiValue} from '../../../shared/design-system/i18n';
import {nav, navGroups} from './nav';
import {canOpen, type AdminRole} from '../features/auth/permissions';

type Destination = {title:string; path:string; icon:UCellIconName};
type Props = {role?:AdminRole; current?:string; pathname:string};

const ucOpsNavTerms:Record<string,string> = {
  "/": "首頁 儀表板 KPI",
  "/daily-operations": "今日待辦 待處理 任務 工作清單",
  "/notification-hub": "跟進 回訪 提醒 成長",
  "/people": "會員360 法人 公司球 身分維護 身份維護 客戶資料",
  "/applications": "入會 正式會員 補件 申請 核准 身分證 地址",
  "/orders": "收款 匯款 核帳 付款審核",
  "/admin/organization/trees": "安置 左右線 放球",
  "/qualifications": "球號 資格 生效",
  "/workflows": "退會 轉讓 升級",
  "/paper-intake": "紙本訂單 紙本建立訂單 建單 開單 人工建檔",
  "/document-intake": "文件收件夾 文件收件箱 OCR 身分證 上傳",
  "/line-links": "LINE OA 綁定 補綁",
  "/organization": "推薦人 推薦組織 上下線",
  "/organization/binary": "二元樹 雙軌 組織樹 左右線",
  "/organization/geo": "地圖 區域 分布 分佈",
  "/learning": "課程 教材 培訓",
  "/events": "報名 活動名單",
  "/order-tracking": "查單 訂單查詢 物流",
  "/fulfillment": "寄送 配送 出貨",
  "/subscriptions": "重銷 重購 續訂",
  "/packages": "入會套組 重銷 組合",
  "/products": "產品 商品目錄 SKU",
  "/product-content": "商品介紹 產品說明",
  "/coupons": "折扣碼 折價券",
  "/product-reviews": "商品評論",
  "/returns": "退款 退貨 重算",
  "/compensation-period-control": "獎金週期 關帳 期別",
  "/settlement-jobs": "跑批 獎金試算 結算",
  "/bonuses": "主動稽核 獎金驗算 驗證 分紅 歸戶",
  "/economic-lineage": "金流追蹤 回溯 交易影響",
  "/erp-reconciliation": "ERP 對帳 差異",
  "/admin/finance/reservoirs": "獎金池 水庫",
  "/payouts": "撥款 獎金發放 匯款",
  "/marketing": "分享 轉換 轉換率",
  "/analytics": "PNASL NASL 十二代 雷達 潛客轉正",
  "/operations-control": "指標 異常 管控",
  "/reports": "報表 資料完整性",
  "/ai-assistant": "AI 智慧秘書",
  "/content": "影片 素材 連結",
  "/content/greetings": "早安圖 長輩圖 問候圖",
  "/health/journey/": "健康遊戲 健康任務 小遊戲",
  "/topics/": "AI Tag 標籤 hashtag 分類",
  "/faq": "客服 FAQ 常見問題",
  "/documents": "附件 文件庫",
  "/ai-knowledge": "AI 客服 知識",
  "/provider-operations": "Webhook 串接 回呼",
  "/audit": "操作紀錄 稽核軌跡",
  "/ai-governance": "AI 審計 稽核",
  "/system": "系統狀態 就緒",
  "/uat": "驗收 UAT"
};

function ucOpsNavNormalize(value:string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function ucOpsNavGroups(role:AdminRole|undefined, tokens:string[]) {
  return navGroups.map(group => {
    const links = group.paths.flatMap((path):Destination[] => {
      const item = nav.find(([, url]) => url === path);
      if (!item || !canOpen(role, path)) return [];
      const title = uiValue(item[0]);
      const searchable = [uiValue(group.label), title, ucOpsNavTerms[path] || ''].map(ucOpsNavNormalize);
      return tokens.every(token => searchable.some(field => field.includes(token)))
        ? [{title, path, icon:item[2]}] : [];
    });
    return {label:uiValue(group.label), links};
  }).filter(group => group.links.length);
}

export function OperationsDirectory({role, current, pathname}:Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const term = query.trim();
  const tokens = term.split(/\s+/u).map(ucOpsNavNormalize).filter(Boolean);
  const groups = ucOpsNavGroups(role, tokens);
  const count = groups.reduce((sum, group) => sum + group.links.length, 0);
  const mobile = () => window.matchMedia('(max-width:1023px)').matches;

  useEffect(() => {
    setQuery('');
    setOpen(false);
  }, [pathname, role]);

  function keyDown(event:KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      if (query) {
        event.preventDefault();
        setQuery('');
        input.current?.focus();
      } else if (mobile()) {
        event.preventDefault();
        setOpen(false);
        toggle.current?.focus();
      }
      return;
    }
    const target = event.target;
    if (!term || !(target instanceof Element) || (target !== input.current && !target.closest('a.uc-nav-link'))) return;
    const links = Array.from(panel.current?.querySelectorAll<HTMLAnchorElement>('details[open] a.uc-nav-link') ?? []);
    if (!links.length) return;
    if (event.key === 'Enter' && target === input.current && links.length === 1) {
      event.preventDefault();
      links[0].click();
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const index = links.findIndex(link => link === document.activeElement);
      if (event.key === 'ArrowUp' && index === 0) {
        input.current?.focus();
      } else if (index < 0) {
        links[event.key === 'ArrowUp' ? links.length - 1 : 0].focus();
      } else {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        links[(index + step + links.length) % links.length].focus();
      }
    }
  }

  function visit(event:MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    setQuery('');
    setOpen(false);
    if (mobile()) requestAnimationFrame(() => document.getElementById('admin-main')?.focus());
  }

  return <>
    <button type="button" ref={toggle} className="uc-ops-menu-toggle"
      aria-controls="uc-ops-directory" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? '收合功能選單' : '功能選單'}
    </button>
    <div id="uc-ops-directory" className="uc-ops-directory" ref={panel} data-open={open} onKeyDown={keyDown}>
      <input type="search" ref={input} className="ux-nav-search" aria-label="搜尋後台功能"
        aria-controls="uc-ops-primary-links" placeholder="搜尋功能，如付款、PNASL"
        value={query} onChange={event => setQuery(event.target.value)}/>
      <p role="status" className="uc-ops-nav-status">
        {term && (count ? `找到 ${count} 個功能` : '沒有符合的功能，請更換關鍵字。')}
      </p>
      <nav id="uc-ops-primary-links" aria-label="後台主要功能">
        {groups.map(group => <details className="uc-nav-group" key={group.label}
          open={!!term || group.links.some(link => link.path === current)}>
          <summary>{group.label}</summary>
          {group.links.map(({title,path,icon}) => <Link to={path} key={path} onClick={visit}
            reloadDocument={path === '/topics/'} className={current === path ? 'uc-nav-link active' : 'uc-nav-link'}
            aria-current={current === path ? 'page' : undefined}>
            <UCellIcon name={icon} className="uc-nav-icon"/><span>{title}</span>
          </Link>)}
        </details>)}
      </nav>
    </div>
  </>;
}
