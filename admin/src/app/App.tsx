import {ReservoirCenterPage} from '../features/reservoir/ReservoirCenterPage';
import {BinaryTreesPage} from '../features/organization/BinaryTreesPage';
import {Link,Navigate,Route,Routes} from 'react-router-dom';
import {useAuth} from '../features/auth/auth';
import {LoginPage} from '../features/auth/LoginPage';
import {AppShell} from './AppShell';
import {DashboardPage} from '../features/dashboard/DashboardPage';
import {PeoplePage} from '../features/people/PeoplePage';
import {ApplicationsPage} from '../features/applications/ApplicationsPage';
import {NewApplicationWizard} from '../features/applications/NewApplicationWizard';
import {QualificationsPage} from '../features/qualifications/QualificationsPage';
import {ProductsPage} from '../features/products/ProductsPage';
import {PackagesPage} from '../features/packages/PackagesPage';
import {OrdersPage} from '../features/orders/OrdersPage';
import {OrganizationPage} from '../features/organization/OrganizationPage';
import {SubscriptionsPage} from '../features/subscriptions/SubscriptionsPage';
import {BonusesPage} from '../features/bonuses/BonusesPage';
import {ReturnsPage} from '../features/returns/ReturnsPage';
import {WorkflowsPage} from '../features/workflows/WorkflowsPage';
import {PayoutsPage} from '../features/payouts/PayoutsPage';
import {DocumentsPage} from '../features/documents/DocumentsPage';
import {ContentPage} from '../features/content/ContentPage';
import {AuditPage} from '../features/audit/AuditPage';
import {ReportsPage} from '../features/reports/ReportsPage';
import {AnalyticsPage} from '../features/analytics/AnalyticsPage';
import {UatPage} from '../features/uat/UatPage';
import {SystemPage} from '../features/system/SystemPage';
import {ProviderOperationsPage} from '../features/provider-operations/ProviderOperationsPage';
import {RequirePageRole} from '../features/auth/RequirePageRole';

function Protected(){const {user,ready}=useAuth();if(!ready)return <div className="app-loading">驗證管理員Session…</div>;return user?<AppShell/>:<Navigate to="/login" replace/>}
export function App(){return <Routes>
 <Route path="/login" element={<LoginPage/>}/>
 <Route element={<Protected/>}>
  <Route path="/" element={<DashboardPage/>}/>
  <Route path="/people" element={<RequirePageRole><PeoplePage/></RequirePageRole>}/>
  <Route path="/applications" element={<RequirePageRole><ApplicationsPage/></RequirePageRole>}/>
  <Route path="/applications/new" element={<RequirePageRole><NewApplicationWizard/></RequirePageRole>}/>
  <Route path="/qualifications" element={<RequirePageRole><QualificationsPage/></RequirePageRole>}/>
  <Route path="/products" element={<RequirePageRole><ProductsPage/></RequirePageRole>}/>
  <Route path="/packages" element={<RequirePageRole><PackagesPage/></RequirePageRole>}/>
  <Route path="/orders" element={<RequirePageRole><OrdersPage/></RequirePageRole>}/>
  <Route path="/admin/organization/trees/:id?" element={<RequirePageRole><BinaryTreesPage/></RequirePageRole>}/>
  <Route path="/organization" element={<RequirePageRole><OrganizationPage/></RequirePageRole>}/>
  <Route path="/subscriptions" element={<RequirePageRole><SubscriptionsPage/></RequirePageRole>}/>
  <Route path="/admin/finance/reservoirs" element={<RequirePageRole><ReservoirCenterPage/></RequirePageRole>}/>
  <Route path="/bonuses" element={<RequirePageRole><BonusesPage/></RequirePageRole>}/>
  <Route path="/returns" element={<RequirePageRole><ReturnsPage/></RequirePageRole>}/>
  <Route path="/workflows" element={<RequirePageRole><WorkflowsPage/></RequirePageRole>}/>
  <Route path="/payouts" element={<RequirePageRole><PayoutsPage/></RequirePageRole>}/>
  <Route path="/content" element={<RequirePageRole><ContentPage/></RequirePageRole>}/>
  <Route path="/documents" element={<RequirePageRole><DocumentsPage/></RequirePageRole>}/>
  <Route path="/audit" element={<RequirePageRole><AuditPage/></RequirePageRole>}/>
  <Route path="/reports" element={<RequirePageRole><ReportsPage/></RequirePageRole>}/>
  <Route path="/analytics" element={<RequirePageRole><AnalyticsPage/></RequirePageRole>}/>
  <Route path="/uat" element={<RequirePageRole><UatPage/></RequirePageRole>}/>
  <Route path="/system" element={<RequirePageRole><SystemPage/></RequirePageRole>}/>
  <Route path="/provider-operations" element={<RequirePageRole><ProviderOperationsPage/></RequirePageRole>}/>
  <Route path="*" element={<section className="card"><h1>找不到後台頁面</h1><Link to="/">返回營運總覽</Link></section>}/>
 </Route>
</Routes>}
