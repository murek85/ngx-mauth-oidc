export interface NgxMAuthOidcValidationParams {
    idToken: string;
    accessToken: string;
    idTokenHeader: object;
    idTokenClaims: object;
    jwks: object;
    loadKeys: () => Promise<object>;
}
