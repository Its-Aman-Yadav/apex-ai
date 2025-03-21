import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper = ({ children }: AuthWrapperProps) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthenticated(true);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Verifying authentication...</div>;
  }

  return authenticated ? <>{children}</> : null;
};

export default AuthWrapper;