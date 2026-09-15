import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/Shell';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Inventory from './pages/Inventory';
import CartDetail from './pages/CartDetail';
import Templates from './pages/Templates';

function getToken() {
  return localStorage.getItem('cartguard_token');
}

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [storeName] = useState('Wayfare Goods Co.');

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Shell storeName={storeName} />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="carts/:id" element={<CartDetail />} />
          <Route path="templates" element={<Templates />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
