export class NgxMAuthOidcConfig {
    public origin? = '';
    public clientId? = '';
    public dummyClientSecret?: string = null;
    public redirectUri? = '';
    public postLogoutRedirectUri? = '';
    public loginUrl? = '';
    public logoutUrl? = '';
    public scope? = 'openid profile';
    public issuer? = '';
    public tokenEndpoint?: string = null;
    public authorizeEndpoint?: string = null;
    public userinfoEndpoint?: string = null;
    public requestAccessToken? = true;
    public oidc? = true;
    public clearHashAfterLogin? = true;
    public isAuthorizationCodeInPopup? = false;
    public responseType? = '';
    public nonceStateSeparator? = ';';
    public jwks?: object = null;
    public timeoutFactor? = 0.75;
    public disableAtHashCheck? = false;
    public fallbackAccessTokenExpirationTimeInSec?: number;
    public useIdTokenHintForSilentRefresh? = false;
    public silentRefreshRedirectUri? = '';
    public silentRefreshMessagePrefix? = '';
    public silentRefreshShowIFrame? = false;
    public silentRefreshIFrameName? = 'murek-oidc-silent-refresh-iframe';
    public silentRefreshTimeout?: number = 1000 * 20;
    public options?: any = null;

    constructor(json?: Partial<NgxMAuthOidcConfig>) {
        if (json) {
          Object.assign(this, json);
        }
    }

    public openUri?: ((uri: string) => void) = uri => {
        location.href = uri;
    }
}
