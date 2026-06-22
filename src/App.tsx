import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import RootLayout, { OpenDocsProvider } from '@/layouts/RootLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Upload from '@/pages/Upload';
import DocumentsList from '@/pages/DocumentsList';
import DocumentDetail from '@/pages/DocumentDetail';
import Tags from '@/pages/Tags';
import Correspondents from '@/pages/Correspondents';
import DocumentTypes from '@/pages/DocumentTypes';
import StoragePaths from '@/pages/StoragePaths';
import CustomFields from '@/pages/CustomFields';
import SavedViews from '@/pages/SavedViews';
import Trash from '@/pages/Trash';
import Settings from '@/pages/Settings';
import Configuration from '@/pages/Configuration';
import MailSettings from '@/pages/Mail';
import { Toaster } from '@/components/ui/sonner';
import ProfileSetupModal from '@/components/ProfileSetupModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
          <span className="text-primary font-bold text-sm">DG</span>
        </div>
        <p className="text-sm text-muted-foreground">Loading DG Repo...</p>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <>
      <ProfileSetupModal />
      {children}
    </>
  );
}

// Stub pages for nav items not yet built
function StubPage({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        {description || 'This section is coming soon. Check back later!'}
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <OpenDocsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RootLayout />
                </ProtectedRoute>
              }
            >
              {/* ── Main ── */}
              <Route index element={<Dashboard />} />
              <Route path="documents" element={<DocumentsList />} />
              <Route path="documents/:id" element={<DocumentDetail />} />
              <Route path="upload" element={<Upload />} />

              {/* ── Manage ── */}
              <Route path="correspondents" element={<Correspondents />} />
              <Route path="tags" element={<Tags />} />
              <Route path="document-types" element={<DocumentTypes />} />
              <Route path="storage-paths" element={<StoragePaths />} />
              <Route path="custom-fields" element={<CustomFields />} />
              <Route path="saved-views" element={<SavedViews />} />
              <Route path="workflows" element={<StubPage title="Workflows" description="Rule-based automation for auto-tagging, routing, and processing documents is coming soon." />} />
              <Route path="mail" element={<MailSettings />} />
              <Route path="trash" element={<Trash />} />

              {/* ── Administration ── */}
              <Route path="settings" element={<Settings />} />
              <Route path="configuration" element={<Configuration />} />
              <Route path="users-groups" element={<StubPage title="Users & Groups" description="User management, group permissions, and role-based access control is coming soon." />} />
              <Route path="file-tasks" element={<StubPage title="File Tasks" description="Monitor background document processing tasks and queue status." />} />
              <Route path="logs" element={<StubPage title="Logs" description="System activity logs and audit trail is coming soon." />} />

              {/* ── Legacy redirects ── */}
              <Route path="categories" element={<Navigate to="/document-types" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors />
      </OpenDocsProvider>
    </AuthProvider>
  );
}
