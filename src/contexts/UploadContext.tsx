import React, { createContext, useContext, useState, useCallback } from "react";

interface UploadedFile {
  id: string;
  name: string;
  type: "pdf" | "text";
  uploadedAt: Date;
}

interface UploadContextType {
  uploads: UploadedFile[];
  addUpload: (name: string, type: "pdf" | "text") => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadedFile[]>([]);

  const addUpload = useCallback((name: string, type: "pdf" | "text") => {
    const newUpload: UploadedFile = {
      id: Date.now().toString(),
      name,
      type,
      uploadedAt: new Date(),
    };
    setUploads((prev) => [newUpload, ...prev]);
  }, []);

  return (
    <UploadContext.Provider value={{ uploads, addUpload }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
