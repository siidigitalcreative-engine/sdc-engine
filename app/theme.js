"use client";
import { createContext, useContext } from "react";
export const ThemeCtx = createContext({ dark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);
