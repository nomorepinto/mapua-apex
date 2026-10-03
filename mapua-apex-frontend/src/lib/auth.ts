export async function getIdToken(): Promise<string> {
    const authority = import.meta.env.VITE_COGNITO_AUTHORITY;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const key = `oidc.user:${authority}:${clientId}`;
    
    const storageString = sessionStorage.getItem(key);
    if (!storageString) {
        return "";
    }
    
    try {
        const oidcData = JSON.parse(storageString);
        return oidcData.id_token || oidcData.access_token || "";
    } catch (e) {
        console.error("Failed to parse OIDC session data", e);
        return "";
    }
}
