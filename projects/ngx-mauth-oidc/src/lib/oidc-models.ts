export class NgxMAuthOidcLoginOptions {
    onTokenReceived?: (receivedTokens: NgxMAuthOidcReceivedTokens) => void;
    validationHandler?: (receivedTokens: NgxMAuthOidcReceivedTokens) => Promise<any>;
    onLoginError?: (params: object) => void;

    customHashFragment?: string;
    disableOAuth2StateCheck?: boolean;
    preventClearHashAfterLogin? = false;
}

export class NgxMAuthOidcReceivedTokens {
    idToken: string;
    accessToken: string;
    idClaims?: object;
    state?: string;
}

export interface NgxMAuthOidcTokenResponse {
    access_token: string;
    id_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    state?: string;
}

export interface NgxMAuthOidcParsedIdToken {
    idToken: string;
    idTokenClaims: object;
    idTokenHeader: object;
    idTokenClaimsJson: string;
    idTokenHeaderJson: string;
    idTokenExpiresAt: number;
}

export abstract class NgxMAuthOidcStorage {
    abstract getItem(key: string): string | null;
    abstract removeItem(key: string): void;
    abstract setItem(key: string, data: string): void;
}

export interface NgxMAuthOidcUserInfo {
    sub: string;
    [key: string]: any;
}

export interface NgxMAuthOidcDocument {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    token_endpoint_auth_methods_supported: string[];
    token_endpoint_auth_signing_alg_values_supported: string[];
    userinfo_endpoint: string;
    check_session_iframe: string;
    end_session_endpoint: string;
    jwks_uri: string;
    registration_endpoint: string;
    scopes_supported: string[];
    response_types_supported: string[];
    acr_values_supported: string[];
    response_modes_supported: string[];
    grant_types_supported: string[];
    subject_types_supported: string[];
    userinfo_signing_alg_values_supported: string[];
    userinfo_encryption_alg_values_supported: string[];
    userinfo_encryption_enc_values_supported: string[];
    id_token_signing_alg_values_supported: string[];
    id_token_encryption_alg_values_supported: string[];
    id_token_encryption_enc_values_supported: string[];
    request_object_signing_alg_values_supported: string[];
    display_values_supported: string[];
    claim_types_supported: string[];
    claims_supported: string[];
    claims_parameter_supported: boolean;
    service_documentation: string;
    ui_locales_supported: string[];
}
