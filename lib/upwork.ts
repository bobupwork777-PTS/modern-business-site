import { MongoClient } from "mongodb";

/* =========================================================
   TYPES
========================================================= */

type TokenData = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number | string;
    token_type?: string;
    error?: string;
    error_description?: string;
};

type StoredUpworkToken = {
    provider: "upwork";

    accessToken?: string;
    accessTokenExpiresAt?: Date | string;

    refreshToken?: string;
    refreshTokenUpdatedAt?: Date | string;

    tokenType?: string;

    createdAt?: Date | string;
    updatedAt?: Date | string;
    lastRefreshAt?: Date | string;

    reauthRequired?: boolean;
    reauthRequiredAt?: Date | string;
    reauthReason?: string;

    // Legacy fields
    access_token?: string;
    refresh_token?: string;
    expiresAt?: Date | string;
};

type RefreshTokenSource =
    | "mongodb"
    | "environment"
    | null;

/* =========================================================
   ENVIRONMENT
========================================================= */

const MONGODB_URI =
    process.env.MONGODB_URI || "";

const MONGODB_DB =
    process.env.MONGODB_DB || "upwork_ai";

const UPWORK_CLIENT_ID =
    process.env.UPWORK_CLIENT_ID || "";

const UPWORK_CLIENT_SECRET =
    process.env.UPWORK_CLIENT_SECRET || "";

const UPWORK_REDIRECT_URI =
    (
        process.env.UPWORK_REDIRECT_URI ||
        ""
    ).trim();

/*
 * IMPORTANT:
 *
 * This is your existing refresh token from
 * Vercel / .env.local.
 *
 * It is used as a bootstrap fallback if
 * MongoDB does not yet contain refreshToken.
 */
const UPWORK_ENV_REFRESH_TOKEN =
    (
        process.env.UPWORK_REFRESH_TOKEN ||
        ""
    ).trim();

/* =========================================================
   UPWORK ENDPOINTS
========================================================= */

const TOKEN_URL =
    "https://www.upwork.com/api/v3/oauth2/token";

const AUTH_URL =
    "https://www.upwork.com/ab/account-security/oauth2/authorize";

const GRAPHQL_URL =
    "https://api.upwork.com/graphql";

/*
 * Upwork access token normally lives 24 hours.
 */
const ACCESS_TOKEN_DEFAULT_SECONDS =
    86400;

/*
 * Refresh five minutes before expiry.
 */
const ACCESS_TOKEN_SAFETY_MS =
    5 * 60 * 1000;

/* =========================================================
   VALIDATION
========================================================= */

if (!MONGODB_URI) {
    throw new Error(
        "Missing MONGODB_URI"
    );
}

/* =========================================================
   MONGODB CONNECTION
========================================================= */

declare global {
    var _upworkMongo:
        Promise<MongoClient> | undefined;
}

const mongoPromise =
    global._upworkMongo ||
    new MongoClient(
        MONGODB_URI
    ).connect();

global._upworkMongo =
    mongoPromise;

/* =========================================================
   MEMORY CACHE
========================================================= */

let memoryCache: {
    token: string;
    expiresAt: number;
} | null = null;

/*
 * Prevent multiple refresh requests
 * inside the same Node instance.
 */
let refreshPromise:
    Promise<string> | null = null;

/* =========================================================
   OAUTH ERROR
========================================================= */

class UpworkOAuthError
    extends Error {

    status: number;
    oauthError?: string;

    constructor(
        message: string,
        status: number,
        oauthError?: string
    ) {
        super(message);

        this.name =
            "UpworkOAuthError";

        this.status =
            status;

        this.oauthError =
            oauthError;
    }
}

/* =========================================================
   REAUTH ERROR
========================================================= */

export class UpworkReauthError
    extends Error {

    authUrl: string | null;
    reason: string;

    constructor(
        reason: string
    ) {
        super(
            "UPWORK_REAUTH_REQUIRED"
        );

        this.name =
            "UpworkReauthError";

        this.reason =
            reason;

        try {
            this.authUrl =
                getUpworkAuthorizationUrl();
        } catch {
            this.authUrl =
                null;
        }
    }
}

