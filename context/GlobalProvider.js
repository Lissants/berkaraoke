import { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser, account, databases } from '../lib/appwrite';
import { config } from '../lib/appwrite';

const GlobalContext = createContext();
export const useGlobalContext = () => useContext(GlobalContext);

const GlobalProvider = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = async () => {
    try {
      await account.deleteSessions();
      setIsLoggedIn(false);
      setUser(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const checkUser = async () => {
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    } catch (error) {
      console.error('CheckUser error:', error);
      setIsLoggedIn(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        isLoggedIn,
        setIsLoggedIn,
        user,
        setUser,
        isLoading,
        logout,
        checkUser, // Add this to allow manual refresh of user state
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export default GlobalProvider;