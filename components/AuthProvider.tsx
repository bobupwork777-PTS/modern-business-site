"use client";

import { createContext, useContext, useEffect, useState } from "react";


type User = {
    name: string;
    role: string;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    setUser: () => {}
});

export function AuthProvider({
    children
}: {
    children: React.ReactNode
}) {

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if(storedUser){
            const userData = JSON.parse(storedUser);
            setUser({
                name: userData.name,
                role: userData.role
            });
            // console.log("User:", userData);
        }
        else{
            // fallback from cookie
            const cookies = document.cookie
                .split("; ")
                .reduce((acc:any, cookie)=>{
                    const [key,value] = cookie.split("=");
                    acc[key] = value;
                    return acc;
                },{});

            if(cookies.role){
                setUser({
                    name:"",
                    role:cookies.role
                });
            }
        }
        setLoading(false);
    },[]);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                setUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(){
    return useContext(AuthContext);

}