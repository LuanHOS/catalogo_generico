import React from "react";
import { SecuritySettings } from "./settings/SecuritySettings";
import { GeneralSettings } from "./settings/GeneralSettings";
import { FooterSettings } from "./settings/FooterSettings";
import { ThemeSettings } from "./settings/ThemeSettings";

export function SettingsPanel() {
  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <SecuritySettings />
      <GeneralSettings />
      <FooterSettings />
      <ThemeSettings />
    </div>
  );
}