export function isUpworkReauthError(
    error: any
) {
    return (
        error instanceof
            UpworkReauthError ||

        error?.name ===
            "UpworkReauthError" ||

        String(
            error?.message || ""
        ).includes(
            "UPWORK_REAUTH_REQUIRED"
        )
    );
}

/* =========================================================
   MONGODB COLLECTION
========================================================= */

async function tokensCollection() {

    const client =
        await mongoPromise;

    return client
        .db(MONGODB_DB)
        .collection<StoredUpworkToken>(
            "upwork_tokens"
        );
}

/* =========================================================
   GET STORED TOKEN
========================================================= */

async function getStoredToken() {

    return (
        await tokensCollection()
    ).findOne({
        provider: "upwork"
    });
}

/* =========================================================
   EXPIRATION HELPER
========================================================= */

function getExpiresInSeconds(
    value?: number | string
) {

    const parsed =
        Number(value);

    if (
        !Number.isFinite(parsed) ||
        parsed <= 0
    ) {
        return ACCESS_TOKEN_DEFAULT_SECONDS;
    }

    return parsed;
}

/* =========================================================
   GET ACCESS TOKEN FROM DB
========================================================= */

function getStoredAccessToken(
    stored:
        StoredUpworkToken | null
) {

    return String(
        stored?.accessToken ||
        stored?.access_token ||
        ""
    ).trim();
}

/* =========================================================
   GET REFRESH TOKEN FROM DB
========================================================= */

function getStoredRefreshToken(
    stored:
        StoredUpworkToken | null
) {

    return String(
        stored?.refreshToken ||
        stored?.refresh_token ||
        ""
    ).trim();
}

/* =========================================================
   GET REFRESH TOKEN
========================================================= */

function getRefreshTokenCandidate(
    stored:
        StoredUpworkToken | null
): {
    token: string;
    source: RefreshTokenSource;
} {

    /*
     * FIRST PRIORITY:
     * MongoDB
     */
    const databaseToken =
        getStoredRefreshToken(
            stored
        );

    if (databaseToken) {
        return {
            token:
                databaseToken,

            source:
                "mongodb"
        };
    }

    /*
     * SECOND PRIORITY:
     * Vercel / .env.local
     */
    if (
        UPWORK_ENV_REFRESH_TOKEN
    ) {
        return {
            token:
                UPWORK_ENV_REFRESH_TOKEN,

            source:
                "environment"
        };
    }

    return {
        token: "",
        source: null
    };
}

/* =========================================================
   GET STORED EXPIRATION
========================================================= */

function getStoredExpiry(
    stored:
        StoredUpworkToken | null
) {

    const value =
        stored?.accessTokenExpiresAt ||
        stored?.expiresAt;

    if (!value) {
        return null;
    }

    const timestamp =
        new Date(
            value
        ).getTime();

    if (
        !Number.isFinite(
            timestamp
        )
    ) {
        return null;
    }

    return timestamp;
}

/* =========================================================
   CACHE EXPIRATION
========================================================= */

function getCacheExpiry(
    expiresAt: number
) {

    return Math.max(
        Date.now() + 30 * 1000,

        expiresAt -
        ACCESS_TOKEN_SAFETY_MS
    );
}

/* =========================================================
   SAVE TOKENS
========================================================= */

