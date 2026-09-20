import './App.css';
import React, { useState ,useRef } from 'react';
import {Modal,Form,Button} from 'react-bootstrap';

import ModalPay from './Modal';
import Pay from './payment';
import Pic from './savepic';
import Line from './linelogin';
import DataProvider from './DataContext';
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Routes
} from "react-router-dom";
import { Invoice } from './invoice';
import SelectIDcontact from './SelectID';
import Home from './Home';
import LoanDetails from './LoanDetails';
import PrivateRoutes from "./private";
import AuthProvider from './linelogin';

function App() {

  return (
    <div className="App">
      <AuthProvider>
      <DataProvider>
        <Router>
          <Routes>  
          <Route element={<PrivateRoutes />}>
            <Route path="/" element={<Home />} />
            <Route path="/SelectContract" element={<SelectIDcontact />} />
            <Route path="/Pay" element={<Pay />} />
            <Route path="/Invoice" element={<Invoice />} />
            <Route path="/VerifyPayment" element={<ModalPay />} />
            <Route path="/SavePic" element={<Pic />} />
            <Route path="/LoanDetails" element={<LoanDetails />} />
          </Route>
          </Routes>
        </Router>
      </DataProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
