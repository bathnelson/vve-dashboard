// VvE Dashboard Haarlem — Tailwind-thema
tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        // Microsoft Power Apps color palette
                        'pa-purple': {
                            50: '#f5f3ff',
                            100: '#ede9fe',
                            200: '#ddd6fe',
                            300: '#c4b5fd',
                            400: '#a78bfa',
                            500: '#742774',  // Primary purple
                            600: '#5c1f5c',
                            700: '#4a1a4a',
                            800: '#3d163d',
                            900: '#2d102d',
                        },
                        'pa-blue': {
                            50: '#eff6ff',
                            100: '#dbeafe',
                            200: '#bfdbfe',
                            300: '#93c5fd',
                            400: '#60a5fa',
                            500: '#0078d4',  // Microsoft blue
                            600: '#0066b8',
                            700: '#00549a',
                            800: '#00447c',
                            900: '#003460',
                        },
                        'pa-gray': {
                            50: '#fafafa',
                            100: '#f5f5f5',
                            200: '#e5e5e5',
                            300: '#d4d4d4',
                            400: '#a3a3a3',
                            500: '#737373',
                            600: '#525252',
                            700: '#404040',
                            800: '#262626',
                            900: '#171717',
                        },
                        'xl-green': {
                            500: '#217346',
                            600: '#1a5c38',
                            700: '#12402a',
                        },
                    },
                    fontFamily: {
                        'segoe': ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
                    },
                    boxShadow: {
                        'pa': '0 1.6px 3.6px 0 rgba(0,0,0,0.132), 0 0.3px 0.9px 0 rgba(0,0,0,0.108)',
                        'pa-hover': '0 3.2px 7.2px 0 rgba(0,0,0,0.132), 0 0.6px 1.8px 0 rgba(0,0,0,0.108)',
                    }
                }
            }
        }
