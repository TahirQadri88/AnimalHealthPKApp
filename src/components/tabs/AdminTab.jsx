import { useContext } from 'react';
import { BarChart3, Wallet, Archive, Upload, Globe, Users, Settings, Truck, Activity, Lock } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { AdminRail, AdminSwitcher } from '../admin/AdminNav';
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
if(!isAdmin) return <div className="p-10 text-center font-medium text-kt-muted flex flex-col items-center mt-20"><Lock className="mb-4 text-kt-muted" size={48}/> <p className="text-sm">Admin Access Required</p></div>;
return (
<div className="h-full flex flex-col">
<div className="font-ui px-4 pt-4 pb-2">
<h2 className="font-display text-3xl text-kt-ink mb-3 lg:mb-1">Admin</h2>
<AdminSwitcher adminView={adminView} setAdminView={setAdminView} />
</div>
<div className="flex-1 min-h-0 flex">
<AdminRail adminView={adminView} setAdminView={setAdminView} />
<div className="flex-1 min-w-0 overflow-hidden">
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
</div>
)
};
