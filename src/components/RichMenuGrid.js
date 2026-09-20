"use client";

import React from 'react';

/**
 * RichMenuGrid — Replicates the 6-button LINE Rich Menu graphic:
 * 1. ข้อมูลลูกค้า (Customer Info)
 * 2. ค่างวด (Installments)
 * 3. ชำระค่างวด (Pay Installments)
 * 4. ออมทอง (Gold Savings)
 * 5. เลขที่บัญชี (Bank Account)
 * 6. เบอร์โทร (Call / Contact)
 */
export default function RichMenuGrid({ onSelect }) {
  const menuItems = [
    {
      id: 'profile',
      title: 'ข้อมูลลูกค้า',
      ariaLabel: 'ดูข้อมูลลูกค้า',
      svg: (
        <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#8b6f20] fill-none stroke-current stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
          <circle cx="26" cy="26" r="14" />
          <circle cx="26" cy="22" r="5" />
          <path d="M16 34c0-4.5 4.5-7 10-7s10 2.5 10 7" />
          <line x1="36" y1="36" x2="52" y2="52" strokeWidth="4" />
        </svg>
      ),
    },
    {
      id: 'installments',
      title: 'ค่างวด',
      ariaLabel: 'ดูรายการค่างวด',
      svg: (
        <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#8b6f20] fill-none stroke-current stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
          <rect x="10" y="14" width="34" height="34" rx="4" />
          <line x1="10" y1="24" x2="44" y2="24" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="34" y1="8" x2="34" y2="14" />
          <text x="23" y="40" fontSize="14" fontWeight="bold" fill="#8b6f20" stroke="none">$</text>
          {/* Stack of coins */}
          <ellipse cx="48" cy="30" rx="9" ry="3" />
          <ellipse cx="48" cy="36" rx="9" ry="3" />
          <ellipse cx="48" cy="42" rx="9" ry="3" />
          <path d="M39 30v12c0 1.6 4 3 9 3s9-1.4 9-3V30" />
        </svg>
      ),
    },
    {
      id: 'pay',
      title: 'ชำระค่างวด',
      ariaLabel: 'ชำระค่างวด',
      svg: (
        <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#8b6f20] fill-none stroke-current stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
          <rect x="8" y="12" width="28" height="40" rx="4" />
          <rect x="14" y="18" width="16" height="10" rx="2" />
          <circle cx="16" cy="36" r="1.5" fill="#8b6f20" />
          <circle cx="22" cy="36" r="1.5" fill="#8b6f20" />
          <circle cx="28" cy="36" r="1.5" fill="#8b6f20" />
          <circle cx="16" cy="42" r="1.5" fill="#8b6f20" />
          <circle cx="22" cy="42" r="1.5" fill="#8b6f20" />
          <circle cx="28" cy="42" r="1.5" fill="#8b6f20" />
          {/* Card holding hand */}
          <rect x="30" y="24" width="26" height="16" rx="3" />
          <path d="M44 40c0 4 4 8 8 10" />
        </svg>
      ),
    },
    {
      id: 'savings',
      title: 'ออมทอง',
      ariaLabel: 'บริการออมทองคำ',
      svg: (
        <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#8b6f20] fill-none stroke-current stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
          {/* Crown */}
          <path d="M22 14l5 6 5-6 5 6 5-6v8H22z" fill="#8b6f20" fillOpacity="0.15" />
          {/* Gold bars pyramid */}
          <polygon points="12,50 26,50 24,42 14,42" />
          <polygon points="28,50 42,50 40,42 30,42" />
          <polygon points="44,50 58,50 56,42 46,42" />
          <polygon points="20,40 34,40 32,32 22,32" />
          <polygon points="36,40 50,40 48,32 38,32" />
          {/* Sparkles */}
          <path d="M12 30l2-4 2 4-2 4z" fill="#8b6f20" />
          <path d="M52 24l2-4 2 4-2 4z" fill="#8b6f20" />
        </svg>
      ),
    },
    {
      id: 'bank',
      title: 'เลขที่บัญชี',
      ariaLabel: 'เลขที่บัญชีธนาคาร',
      svg: (
        <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#8b6f20] fill-none stroke-current stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
          {/* Bank Building */}
          <polygon points="16,28 32,16 48,28" />
          <line x1="18" y1="28" x2="18" y2="40" />
          <line x1="27" y1="28" x2="27" y2="40" />
          <line x1="37" y1="28" x2="37" y2="40" />
          <line x1="46" y1="28" x2="46" y2="40" />
          <line x1="14" y1="40" x2="50" y2="40" />
          {/* Front Credit card & coin */}
          <rect x="28" y="38" width="28" height="18" rx="3" fill="#ffffff" />
          <line x1="28" y1="44" x2="56" y2="44" />
          <circle cx="48" cy="50" r="3" fill="#8b6f20" />
        </svg>
      ),
    },
    {
      id: 'contact',
      title: 'เบอร์โทร',
      ariaLabel: 'ติดต่อเจ้าหน้าที่',
      svg: (
        <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#8b6f20] fill-none stroke-current stroke-[2.5] stroke-linecap-round stroke-linejoin-round">
          <path d="M16 12h10l4 10-6 4c4 8 10 14 18 18l4-6 10 4v10c0 4-4 8-10 8C26 60 4 38 4 18c0-6 4-6 12-6z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="w-full bg-[#ff5e97] p-md rounded-2xl shadow-xl border-2 border-[#e2c068]/60 relative overflow-hidden">
      {/* Decorative Rose Gold background shimmer */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#d83a78]/30 rounded-full blur-2xl pointer-events-none" />

      {/* 2x3 Grid matching Rich Menu graphic */}
      <div className="grid grid-cols-3 gap-md relative z-10">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="gold-metallic-card rounded-2xl p-sm flex flex-col items-center justify-center gap-xs cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 shadow-md group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d83a78]/50 min-h-[110px]"
            aria-label={item.ariaLabel}
          >
            {/* Icon Container with subtle scale on hover */}
            <div className="group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
              {item.svg}
            </div>

            {/* Title Label */}
            <span className="font-sans font-bold text-label-lg text-[#8b6f20] group-hover:text-[#5e480e] transition-colors leading-tight text-center">
              {item.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
