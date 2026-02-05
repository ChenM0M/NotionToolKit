"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

// Subscribe function that does nothing (client state never changes)
const emptySubscribe = () => () => {};

// Get snapshot for client - always returns true
const getClientSnapshot = () => true;

// Get snapshot for server - always returns false
const getServerSnapshot = () => false;

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    
    // Use useSyncExternalStore to safely detect client-side mounting
    const mounted = useSyncExternalStore(
        emptySubscribe,
        getClientSnapshot,
        getServerSnapshot
    );

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4" />
            </Button>
        );
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        >
            {theme === "dark" ? (
                <Sun className="h-4 w-4" />
            ) : (
                <Moon className="h-4 w-4" />
            )}
        </Button>
    );
}
