"use client";

import { useEffect } from "react";
import { useWalletStore } from "../lib/store";
import { Card } from "./ui/card";
import { BatchTrigger } from "./BatchTrigger";
import { useAdminControls } from "../hooks/useAdminControls";

export function AdminTab() {
  const { address, isConnected } = useWalletStore();
  const adminControls = useAdminControls();

  const { isOwner, owner, startPolling, stopPolling } = adminControls;

  // Start polling when component mounts and user is owner
  useEffect(() => {
    if (isOwner) {
      startPolling();
      return () => stopPolling();
    }
  }, [isOwner, startPolling, stopPolling]);

  // Show connection prompt if not connected
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>
          <p className="text-gray-600 mb-4">Please connect your wallet to access admin functions.</p>
        </Card>
      </div>
    );
  }

  // Show admin panel for contract owner
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-600">Manual batch processing and system administration</p>
        <div className="mt-2 text-sm text-green-600 font-medium">✓ Verified Contract Owner</div>
      </div>

      <BatchTrigger adminControls={adminControls} />
    </div>
  );
}