async function saveTokens(
    data: TokenData,
    source:
        | "authorization_code"
        | "refresh_token"
) {

    if (
        !data.access_token
    ) {
        throw new Error(
            "Upwork access token missing"
        );
    }

    const collection =
        await tokensCollection();

    const now =
        new Date();

    const expiresIn =
        getExpiresInSeconds(
            data.expires_in
        );

    const accessTokenExpiresAt =
        new Date(
            Date.now() +
            expiresIn * 1000
        );

    const setData:
        Record<string, unknown> = {

            provider:
                "upwork",

            accessToken:
                data.access_token,

            accessTokenExpiresAt,

            tokenType:
                data.token_type ||
                "Bearer",

            updatedAt:
                now,

            reauthRequired:
                false,

            reauthReason:
                ""
        };

    /*
     * Save refresh token whenever available.
     *
     * This is especially important because
     * Upwork may rotate the refresh token.
     */
    if (
        data.refresh_token
    ) {

        setData.refreshToken =
            data.refresh_token;

        setData.refreshTokenUpdatedAt =
            now;
    }

    if (
        source ===
        "refresh_token"
    ) {

        setData.lastRefreshAt =
            now;
    }

    await collection.updateOne(
        {
            provider:
                "upwork"
        },
        {
            $set:
                setData,

            $unset: {

                reauthRequiredAt:
                    "",

                /*
                 * Remove legacy fields.
                 */
                access_token:
                    "",

                refresh_token:
                    "",

                expiresAt:
                    ""
            },

            $setOnInsert: {

                createdAt:
                    now
            }
        },
        {
            upsert:
                true
        }
    );

    memoryCache = {

        token:
            data.access_token,

        expiresAt:
            getCacheExpiry(
                accessTokenExpiresAt
                    .getTime()
            )
    };
}

/* =========================================================
   MARK REAUTH REQUIRED
========================================================= */

async function markReauthRequired(
    reason: string,
    clearStoredRefreshToken = false
) {

    memoryCache =
        null;

    const collection =
        await tokensCollection();

    const now =
        new Date();

    const update: any = {

        $set: {

            provider:
                "upwork",

            reauthRequired:
                true,

            reauthRequiredAt:
                now,

            reauthReason:
                reason,

            updatedAt:
                now
        },

        $setOnInsert: {

            createdAt:
                now
        }
    };

    /*
     * Only MongoDB can be cleared here.
     *
     * Environment variable cannot be
     * modified programmatically.
     */
    if (
        clearStoredRefreshToken
    ) {

        update.$unset = {

            refreshToken:
                "",

            refresh_token:
                ""
        };
    }

    await collection.updateOne(
        {
            provider:
                "upwork"
        },
        update,
        {
            upsert:
                true
        }
    );
}

/* =========================================================
   AUTHORIZATION URL
========================================================= */

export function getUpworkAuthorizationUrl() {
    if (!UPWORK_CLIENT_ID) {
        throw new Error("Missing UPWORK_CLIENT_ID");
    }

    if (!UPWORK_REDIRECT_URI) {
        throw new Error("Missing UPWORK_REDIRECT_URI");
    }

    const url = new URL(
        "https://www.upwork.com/ab/account-security/oauth2/authorize"
    );

    url.searchParams.set(
        "response_type",
        "code"
    );

    url.searchParams.set(
        "client_id",
        UPWORK_CLIENT_ID
    );

    url.searchParams.set(
        "redirect_uri",
        UPWORK_REDIRECT_URI
    );

    return url.toString();
}

/* =========================================================
   TOKEN REQUEST
========================================================= */

