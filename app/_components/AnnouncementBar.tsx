"use client";

import { useEffect, useState } from "react";

export default function AnnouncementBar() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcement")
      .then((r) => r.json())
      .then((d) => {
        const msg = typeof d.message === "string" ? d.message.trim() : "";
        setMessage(msg || null);
      })
      .catch(() => setMessage(null));
  }, []);

  if (!message) return null;

  return (
    <div className="w-full bg-[#0B1220] text-white text-sm font-medium text-center px-4 py-2.5 leading-snug">
      {message}
    </div>
  );
}
