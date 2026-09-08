import AdminDashboard
  from '../components/admin/AdminDashboard';

import {
  AdminStoreProvider,
} from '../components/admin/AdminStore';


export default function AdminPage() {

  return (

    <AdminStoreProvider>

      <AdminDashboard />

    </AdminStoreProvider>

  );

}