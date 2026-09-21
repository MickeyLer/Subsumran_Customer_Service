"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    fetchContacts, 
    fetchAllInterest, 
    fetchAllTransactions, 
    fetchCustomers,
    fetchContactsByUser,
    fetchCustomerByUserId,
    fetchInterestByContacts,
    fetchContactById,
    fetchInterestByContact
} from './services/api';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

/**
 * Customer Data Module & Provider
 * 
 * Deep module encapsulating customer data state, background refresh, and domain queries.
 * Supports targeted customer-scoped loading and on-demand full database fetching for admins.
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
    const [isAdminDataLoaded, setIsAdminDataLoaded] = useState(false);

    const isAdminLoadingRef = useRef(false);

    /**
     * Targeted fetch for a specific user's contracts & installments.
     * Reduces initial payload size by ~99% for regular customer LIFF sessions.
     */
    const refreshUserData = useCallback(async (targetUserId) => {
        if (!targetUserId) return;
        setIsLoading(true);
        try {
            const [userContacts, userCustomer] = await Promise.all([
                fetchContactsByUser(targetUserId),
                fetchCustomerByUserId(targetUserId),
            ]);

            const contractIds = (userContacts || []).map(c => c.ID_contact).filter(Boolean);
            const userInterests = contractIds.length > 0 
                ? await fetchInterestByContacts(contractIds)
                : [];

            setDataContact((prev) => {
                if (!prev) return userContacts;
                // Merge without duplicates
                const prevIds = new Set(prev.map(c => c.ID_contact));
                const newItems = userContacts.filter(c => !prevIds.has(c.ID_contact));
                return [...prev, ...newItems];
            });

            setDataCustomer((prev) => {
                if (!prev) return userCustomer ? [userCustomer] : [];
                if (!userCustomer) return prev;
                const exists = prev.some(c => c.ID === userCustomer.ID || c.userID === userCustomer.userID);
                return exists ? prev : [...prev, userCustomer];
            });

            setInterestData((prev) => {
                if (!prev) return userInterests;
                const prevKeys = new Set(prev.map(i => `${i.Id_contact}_${i.number_pay}`));
                const newItems = userInterests.filter(i => !prevKeys.has(`${i.Id_contact}_${i.number_pay}`));
                return [...prev, ...newItems];
            });
        } catch (error) {
            console.error("Error loading targeted customer data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Load full database datasets on-demand when requested by an Admin.
     */
    const ensureAdminDataLoaded = useCallback(async () => {
        if (isAdminDataLoaded || isAdminLoadingRef.current) return;
        isAdminLoadingRef.current = true;
        try {
            console.log("Admin Data Loading: Fetching complete database tables...");
            const [contacts, customers, interests] = await Promise.all([
                fetchContacts(),
                fetchCustomers(),
                fetchAllInterest(),
            ]);
            setDataContact(contacts);
            setDataCustomer(customers);
            setInterestData(interests);
            setIsAdminDataLoaded(true);
        } catch (error) {
            console.error("Error loading full admin datasets:", error);
        } finally {
            isAdminLoadingRef.current = false;
        }
    }, [isAdminDataLoaded]);

    /**
     * Targeted fetch for a single contract + installments (e.g. direct link access).
     */
    const loadContractData = useCallback(async (contractId) => {
        if (!contractId) return;
        try {
            const [contact, interests] = await Promise.all([
                fetchContactById(contractId),
                fetchInterestByContact(contractId),
            ]);

            if (contact) {
                setDataContact((prev) => {
                    if (!prev) return [contact];
                    const exists = prev.some(c => c.ID_contact === contact.ID_contact);
                    return exists ? prev : [...prev, contact];
                });
            }

            if (interests && interests.length > 0) {
                setInterestData((prev) => {
                    if (!prev) return interests;
                    const prevKeys = new Set(prev.map(i => `${i.Id_contact}_${i.number_pay}`));
                    const newItems = interests.filter(i => !prevKeys.has(`${i.Id_contact}_${i.number_pay}`));
                    return [...prev, ...newItems];
                });
            }
        } catch (error) {
            console.error(`Error loading targeted contract ${contractId}:`, error);
        }
    }, []);

    /**
     * Fallback full refresh (for backward compatibility)
     */
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
            setIsAdminDataLoaded(true);
        } catch (error) {
            console.error("Error loading customer data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial load: Default user ID (or can be triggered per user)
    useEffect(() => {
        const defaultUserId = "U2cd360ba05fa93c6907ca768afb9a458";
        refreshUserData(defaultUserId);
    }, [refreshUserData]);

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
        isAdminDataLoaded,
        refreshUserData,
        refreshAllData,
        ensureAdminDataLoaded,
        loadContractData,
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