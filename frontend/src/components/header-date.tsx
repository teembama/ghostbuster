"use client";

import { useEffect, useState } from "react";

export function HeaderDate() {
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(
      new Date().toLocaleDateString("en-NG", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    );
  }, []);

  return (
    <span className="text-sm text-gb-muted tabular-nums">{date}</span>
  );
}
