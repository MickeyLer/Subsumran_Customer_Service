"use client";

import React, { useEffect ,useState} from "react";
import Box from '@mui/material/Box';
import { useContext } from 'react';
//import {AuthContext} from '../login/Auth';
import { DataContext} from './DataContext';
import './style.css';
import { useRouter } from 'next/navigation';
import Spinner from 'react-bootstrap/Spinner';
import {AuthContext} from './linelogin';
import { Alert } from "react-bootstrap";

function SelectIDcontact() {
    
    const {userId} = useContext(AuthContext);
    const [currentUserId,setCurrentuser] = useState(userId);
    //const [currentUserId,setCurrentuser] = useState('U2cd360ba05fa93c6907ca768afb9a458');
    //const [currentUserId,setCurrentuser] = useState('U120264c5ef686a8313675996cbbf3793');
    
    const {dataContact,setDataContact} = useContext(DataContext);
    const [idcontact , setIDcontact] = useState(null);

    const router = useRouter();
    
    //console.log(userId);
    
    useEffect(()=>{
        if (dataContact !== null){  
            const IDContactTable = dataContact.filter(row=>row.userID === currentUserId).filter(row=>row.total_treerest > 0);
            setIDcontact(IDContactTable); 
        }
    },[dataContact]);
 
    useEffect(()=>{
        if (idcontact !== null){
            if (Object.keys(idcontact).length === 1) {
                let idc = idcontact.map(val=>val.ID_contact)[0];
                router.push(`/Pay?IDcontact=${encodeURIComponent(idc)}&autoPay=true`);
            } 
        }
    },[idcontact]);    
 
return (
    <div className="bg-surface min-h-screen pt-12 px-gutter font-sans flex flex-col items-center">
      <div className="w-full max-w-[600px] flex flex-col items-center">
        {idcontact === null ? (
          <div className="flex justify-center items-center py-20">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">กำลังโหลด...</span>
            </Spinner>
          </div>
        ) : Object.keys(idcontact).length === 0 ? (
          <div className="w-full bg-error-container text-on-error-container border border-error-container p-md rounded-lg text-center font-bold">
            กรุณาสมัครรับแจ้งเตือนทางไลน์ และติดต่อเจ้าหน้าที่ เพื่อทำรายการต่อไป
          </div>
        ) : (
          <div className="w-full text-center py-md flex flex-col gap-md max-w-[400px]">
            <h3 className="text-headline-md font-bold text-primary mb-sm leading-snug">กรุณาเลือกสัญญา</h3>
            <div className="flex flex-col gap-sm">
              {idcontact.map((val, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(`/Pay?IDcontact=${encodeURIComponent(val.ID_contact)}&autoPay=true`)}
                  className="w-full bg-secondary-fixed text-primary hover:bg-secondary-container hover:text-on-secondary-container active:scale-98 text-body-lg font-bold py-md px-lg rounded-lg shadow-sm border border-outline-variant/30 flex items-center justify-between transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
                  aria-label={`ชำระเงินสัญญาเลขที่ ${val.ID_contact}`}
                >
                  <span className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                    สัญญาเลขที่ {val.ID_contact}
                  </span>
                  <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward_ios</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

}

export default SelectIDcontact;