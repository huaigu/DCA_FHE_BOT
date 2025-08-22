'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface WithdrawalStatusBadgeProps {
  type: 'usdc' | 'eth';
  isPending: boolean;
  className?: string;
}

export function WithdrawalStatusBadge({ type, isPending, className = '' }: WithdrawalStatusBadgeProps) {
  if (!isPending) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium ${className}`}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Clock className="w-3 h-3" />
      </motion.div>
      <span>
        {type.toUpperCase()} withdrawal pending...
      </span>
    </motion.div>
  );
}