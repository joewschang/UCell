import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';

export type UiThemePreference='SYSTEM'|'LIGHT'|'DARK';
export type ResolvedUiTheme='light'|'dark';
export const UI_THEME_STORAGE_KEY='ucell.ui-theme-preference.v1';

function safeStoredPreference():UiThemePreference{
  if(typeof window==='undefined')return 'SYSTEM';
  try{const value=window.localStorage.getItem(UI_THEME_STORAGE_KEY);return value==='LIGHT'||value==='DARK'||value==='SYSTEM'?value:'SYSTEM'}catch{return 'SYSTEM'}
}
export function resolveUiTheme(preference:UiThemePreference,systemDark:boolean):ResolvedUiTheme{return preference==='DARK'||preference==='SYSTEM'&&systemDark?'dark':'light'}
export function applyUiTheme(theme:ResolvedUiTheme){if(typeof document==='undefined')return;document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}
/** Call before React mounts to prevent a saved dark preference flashing light. */
export function initializeUiTheme(){const preference=safeStoredPreference();const systemDark=typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches===true;applyUiTheme(resolveUiTheme(preference,systemDark))}

type ThemeContextValue={preference:UiThemePreference;resolved:ResolvedUiTheme;setPreference:(preference:UiThemePreference)=>void};
const ThemeContext=createContext<ThemeContextValue|null>(null);
export function ThemeProvider({children}:{children:ReactNode}){
  const [preference,setPreferenceState]=useState<UiThemePreference>(safeStoredPreference);
  const [systemDark,setSystemDark]=useState(()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)').matches===true);
  const resolved=resolveUiTheme(preference,systemDark);
  useEffect(()=>{applyUiTheme(resolved)},[resolved]);
  useEffect(()=>{if(typeof window==='undefined'||!window.matchMedia)return;const media=window.matchMedia('(prefers-color-scheme: dark)');const onChange=(event:MediaQueryListEvent)=>setSystemDark(event.matches);media.addEventListener?.('change',onChange);return()=>media.removeEventListener?.('change',onChange)},[]);
  const setPreference=(next:UiThemePreference)=>{setPreferenceState(next);try{window.localStorage.setItem(UI_THEME_STORAGE_KEY,next)}catch{/* Presentation preference remains optional. */}};
  const value=useMemo(()=>({preference,resolved,setPreference}),[preference,resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme(){const context=useContext(ThemeContext);if(!context)throw new Error('useTheme must be used inside ThemeProvider');return context}
export function ThemePreferenceControl({className}:{className?:string}){const {preference,setPreference}=useTheme();return <label className={`uc-theme-control ${className??''}`.trim()}><span>顯示模式</span><select aria-label="顯示模式" value={preference} onChange={event=>setPreference(event.target.value as UiThemePreference)}><option value="SYSTEM">跟隨系統</option><option value="LIGHT">淺色模式</option><option value="DARK">深色模式</option></select></label>}
