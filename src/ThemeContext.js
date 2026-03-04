import { createContext, useContext } from 'react';

export const ThemeContext = createContext({ isV2: false });

export const useTheme = () => useContext(ThemeContext);
