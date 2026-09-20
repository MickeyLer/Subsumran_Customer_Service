import { Outlet, Navigate } from 'react-router-dom'
import React ,{useContext} from 'react'
//import { useAuth } from './Auth'
import {AuthContext} from './linelogin';

const PrivateRoutes = () => {

    const {userId} = useContext(AuthContext);
    //console.log(userId);
    return(
             userId !== ''
            ? 
            <Outlet />
            : 
            <Navigate to="/" /> 
    )
}

export default PrivateRoutes