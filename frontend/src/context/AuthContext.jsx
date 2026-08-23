import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, loginUser as apiLogin, registerUser as apiRegister, logoutUser as apiLogout } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await getCurrentUser();
      if (res && res.data && res.data.user) {
        setUser(res.data.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (data) => {
    try {
      const res = await apiLogin(data);
      if (res && res.data && res.data.user) {
        setUser(res.data.user);
        setIsAuthenticated(true);
        return res;
      }
      throw new Error("Invalid response");
    } catch (error) {
      throw error;
    }
  };

  const register = async (data) => {
    try {
      const res = await apiRegister(data);
      // Wait, let's just log them in if registration returned 201 with user
      if (res && res.data && res.data.user) {
        // Technically, registration endpoint might not log them in on the server, 
        // we'd need to call login. But if our auth_bp logs them in (or if we prefer), 
        // let's do a login call just in case, or just return success and let the component handle it.
        return res;
      }
      throw new Error("Invalid response");
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error(error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
