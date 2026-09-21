"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { fetchContacts, fetchAllInterest, fetchAllTransactions, fetchCustomers } from './services/api';
import Swal from 'sweetalert2';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * Customer Data Module & Provider
 * 
 * Deep module encapsulating customer data state, background refresh, and domain queries.
 */
export const DataContext = React.createContext(null);

export const DataProvider = ({ children }) => {
    const [dataContact, setDataContact] = useState(null);
    const [dataCustomer, setDataCustomer] = useState(null);
    const [dataInterest, setInterestData] = useState(null);
    const [dataTransaction, setTransactionData] = useState(null);
    const [modalShown, toggleModal] = useState(false);
    const [modalShown2, toggleModal2] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const refreshAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [contacts, customers, interests, transactions] = await Promise.all([
                fetchContacts(),
                fetchCustomers(),
                fetchAllInterest(),
                fetchAllTransactions(),
            ]);
            setDataContact(contacts);
            setDataCustomer(customers);
            setInterestData(interests);
            setTransactionData(transactions);
        } catch (error) {
            console.error("Error loading customer data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshAllData();
    }, [refreshAllData]);

    // Domain queries
    const getContactsByUserId = useCallback((userId) => {
        if (!dataContact || !userId) return [];
        return dataContact.filter((c) => c.userID === userId);
    }, [dataContact]);

    const getInstallmentsByContractId = useCallback((contractId) => {
        if (!dataInterest || !contractId) return [];
        return dataInterest.filter((inst) => inst.Id_contact === contractId);
    }, [dataInterest]);

    const contextValue = {
        // Raw state (backward compatibility)
        dataContact,
        setDataContact,
        dataCustomer,
        setDataCustomer,
        dataInterest,
        setInterestData,
        dataTransaction,
        setTransactionData,
        modalShown,
        toggleModal,
        modalShown2,
        toggleModal2,

        // Deep Domain Interface Methods
        isLoading,
        refreshAllData,
        getContactsByUserId,
        getInstallmentsByContractId,
    };

    return (
        <DataContext.Provider value={contextValue}>
            {children}
            <ToastContainer />
        </DataContext.Provider>
    );
};

export default DataProvider;