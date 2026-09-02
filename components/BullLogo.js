import React from "react";

export default function BullLogo({ size = 48, className = "" }) {
  return (
    <img
      src="/logo.png"
      alt="Logo Toro"
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", objectFit: "contain" }}
    />
  );
}
