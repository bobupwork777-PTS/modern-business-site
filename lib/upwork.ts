let tokenCache:{
    token:string;
    expiresAt:number;
}|null = null;

export async function getUpworkAccessToken(
    forceRefresh=false
){

    if(
        !forceRefresh &&
        tokenCache &&
        Date.now() < tokenCache.expiresAt
    ){
        return tokenCache.token;
    }

    const clientId =
        process.env.UPWORK_CLIENT_ID;

    const clientSecret =
        process.env.UPWORK_CLIENT_SECRET;

    const refreshToken =
        process.env.UPWORK_REFRESH_TOKEN;

    if(
        !clientId ||
        !clientSecret ||
        !refreshToken
    ){
        throw new Error(
            "Missing Upwork OAuth credentials"
        );
    }

    const response =
        await fetch(
            "https://www.upwork.com/api/v3/oauth2/token",
            {
                method:"POST",

                headers:{
                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    Accept:
                        "application/json"
                },

                body:
                    new URLSearchParams({
                        grant_type:
                            "refresh_token",

                        client_id:
                            clientId,

                        client_secret:
                            clientSecret,

                        refresh_token:
                            refreshToken
                    }),

                cache:"no-store"
            }
        );

    const data =
        await response.json();

    if(!response.ok){

        console.error(
            "Upwork OAuth Error:",
            data
        );

        throw new Error(
            data.error_description ||
            data.error ||
            "Unable to refresh Upwork access token"
        );
    }

    if(!data.access_token){

        throw new Error(
            "Upwork access token missing"
        );
    }

    tokenCache = {
        token:
            data.access_token,

        expiresAt:
            Date.now() +
            Math.max(
                (
                    Number(
                        data.expires_in
                    ) || 86400
                ) - 300,
                60
            ) * 1000
    };

    return data.access_token;
}

export function clearUpworkTokenCache(){
    tokenCache = null;
}