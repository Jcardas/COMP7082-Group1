import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  isLoading,
  children,
}) => {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center text-xs">
        Loading session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