async function tokenRequest(
    params: Record<string, string>
): Promise<TokenData> {

    if (!UPWORK_CLIENT_ID) {
        throw new Error(
            "Missing UPWORK_CLIENT_ID"
        );
    }

    if (!UPWORK_CLIENT_SECRET) {
        throw new Error(
            "Missing UPWORK_CLIENT_SECRET"
        );
    }

    const response =
        await fetch(
            TOKEN_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Accept":
                        "application/json"
                },

                body:
                    new URLSearchParams({
                        client_id:
                            UPWORK_CLIENT_ID,

                        client_secret:
                            UPWORK_CLIENT_SECRET,

                        ...params
                    }).toString(),

                cache:
                    "no-store",

                redirect:
                    "follow"
            }
        );

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";

    const raw =
        await response.text();

    /*
     * Extremely useful while debugging.
     *
     * Never log tokens themselves.
     */
    console.log(
        "UPWORK TOKEN RESPONSE:",
        {
            status:
                response.status,

            contentType,

            startsWith:
                raw
                    .trim()
                    .slice(0, 30)
        }
    );

    /*
     * Upwork token endpoint should
     * return JSON.
     *
     * If HTML comes back, don't allow
     * JSON.parse() to generate:
     *
     * Unexpected token '<'
     */
    const trimmed =
        raw.trim();

    if (
        trimmed.startsWith("<!DOCTYPE") ||
        trimmed.startsWith("<html") ||
        trimmed.startsWith("<")
    ) {

        console.error(
            "UPWORK TOKEN ENDPOINT RETURNED HTML:",
            trimmed.slice(
                0,
                500
            )
        );

        throw new UpworkOAuthError(
            `Upwork token endpoint returned HTML instead of JSON (${response.status})`,
            response.status
        );
    }

    let data:
        TokenData = {};

    if (trimmed) {

        try {

            data =
                JSON.parse(
                    trimmed
                );

        } catch {

            console.error(
                "INVALID UPWORK TOKEN RESPONSE:",
                trimmed.slice(
                    0,
                    500
                )
            );

            throw new UpworkOAuthError(
                `Invalid Upwork OAuth response (${response.status})`,
                response.status
            );
        }
    }

    if (!response.ok) {

        throw new UpworkOAuthError(
            data.error_description ||
            data.error ||
            `Upwork OAuth error (${response.status})`,

            response.status,

            data.error
        );
    }

    if (!data.access_token) {

        throw new UpworkOAuthError(
            "Upwork OAuth response did not contain access_token",
            response.status
        );
    }

    return data;
}

/* =========================================================
   INVALID REFRESH TOKEN DETECTION
========================================================= */

function refreshTokenIsInvalid(
    error: unknown
) {

    if (
        error instanceof
        UpworkOAuthError
    ) {

        const oauthCode =
            String(
                error.oauthError ||
                ""
            )
                .trim()
                .toLowerCase();

        if (
            oauthCode ===
            "invalid_grant"
        ) {
            return true;
        }
    }

    const message =

        error instanceof Error

            ? error.message

            : String(
                error || ""
            );

    return (
        /invalid_grant|refresh token.*(?:expired|invalid|revoked|not registered)|(?:expired|invalid|revoked).*refresh token/i
    ).test(message);
}

/* =========================================================
   AUTHORIZATION CODE EXCHANGE
========================================================= */

export async function exchangeUpworkAuthorizationCode(
    code: string
) {

    const cleanCode =
        String(
            code || ""
        ).trim();

    if (!cleanCode) {

        throw new Error(
            "Authorization code missing"
        );
    }

    if (!UPWORK_REDIRECT_URI) {

        throw new Error(
            "Missing UPWORK_REDIRECT_URI"
        );
    }

    console.log(
        "UPWORK AUTH CODE EXCHANGE:",
        {
            redirectUri:
                UPWORK_REDIRECT_URI
        }
    );

    const data =
        await tokenRequest({
            grant_type:
                "authorization_code",

            code:
                cleanCode,

            redirect_uri:
                UPWORK_REDIRECT_URI
        });

    if (!data.access_token) {

        throw new Error(
            "Upwork access token missing"
        );
    }

    if (!data.refresh_token) {

        throw new Error(
            "Upwork refresh token missing"
        );
    }

    await saveTokens(
        data,
        "authorization_code"
    );

    console.log(
        "UPWORK TOKENS SAVED TO MONGODB"
    );

    return data;
}

/* =========================================================
   AUTOMATIC TOKEN REFRESH
========================================================= */

