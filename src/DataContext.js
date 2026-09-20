"use client";

import React, { useState, useEffect ,useContext,useReducer} from 'react';
import { fetchContacts, fetchAllInterest, fetchAllTransactions, fetchCustomers } from './services/api';
import Swal from 'sweetalert2';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export const DataContext = React.createContext(null);

export const DataProvider = ({ children }) => {

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        customClass: {
          container: 'position-absolute'
        },
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
      })

    const [dataContact ,setDataContact] = useState(null);
    const [dataCustomer ,setDataCustomer] = useState(null);
    const [dataInterest ,setInterestData] = useState(null);
    const [dataTransaction ,setTransactionData] = useState(null);
    const [modalShown, toggleModal] = useState(false);
    const [modalShown2, toggleModal2] = useState(false);

    useEffect(()=>{
        const loadData = async () => {
            try {
                // Fetch from Supabase
                const contacts = await fetchContacts();
                setDataContact(contacts);

                const customers = await fetchCustomers();
                setDataCustomer(customers);

                const interests = await fetchAllInterest();
                setInterestData(interests);

                const transactions = await fetchAllTransactions();
                setTransactionData(transactions);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        loadData();
    },[]);


    return (
        <>
        <DataContext.Provider value={{dataContact,setDataContact,
                                        dataCustomer,setDataCustomer,
                                        dataInterest ,setInterestData,
                                        dataTransaction ,setTransactionData,
                                        modalShown, toggleModal,
                                        modalShown2, toggleModal2}}>
            {children}
        </DataContext.Provider>
        <ToastContainer />
        </>
    ) 
   
} 

export default DataProvider;