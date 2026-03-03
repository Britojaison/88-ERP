import React, { createContext, useState, useMemo, useContext, useEffect } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import baseTheme from './theme'

type ThemeMode = 'light' | 'dark'

interface ThemeContextType {
    mode: ThemeMode
    toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType>({
    mode: 'light',
    toggleMode: () => { },
})

export const useThemeContext = () => useContext(ThemeContext)

export const ThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem('erp_theme_mode')
        return (saved === 'dark' ? 'dark' : 'light') as ThemeMode
    })

    useEffect(() => {
        localStorage.setItem('erp_theme_mode', mode)
    }, [mode])

    const toggleMode = () => {
        setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
    }

    const theme = useMemo(() => {
        return createTheme({
            ...baseTheme,
            palette: {
                ...baseTheme.palette,
                mode,
                ...(mode === 'dark' && {
                    background: {
                        default: '#0f172a',
                        paper: '#1e293b',
                    },
                    text: {
                        primary: '#f8fafc',
                        secondary: '#cbd5e1',
                    },
                    primary: {
                        main: '#2dd4bf',
                        light: '#5eead4',
                        dark: '#0f766e',
                    },
                }),
            },
            components: {
                ...baseTheme.components,
                MuiCssBaseline: {
                    styleOverrides: {
                        body: {
                            backgroundImage: mode === 'light'
                                ? 'radial-gradient(circle at 0% 0%, rgba(37,99,235,0.08), transparent 30%), radial-gradient(circle at 100% 0%, rgba(15,109,106,0.08), transparent 24%)'
                                : 'radial-gradient(circle at 0% 0%, rgba(37,99,235,0.08), transparent 30%), radial-gradient(circle at 100% 0%, rgba(45,212,191,0.08), transparent 24%)',
                        },
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        root: {
                            border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)'
                        }
                    }
                },
                MuiCard: {
                    styleOverrides: {
                        root: {
                            border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(15, 23, 42, 0.08)'
                        }
                    }
                },
                MuiTableHead: {
                    styleOverrides: {
                        root: {
                            backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(15, 23, 42, 0.03)',
                        }
                    }
                }
            },
        })
    }, [mode])

    return (
        <ThemeContext.Provider value={{ mode, toggleMode }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    )
}