export async function refreshUpworkAccessToken():
    Promise<string> {

    const stored =
        await getStoredToken();

    const mongoRefreshToken =
        String(
            stored?.refreshToken ||
            stored?.refresh_token ||
            ""
        ).trim();

    const envRefreshToken =
        String(
            process.env.UPWORK_REFRESH_TOKEN ||
            ""
        ).trim();

    /*
     * Build token candidates.
     *
     * MongoDB first.
     * Environment token second.
     */
    const candidates: {
        token: string;
        source: "mongodb" | "environment";
    }[] = [];

    if (mongoRefreshToken) {
        candidates.push({
            token: mongoRefreshToken,
            source: "mongodb"
        });
    }

    /*
     * Only add environment token if it
     * exists and is different from MongoDB.
     */
    if (
        envRefreshToken &&
        envRefreshToken !== mongoRefreshToken
    ) {
        candidates.push({
            token: envRefreshToken,
            source: "environment"
        });
    }

    if (!candidates.length) {
        const reason =
            "No Upwork refresh token exists in MongoDB or UPWORK_REFRESH_TOKEN.";

        await markReauthRequired(
            reason
        );

        throw new UpworkReauthError(
            reason
        );
    }

    let lastError: unknown = null;

    /*
     * Try each available refresh token.
     */
    for (const candidate of candidates) {

        try {

            console.log(
                `UPWORK: trying ${candidate.source} refresh token`
            );

            const data =
                await tokenRequest({
                    grant_type:
                        "refresh_token",

                    refresh_token:
                        candidate.token
                });

            if (!data.access_token) {
                throw new Error(
                    "Upwork did not return a new access token"
                );
            }

            /*
             * If Upwork doesn't rotate the refresh
             * token, preserve the one that worked.
             */
            const tokenData: TokenData = {
                ...data,

                refresh_token:
                    data.refresh_token ||
                    candidate.token
            };

            /*
             * Save working access + refresh token
             * into MongoDB.
             */
            await saveTokens(
                tokenData,
                "refresh_token"
            );

            console.log(
                `UPWORK TOKEN REFRESH SUCCESS using ${candidate.source}`
            );

            return data.access_token;

        } catch (error) {

            lastError =
                error;

            console.error(
                `UPWORK ${candidate.source.toUpperCase()} REFRESH FAILED:`,
                error
            );

            /*
             * If it isn't an invalid-token problem,
             * don't try to hide temporary/server errors.
             */
            if (
                !refreshTokenIsInvalid(
                    error
                )
            ) {
                throw error;
            }

            /*
             * If MongoDB token is invalid,
             * continue and try environment token.
             */
            if (
                candidate.source ===
                "mongodb"
            ) {

                console.warn(
                    "MongoDB refresh token invalid. Trying environment refresh token."
                );

                continue;
            }
        }
    }

    /*
     * Every refresh token failed.
     */
    const reason =
        lastError instanceof Error
            ? lastError.message
            : "All Upwork refresh tokens are invalid or expired.";

    await markReauthRequired(
        reason,
        true
    );

    throw new UpworkReauthError(
        reason
    );
}

/* =========================================================
   FORCE REFRESH
========================================================= */

export async function forceRefreshUpworkToken():
    Promise<string> {

    clearUpworkTokenCache();

    /*
     * Prevent several requests from
     * refreshing simultaneously.
     */
    if (
        !refreshPromise
    ) {

        refreshPromise =
            refreshUpworkAccessToken()
                .finally(() => {

                    refreshPromise =
                        null;
                });
    }

    return refreshPromise;
}

/* =========================================================
   GET VALID ACCESS TOKEN
========================================================= */

export async function getUpworkAccessToken(
    forceRefresh = false
):
    Promise<string> {

    /*
     * 1. MEMORY CACHE
     */
    if (
        !forceRefresh &&
        memoryCache &&
        Date.now() <
            memoryCache.expiresAt
    ) {

        return memoryCache.token;
    }

    /*
     * 2. MONGODB
     */
    if (
        !forceRefresh
    ) {

        const stored =
            await getStoredToken();

        const accessToken =
            getStoredAccessToken(
                stored
            );

        const expiresAt =
            getStoredExpiry(
                stored
            );

        /*
         * Existing access token is valid.
         */
        if (
            accessToken &&
            expiresAt &&
            Date.now() <
                expiresAt -
                ACCESS_TOKEN_SAFETY_MS
        ) {

            memoryCache = {

                token:
                    accessToken,

                expiresAt:
                    getCacheExpiry(
                        expiresAt
                    )
            };

            return accessToken;
        }
    }

    /*
     * 3. TOKEN MISSING / EXPIRED
     *
     * Automatically refresh.
     *
     * NO browser redirect.
     * NO callback.
     * NO Wix code.
     */
    if (
        !refreshPromise
    ) {

        refreshPromise =
            refreshUpworkAccessToken()
                .finally(() => {

                    refreshPromise =
                        null;
                });
    }

    return refreshPromise;
}

