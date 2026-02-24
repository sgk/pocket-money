import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import { startOfflineOperationsSync } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { TextProvider } from "@/lib/text";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/toast";
import { App } from "@/app";
import "@/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}
startOfflineOperationsSync();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TextProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
            <Toaster position="top-right" richColors />
          </TextProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
