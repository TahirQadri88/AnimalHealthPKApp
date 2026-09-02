import { useContext } from 'react';
import { BarChart3, Wallet, Archive, Upload, Globe, Users, Settings, Truck, Activity, Lock } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { ScrollableTabBar } from '../ui/ScrollableTabBar';
import { makeArrowNav } from '../../lib/a11y';
import { AnalyticsView } from '../admin/AnalyticsView';
import { ExpensesView } from '../admin/ExpensesView';
import { MastersView } from '../admin/MastersView';
import { BulkOpsView } from '../admin/BulkOpsView';
import { SegmentsAdminView } from '../admin/SegmentsAdminView';
import { UserManagementView } from '../admin/UserManagementView';
import { AppSettingsView } from '../admin/AppSettingsView';
import { RidersAdminView } from '../admin/RidersAdminView';
import { TransportCompaniesManager } from '../admin/TransportCompaniesManager';
import { ReceivablesView } from '../admin/ReceivablesView';
import { AuditView } from '../admin/AuditView';

export const AdminTab = () => {
const { isAdmin, currentUser, companies, products, customers, invoices, expenses, expenseCategories, payments, appUsers, showToast, saveToFirebase, deleteFromFirebase, checkDuplicate, getCompanyName, getCustomerBalance, getCustomerLedger, generateReceiptData, billingView, setBillingView, currentInvoice, setCurrentInvoice, activeTab, setActiveTab, adminView, setAdminView, editingProduct, setEditingProduct, showProductModal, setShowProductModal, editingCustomer, setEditingCustomer, showCustomerModal, setShowCustomerModal, showPaymentModal, setShowPaymentModal, selectedCustomerForPayment, setSelectedCustomerForPayment, showLedgerModal, setShowLedgerModal, selectedLedgerId, setSelectedLedgerId, showExpenseCatModal, setShowExpenseCatModal, showUserModal, setShowUserModal, editingUser, setEditingUser, setPrintConfig, printConfig, showConfirm } = useContext(AppContext);
if(!isAdmin) return <div className="p-10 text-center font-bold text-slate-400 flex flex-col items-center mt-20"><Lock className="mb-4 text-slate-300" size={48}/> <p className="text-sm uppercase tracking-widest">Admin Access Required</p></div>;
return (
<div className="h-full flex flex-col">
<div className="px-4 pt-4 pb-2">
<h2 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-4">Admin Hub</h2>
<div className="bg-slate-200 p-1 rounded-xl">
<ScrollableTabBar bgClass="bg-slate-200">
{[['analytics','bg-white text-indigo-700',<BarChart3 size={14}/>,'Analytics'],['expenses','bg-white text-rose-600',<Wallet size={14}/>,'Expenses'],['masters','bg-white text-teal-600',<Archive size={14}/>,'Masters'],['bulk','bg-white text-emerald-600',<Upload size={14}/>,'Bulk Ops'],['segments','bg-white text-purple-600',<Globe size={14}/>,'Segments'],['users','bg-white text-amber-600',<Users size={14}/>,'Users'],['settings','bg-white text-slate-700',<Settings size={14}/>,'Settings'],['riders','bg-white text-indigo-600',<Truck size={14}/>,'Riders'],['transportCos','bg-white text-amber-700',<Truck size={14}/>,'Transport Cos'],['receivables','bg-white text-rose-600',<Wallet size={14}/>,'Receivables'],['audit','bg-white text-slate-700',<Activity size={14}/>,'Activity']].map(([v,activeClass,icon,label])=>(
  <button key={v} data-admintab={v} tabIndex={adminView===v?0:-1}
    onClick={()=>setAdminView(v)}
    onKeyDown={makeArrowNav(['analytics','expenses','masters','bulk','segments','users','settings','riders','transportCos','receivables','audit'],adminView,setAdminView,'data-admintab')}
    className={`py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap ${adminView===v?activeClass+' shadow-sm':'text-slate-500'}`}>{icon} {label}</button>
))}
</ScrollableTabBar>
</div>
</div>
<div className="flex-1 overflow-hidden">
<div style={{display: adminView === 'analytics' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AnalyticsView /></div>
<div style={{display: adminView === 'expenses' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><ExpensesView /></div>
<div style={{display: adminView === 'masters' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><MastersView /></div>
<div style={{display: adminView === 'bulk' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><BulkOpsView /></div>
<div style={{display: adminView === 'segments' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><SegmentsAdminView /></div>
<div style={{display: adminView === 'users' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><UserManagementView /></div>
<div style={{display: adminView === 'settings' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AppSettingsView /></div>
<div style={{display: adminView === 'riders' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><RidersAdminView /></div>
<div style={{display: adminView === 'transportCos' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><TransportCompaniesManager /></div>
<div style={{display: adminView === 'receivables' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><ReceivablesView /></div>
<div style={{display: adminView === 'audit' ? 'flex' : 'none', flexDirection: 'column', height: '100%'}}><AuditView /></div>
</div>
</div>
)
};
