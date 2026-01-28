import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { TextProvider } from "@/lib/text";
import { Toaster } from "@/components/ui/toast";
import { App } from "@/app";
import "@/styles.css";
import { registerSW } from "virtual:pwa-register";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TextProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </TextProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