/* =========================================================
   CLEAR MEMORY CACHE
========================================================= */

export function clearUpworkTokenCache() {

    memoryCache =
        null;
}

/* =========================================================
   AUTHENTICATED UPWORK FETCH
========================================================= */

export async function upworkFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {

    /*
     * Automatically obtains a valid token.
     */
    let token =
        await getUpworkAccessToken();

    const makeRequest = (
        accessToken: string
    ) => {

        const headers =
            new Headers(
                options.headers
            );

        headers.set(
            "Authorization",
            `Bearer ${accessToken}`
        );

        headers.set(
            "Accept",
            "application/json"
        );

        return fetch(
            url,
            {
                ...options,

                headers,

                cache:
                    "no-store"
            }
        );
    };

    /*
     * First request.
     */
    let response =
        await makeRequest(
            token
        );

    /*
     * Token may have become invalid
     * before our stored expiry date.
     *
     * If Upwork returns 401:
     *
     * refresh automatically
     * then retry exactly once.
     */
    if (
        response.status ===
        401
    ) {

        console.warn(
            "UPWORK 401: refreshing token automatically"
        );

        clearUpworkTokenCache();

        token =
            await getUpworkAccessToken(
                true
            );

        response =
            await makeRequest(
                token
            );
    }

    return response;
}

/* =========================================================
   UPWORK GRAPHQL
========================================================= */

export async function upworkGraphQL<
    T = any
>(
    query: string,
    variables:
        Record<string, any> = {}
): Promise<T> {

    const response =
        await upworkFetch(
            GRAPHQL_URL,
            {
                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({

                        query,

                        variables
                    })
            }
        );

    const raw =
        await response.text();

    let data:
        any = {};

    if (raw) {

        try {

            data =
                JSON.parse(raw);

        } catch {

            throw new Error(
                `Invalid Upwork response (${response.status})`
            );
        }
    }

    if (
        !response.ok
    ) {

        throw new Error(

            data?.error_description ||

            data?.message ||

            data?.error ||

            `Upwork API error ${response.status}`
        );
    }

    if (
        Array.isArray(
            data?.errors
        ) &&
        data.errors.length
    ) {

        throw new Error(

            data.errors

                .map(
                    (item: any) =>
                        item?.message
                )

                .filter(Boolean)

                .join(" | ") ||

            "Upwork GraphQL error"
        );
    }

    return data as T;
}

/* =========================================================
   TOKEN STATUS
========================================================= */

export async function getUpworkTokenStatus() {

    const stored =
        await getStoredToken();

    const accessToken =
        getStoredAccessToken(
            stored
        );

    const databaseRefreshToken =
        getStoredRefreshToken(
            stored
        );

    const environmentRefreshToken =
        String(
            process.env.UPWORK_REFRESH_TOKEN ||
            ""
        ).trim();

    const hasRefreshToken =
        Boolean(
            databaseRefreshToken ||
            environmentRefreshToken
        );

    const expiresAt =
        getStoredExpiry(
            stored
        );

    const accessTokenExpired =
        expiresAt
            ? Date.now() >= expiresAt
            : true;

    return {

        connected:
            Boolean(
                databaseRefreshToken
            ),

        hasAccessToken:
            Boolean(
                accessToken
            ),

        hasRefreshToken,

        refreshTokenSource:
            databaseRefreshToken
                ? "mongodb"
                : environmentRefreshToken
                    ? "environment"
                    : null,

        accessTokenExpiresAt:
            stored?.accessTokenExpiresAt ||
            stored?.expiresAt ||
            null,

        accessTokenExpired,

        refreshTokenUpdatedAt:
            stored?.refreshTokenUpdatedAt ||
            null,

        lastRefreshAt:
            stored?.lastRefreshAt ||
            null,

        reauthRequired:
            stored?.reauthRequired === true,

        reauthRequiredAt:
            stored?.reauthRequiredAt ||
            null,

        reauthReason:
            stored?.reauthReason ||
            null
    };
}