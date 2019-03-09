import { Injectable, Optional, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
// import { Subject, Observable, Subscription, of, race } from 'rxjs';
// import { filter, take, delay, first, tap, map } from 'rxjs/operators';

// import { Observable } from 'rxjs/Observable';
// import { Subject } from 'rxjs/Subject';
// import { Subscription } from 'rxjs/Subscription';

import { Observable, Subject, Subscription } from 'rxjs/Rx';

import 'rxjs/add/observable/of';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/filter';

import { NgxMAuthOidcConfig } from './oidc-config';
import { NgxMAuthOidcStorage,
    NgxMAuthOidcLoginOptions,
    NgxMAuthOidcParsedIdToken,
    NgxMAuthOidcUserInfo,
    NgxMAuthOidcTokenResponse,
    NgxMAuthOidcDocument } from './oidc-models';
import { NgxMAuthOidcEvent,
    NgxMAuthOidcInfoEvent,
    NgxMAuthOidcErrorEvent,
    NgxMAuthOidcSuccessEvent } from './oidc-events';
import { WebHttpUrlEncodingCodec,
    NgxMAuthOidcHelperService,
    b64DecodeUnicode } from './oidc-helper.service';
import { NgxMAuthOidcValidationParams } from './token-validation/oidc-validation-handler';
import { isNullOrUndefined } from 'util';

@Injectable()
export class NgxMAuthOidcService extends NgxMAuthOidcConfig {

    public documentLoaded = false;
    public documentLoaded$: Observable<object>;
    public events: Observable<NgxMAuthOidcEvent>;
    public state? = '';

    protected eventsSubject: Subject<NgxMAuthOidcEvent> = new Subject<NgxMAuthOidcEvent>();
    protected documentLoadedSubject: Subject<object> = new Subject<object>();
    protected grantTypesSupported: Array<string> = [];
    protected storage: NgxMAuthOidcStorage;
    protected accessTokenTimeoutSubscription: Subscription;
    protected idTokenTimeoutSubscription: Subscription;
    protected jwksUri: string;
    protected sessionCheckTimer: any;
    protected silentRefreshSubject: string;

    constructor(
        protected ngZone: NgZone,
        protected http: HttpClient,
        protected helperService: NgxMAuthOidcHelperService,
        @Optional() storage: NgxMAuthOidcStorage,
        @Optional() protected config: NgxMAuthOidcConfig) {

        super();

        this.documentLoaded$ = this.documentLoadedSubject.asObservable();
        this.events = this.eventsSubject.asObservable();

        this.configure(config);

        try {
            if (storage) {
                this.setStorage(storage);
            } else if (typeof sessionStorage !== 'undefined') {
                this.setStorage(sessionStorage);
            }
        } catch (e) {
            console.error(
                'No OAuthStorage provided and cannot access default (sessionStorage).'
                + 'Consider providing a custom OAuthStorage implementation in your module.',
                e
            );
        }

        this.setupRefreshTimer();
    }

    public configure(
        config?: NgxMAuthOidcConfig) {

        if (config == null) {
            return;
        }

        Object.assign(this, new NgxMAuthOidcConfig(), config);
        this.config = Object.assign({} as NgxMAuthOidcConfig, new NgxMAuthOidcConfig(), config);
    }

    private setupRefreshTimer(): void {

        if (typeof window === 'undefined') {
            return;
        }

        if (this.hasValidAccessToken()) {
            this.clearAccessTokenTimer();
            this.clearIdTokenTimer();
            this.setupExpirationTimers();
        }

        this.events.filter(e => e.type === 'token_received').subscribe(() => {
            this.clearAccessTokenTimer();
            this.clearIdTokenTimer();
            this.setupExpirationTimers();
        });
    }

    private setupExpirationTimers(): void {

        const idTokenExp = this.getIdTokenExpiration() || Number.MAX_VALUE;
        const accessTokenExp = this.getAccessTokenExpiration() || Number.MAX_VALUE;
        const useAccessTokenExp = accessTokenExp <= idTokenExp;

        if (this.hasValidAccessToken() && useAccessTokenExp) {
            this.setupAccessTokenTimer();
        }

        if (this.hasValidIdToken() && !useAccessTokenExp) {
            this.setupIdTokenTimer();
        }
    }

    private setupAccessTokenTimer(): void {

        const expiration = this.getAccessTokenExpiration();
        const storedAt = this.getAccessTokenStoredAt();
        const timeout = this.calcTimeout(storedAt, expiration);

        this.accessTokenTimeoutSubscription =
            Observable
                .of(new NgxMAuthOidcInfoEvent('token_expires', 'access_token'))
                .delay(timeout)
                .subscribe(e => this.eventsSubject.next(e));
        // this.ngZone.runOutsideAngular(() => {
        //     this.accessTokenTimeoutSubscription = of(
        //         new NgxMAuthOidcInfoEvent('token_expires', 'access_token')
        //     )
        //         .pipe(delay(timeout))
        //         .subscribe(e => {
        //             this.ngZone.run(() => {
        //                 this.eventsSubject.next(e);
        //             });
        //         });
        // });
    }

    private setupIdTokenTimer(): void {

    }

    private clearAccessTokenTimer(): void {

        if (this.accessTokenTimeoutSubscription) {
            this.accessTokenTimeoutSubscription.unsubscribe();
        }
    }

    private clearIdTokenTimer(): void {

    }

    private calcTimeout(storedAt: number, expiration: number): number {

        const tokenLifetime = expiration - storedAt;
        const refreshTime = storedAt + (tokenLifetime * this.timeoutFactor);
        const timeLeft = Math.max(0, refreshTime - Date.now());
        return timeLeft;
    }

    public setStorage(storage: NgxMAuthOidcStorage): void {

        this.storage = storage;
    }

    private restartRefreshTimerIfStillLoggedIn(): void {

        this.setupExpirationTimers();
    }

    public getIdentityClaims(): object {

        const claims = this.storage.getItem('id_token_claims_obj');
        if (!claims) {
            return null;
        }
        return JSON.parse(claims);
    }

    public getIdToken(): string {

        return this.storage ? this.storage.getItem('id_token') : null;
    }

    public getAccessToken(): string {

        return this.storage.getItem('access_token');
    }

    public getRefreshToken(): string {

        return this.storage.getItem('refresh_token');
    }

    public getAccessTokenExpiration(): number {

        if (!this.storage.getItem('expires_at')) {
            return null;
        }
        return parseInt(this.storage.getItem('expires_at'), 10);
    }

    public getIdTokenExpiration(): number {

        if (!this.storage.getItem('id_token_expires_at')) {
            return null;
        }

        return parseInt(this.storage.getItem('id_token_expires_at'), 10);
    }

    private getAccessTokenStoredAt(): number {

        return parseInt(this.storage.getItem('access_token_stored_at'), 10);
    }

    private getIdTokenStoredAt(): number {

        return parseInt(this.storage.getItem('id_token_stored_at'), 10);
    }

    public hasValidAccessToken(): boolean {

        if (this.getAccessToken()) {
            const expiresAt = this.storage.getItem('expires_at');
            const now = new Date();
            if (expiresAt && parseInt(expiresAt, 10) < now.getTime()) {
                return false;
            }

            return true;
        }

        return false;
    }

    public hasValidIdToken(): boolean {

        if (this.getIdToken()) {
            const expiresAt = this.storage.getItem('id_token_expires_at');
            const now = new Date();
            if (expiresAt && parseInt(expiresAt, 10) < now.getTime()) {
                return false;
            }

            return true;
        }

        return false;
    }

    public authorizationHeader(): string {

        const accessToken = this.getAccessToken();
        return 'Bearer ' + accessToken;
    }

    private loadJwks(): Promise<object> {

        return new Promise<object>((resolve, reject) => {
            if (this.jwksUri) {
                this.http.get(this.jwksUri).subscribe(
                    jwks => {
                        this.jwks = jwks;
                        this.eventsSubject.next(new NgxMAuthOidcSuccessEvent('document_loaded'));
                        resolve(jwks);
                    },
                    error => {
                        this.eventsSubject.next(new NgxMAuthOidcErrorEvent('jwks_load_error', error));
                        reject(error);
                    }
                );
            } else {
                resolve(null);
            }
        });
    }

    public loadDocument(
        fullUrl: string = null): Promise<object> {

        return new Promise((resolve, reject) => {
            if (!fullUrl) {
                fullUrl = this.issuer || '';
                if (!fullUrl.endsWith('/')) {
                    fullUrl += '/';
                }
                fullUrl += '.well-known/openid-configuration';
            }

            this.http.get<NgxMAuthOidcDocument>(fullUrl).subscribe(
                document => {
                    this.loginUrl = document.authorization_endpoint;
                    this.logoutUrl = document.end_session_endpoint || this.logoutUrl;
                    this.grantTypesSupported = document.grant_types_supported;
                    this.issuer = document.issuer;
                    this.tokenEndpoint = document.token_endpoint;
                    this.userinfoEndpoint = document.userinfo_endpoint;
                    this.jwksUri = document.jwks_uri;
                    // this.sessionCheckIFrameUrl = document.check_session_iframe || this.sessionCheckIFrameUrl;

                    this.documentLoaded = true;
                    this.documentLoadedSubject.next(document);

                    this.loadJwks()
                        .then(jwks => {
                            const result: object = {
                                document: document,
                                jwks: jwks
                            };

                            const event = new NgxMAuthOidcSuccessEvent('document_loaded', result);
                            this.eventsSubject.next(event);
                            resolve(event);
                            return;
                        })
                        .catch(error => {
                            this.eventsSubject.next(
                                new NgxMAuthOidcErrorEvent('document_load_error', error)
                            );
                            reject(error);
                            return;
                        });
                },
                error => {
                    this.eventsSubject.next(
                        new NgxMAuthOidcErrorEvent('document_load_error', error)
                    );
                    reject(error);
                }
            );
        });
    }

    public loadDocumentAndTryLogin(

        options: NgxMAuthOidcLoginOptions = null): Promise<boolean> {

        return this.loadDocument().then(document => {
            return this.tryLogin(options);
        });
    }

    public tryLogin(

        options: NgxMAuthOidcLoginOptions = null): Promise<boolean> {

        options = options || {};

        let parts: object = {};
        if (this.helperService.isHashFragmentParams(options.customHashFragment)) {
            if (options.customHashFragment) {
                parts = this.helperService.getHashFragmentParams(options.customHashFragment);
            } else {
                parts = this.helperService.getHashFragmentParams();
            }
        } else if (this.helperService.isSearchFragmentParams(options.customSearchFragment)) {
            if (options.customSearchFragment) {
                parts = this.helperService.getSearchFragmentParams(options.customSearchFragment);
            } else {
                parts = this.helperService.getSearchFragmentParams();
            }
        }
        console.log('parts', parts);

        const state = parts['state'];
        let nonceInState = state;

        if (state) {
            const idx = state.indexOf(this.config.nonceStateSeparator);

            if (idx > -1) {
                nonceInState = state.substr(0, idx);
                this.state = state.substr(idx + this.config.nonceStateSeparator.length);
            }
        }

        if (parts['error']) {
            const err = new NgxMAuthOidcErrorEvent('token_error', {}, parts);
            this.eventsSubject.next(err);
            return Promise.reject(err);
        }

        const accessToken = parts['access_token'];
        const idToken = parts['id_token'];
        const sessionState = parts['session_state'];
        const grantedScopes = parts['scope'];
        const code = parts['code'];

        if (code && state) {
            return new Promise((resolve, reject) => {
                this.getTokenFromCode(code)
                    .then(result => {
                        resolve(true);
                    })
                    .catch(error => {
                        reject(error);
                    });
            });
        }

        if (this.requestAccessToken && !accessToken && !code) {
            return Promise.resolve(false);
        }

        if (this.requestAccessToken) {
            this.storeAccessTokenResponse(
                accessToken, null, parts['expires_in'] || this.fallbackAccessTokenExpirationTimeInSec, grantedScopes
            );
        }

        return this.processIdToken(idToken, accessToken)
            .then(result => {
                return result;
            })
            .then(result => {
                this.storeIdToken(result);
                if (this.clearHashAfterLogin) {
                    location.hash = '';
                }
                this.eventsSubject.next(
                    new NgxMAuthOidcSuccessEvent('token_received')
                );
                return true;
            })
            .catch(error => {
                this.eventsSubject.next(
                    new NgxMAuthOidcErrorEvent('token_validation_error', error)
                );
                return Promise.reject(error);
            });
    }

    public initAuthorizationCode(
        params: string | object = '') {

        this.createLoginUrl(params)
            .then(url => {
                if (this.isAuthorizationCodeInPopup) {
                    let windowRef = window.open(url, '_blank', this.helperService.calculatePopupFeatures({}));

                    const cleanup = () => {
                        window.removeEventListener('message', listener);
                        windowRef.close();
                        windowRef = null;
                    };

                    const listener = (event: MessageEvent) => {
                        if (event.origin === this.origin) {
                            const token = event.data;
                            if (!isNullOrUndefined(token)) {
                                this.storeAccessTokenResponse(token.access_token, token.refresh_token, token.expires_in, token.scope);
                                this.eventsSubject.next(
                                    new NgxMAuthOidcSuccessEvent('token_received')
                                );
                                cleanup();
                            }
                        }
                    };

                    window.addEventListener('message', listener);
                } else {
                    location.href = url;
                }
            })
            .catch(error => {
                console.log(error);
            });
    }

    /**
     * DEPRECATED, Zalecane używanie metody 'initAuthorizationCode'
     *
     * @ignore
     * @param params
     */
    public initImplicitFlow(

        params: string | object = '') {

        this.createLoginUrl(params)
            .then(url => {
                location.href = url;
            })
            .catch(error => {
                console.log(error);
            });
    }

    public loadUserProfile(): Promise<object> {

        return new Promise((resolve, reject) => {
            const headers = new HttpHeaders().set(
                'Authorization', 'Bearer ' + this.getAccessToken()
            );

            this.http.get<NgxMAuthOidcUserInfo>(this.userinfoEndpoint, { headers }).subscribe(
                userinfo => {
                    const existingClaims = this.getIdentityClaims() || {};
                    userinfo = Object.assign({}, existingClaims, userinfo);
                    this.storage.setItem('id_token_claims_obj', JSON.stringify(userinfo));
                    this.eventsSubject.next(
                        new NgxMAuthOidcSuccessEvent('user_profile_loaded')
                    );
                    resolve(userinfo);
                },
                error => {
                    this.eventsSubject.next(
                        new NgxMAuthOidcErrorEvent('user_profile_load_error', error)
                    );
                    reject(error);
                }
            );
        });
    }

    public fetchTokenUsingPasswordFlow(

        userName: string,
        password: string,
        headers: HttpHeaders = new HttpHeaders()): Promise<object> {

        return new Promise((resolve, reject) => {
            let params = new HttpParams({ encoder: new WebHttpUrlEncodingCodec() })
                .set('grant_type', 'password')
                .set('scope', this.scope)
                .set('username', userName)
                .set('password', password);

            params = params.set('client_id', this.clientId);

            if (this.dummyClientSecret) {
                params = params.set('client_secret', this.dummyClientSecret);
            }

            headers = headers.set(
                'Content-Type', 'application/x-www-form-urlencoded'
            );

            this.http.post<NgxMAuthOidcTokenResponse>(this.tokenEndpoint, params, { headers }).subscribe(
                token => {
                    this.storeAccessTokenResponse(token.access_token, token.refresh_token, token.expires_in, token.scope);
                    this.eventsSubject.next(
                        new NgxMAuthOidcSuccessEvent('token_received')
                    );
                    resolve(token);
                },
                error => {
                    this.eventsSubject.next(
                        new NgxMAuthOidcErrorEvent('token_error', error)
                    );
                    reject(error);
                }
            );
        });
    }

    public refreshToken(): Promise<object> {

        return new Promise((resolve, reject) => {
            let params = new HttpParams()
                .set('grant_type', 'refresh_token')
                .set('client_id', this.clientId)
                .set('scope', this.scope)
                .set('refresh_token', this.storage.getItem('refresh_token'));

            if (this.dummyClientSecret) {
                params = params.set('client_secret', this.dummyClientSecret);
            }

            const headers = new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded');

            this.http.post<NgxMAuthOidcTokenResponse>(this.tokenEndpoint, params, { headers }).subscribe(
                token => {
                    this.storeAccessTokenResponse(token.access_token, token.refresh_token, token.expires_in, token.scope);
                    this.eventsSubject.next(
                        new NgxMAuthOidcSuccessEvent('token_received')
                    );
                    this.eventsSubject.next(
                        new NgxMAuthOidcSuccessEvent('token_refreshed')
                    );
                    resolve(token);
                },
                error => {
                    this.eventsSubject.next(
                        new NgxMAuthOidcErrorEvent('token_refresh_error', error)
                    );
                    reject(error);
                }
            );
        });

        // const claims: object = this.getIdentityClaims() || {};

        // if (this.useIdTokenHintForSilentRefresh && this.hasValidIdToken()) {
        //     params['id_token_hint'] = this.getIdToken();
        // }

        // if (typeof document === 'undefined') {
        //     throw new Error('silent refresh is not supported on this platform');
        // }

        // const existingIframe = document.getElementById(this.silentRefreshIFrameName);
        // if (existingIframe) {
        //     console.log('removeChild existingIframe');
        //     document.body.removeChild(existingIframe);
        // }

        // this.silentRefreshSubject = claims['sub'];

        // const iframe = document.createElement('iframe');
        // iframe.id = this.silentRefreshIFrameName;

        // const redirectUri = this.silentRefreshRedirectUri || this.redirectUri;
        // this.createLoginUrl(params, noPrompt).then(url => {
        //     iframe.setAttribute('src', url);

        //     if (!this.silentRefreshShowIFrame) {
        //         iframe.style['display'] = 'none';
        //     }
        //     document.body.appendChild(iframe);
        // });

        // const errors = this.events.pipe(
        //     filter(e => e instanceof OidcErrorEvent),
        //     first()
        // );
        // const success = this.events.pipe(
        //     filter(e => e.type === 'silently_refreshed'),
        //     first()
        // );
        // const timeout = of(
        //     new OidcErrorEvent('silent_refresh_timeout', null)
        // ).pipe(delay(this.silentRefreshTimeout));

        // return race([errors, success, timeout])
        //     .pipe(
        //         tap(e => {
        //             if (e.type === 'silent_refresh_timeout') {
        //                 this.eventsSubject.next(e);
        //             }
        //         }),
        //         map(e => {
        //             if (e instanceof OidcErrorEvent) {
        //                 throw e;
        //             }
        //             return e;
        //         })
        //     )
        //     .toPromise();
    }

    public logout(
        noRedirectToLogoutUrl = false): void {

        const idToken = this.getIdToken();
        this.storage.removeItem('access_token');
        this.storage.removeItem('id_token');
        this.storage.removeItem('refresh_token');
        this.storage.removeItem('nonce');
        this.storage.removeItem('expires_at');
        this.storage.removeItem('id_token_claims_obj');
        this.storage.removeItem('id_token_expires_at');
        this.storage.removeItem('id_token_stored_at');
        this.storage.removeItem('access_token_stored_at');
        this.storage.removeItem('granted_scopes');
        this.storage.removeItem('session_state');

        this.silentRefreshSubject = null;

        this.clearAccessTokenTimer();
        this.clearIdTokenTimer();

        this.eventsSubject.next(
            new NgxMAuthOidcInfoEvent('logout')
        );

        if (!this.logoutUrl) {
            return;
        }

        if (noRedirectToLogoutUrl) {
            return;
        }

        if (!idToken && !this.postLogoutRedirectUri) {
            return;
        }

        let logoutUrl: string;
        // For backward compatibility
        if (this.logoutUrl.indexOf('{{') > -1) {
            logoutUrl = this.logoutUrl
                .replace(/\{\{id_token\}\}/, idToken)
                .replace(/\{\{client_id\}\}/, this.clientId);
        } else {
            let params = new HttpParams();
            if (idToken) {
                params = params.set('id_token_hint', idToken);
            }

            const postLogoutUrl = this.postLogoutRedirectUri || this.redirectUri;
            if (postLogoutUrl) {
                params = params.set('post_logout_redirect_uri', postLogoutUrl);
            }

            logoutUrl = this.logoutUrl +
                (this.logoutUrl.indexOf('?') > -1 ? '&' : '?') +
                params.toString();
        }

        location.href = logoutUrl;
    }

    public createLoginUrl(
        params = { }, noPrompt = false): Promise<string> {

        return new Promise((resolve, reject) => {
            const scope = this.scope;
            const redirectUri = this.redirectUri;

            let nonce = '';
            const possible =
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

            for (let i = 0; i < 40; i++) {
                nonce += possible.charAt(Math.floor(Math.random() * possible.length));
            }

            this.storage.setItem('nonce', nonce);

            let state = '';
            state = nonce;
            if (this.config.responseType) {
                this.responseType = this.config.responseType;
            } else {
                if (this.oidc && this.requestAccessToken) {
                    this.responseType = 'id_token token';
                } else if (this.oidc && !this.requestAccessToken) {
                    this.responseType = 'id_token';
                } else {
                    this.responseType = 'token';
                }
            }

            const seperationChar = this.loginUrl.indexOf('?') > -1 ? '&' : '?';
            let url = this.loginUrl +
                seperationChar +
                'response_type=' + encodeURIComponent(this.responseType) +
                '&scope=' + encodeURIComponent(scope) +
                '&state=' + encodeURIComponent(state) +
                '&client_id=' + encodeURIComponent(this.clientId) +
                '&redirect_uri=' + encodeURIComponent(redirectUri);

            if (this.oidc) {
                url += '&nonce=' + encodeURIComponent(nonce);
            }

            if (noPrompt) {
                url += '&prompt=none';
            }

            for (const key of Object.keys(params)) {
                url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
            }

            resolve(url);
        });
    }

    public getTokenFromCode(
        code: string): Promise<object> {

        return new Promise((resolve, reject) => {
            let params = new HttpParams({ encoder: new WebHttpUrlEncodingCodec() })
                .set('grant_type', 'authorization_code')
                .set('code', code)
                .set('scope', this.scope)
                .set('redirect_uri', this.redirectUri);

            params = params.set('client_id', this.clientId);

            if (this.dummyClientSecret) {
                params = params.set('client_secret', this.dummyClientSecret);
            }

            const headers = new HttpHeaders()
                .set('Content-Type', 'application/x-www-form-urlencoded');

            this.http.post<NgxMAuthOidcTokenResponse>(this.tokenEndpoint, params, { headers }).subscribe(
                token => {
                    if (this.isAuthorizationCodeInPopup) {
                        window.opener.postMessage(token, this.origin);
                    }

                    this.storeAccessTokenResponse(token.access_token, token.refresh_token, token.expires_in, token.scope);
                    if (this.clearSearchAfterLogin) {
                        location.href = '';
                    }
                    this.eventsSubject.next(
                        new NgxMAuthOidcSuccessEvent('token_received')
                    );
                    resolve(token);
                },
                error => {
                    this.eventsSubject.next(
                        new NgxMAuthOidcErrorEvent('token_error', error)
                    );
                    reject(error);
                }
            );
        });
    }

    private processIdToken(
        idToken: string,
        accessToken: string): Promise<any> {

        const tokenParts = idToken.split('.');
        const headerBase64 = this.helperService.padBase64(tokenParts[0]);
        const headerJson = b64DecodeUnicode(headerBase64);
        const header = JSON.parse(headerJson);
        const claimsBase64 = this.helperService.padBase64(tokenParts[1]);
        const claimsJson = b64DecodeUnicode(claimsBase64);
        const claims = JSON.parse(claimsJson);
        const savedNonce = this.storage.getItem('nonce');

        const now = Date.now();
        const issuedAtMSec = claims.iat * 1000;
        const expiresAtMSec = claims.exp * 1000;
        const tenMinutesInMsec = 1000 * 60 * 10;

        if (issuedAtMSec - tenMinutesInMsec >= now || expiresAtMSec + tenMinutesInMsec <= now) {
            const err = 'Token has expired';
            return Promise.reject(err);
        }

        const validationParams: NgxMAuthOidcValidationParams = {
            accessToken: accessToken,
            idToken: idToken,
            jwks: this.jwks,
            idTokenClaims: claims,
            idTokenHeader: header,
            loadKeys: () => this.loadJwks()
        };

        return this.checkAtHash(validationParams)
            .then(atHashValid => {
                if (!this.disableAtHashCheck && this.requestAccessToken && !atHashValid) {
                    const err = 'Wrong at_hash';
                    return Promise.reject(err);
                }

                return this.chechkSignature(validationParams)
                    .then(() => {
                        const parsedIdToken: NgxMAuthOidcParsedIdToken = {
                            idToken: idToken,
                            idTokenClaims: claims,
                            idTokenClaimsJson: claimsJson,
                            idTokenHeader: header,
                            idTokenHeaderJson: headerJson,
                            idTokenExpiresAt: expiresAtMSec
                        };
                        return parsedIdToken;
                    });
            });
    }

    private storeIdToken(
        idToken: NgxMAuthOidcParsedIdToken) {

        this.storage.setItem('id_token', idToken.idToken);
        this.storage.setItem('id_token_claims_obj', idToken.idTokenClaimsJson);
        this.storage.setItem('id_token_expires_at', '' + idToken.idTokenExpiresAt);
        this.storage.setItem('id_token_stored_at', '' + Date.now());
    }

    private storeAccessTokenResponse(
        accessToken: string,
        refreshToken: string,
        expiresIn: number,
        grantedScopes: string) {

        this.storage.setItem('access_token', accessToken);

        if (grantedScopes) {
            this.storage.setItem('granted_scopes', JSON.stringify(grantedScopes.split('+')));
        }

        this.storage.setItem('access_token_stored_at', '' + Date.now());

        if (expiresIn) {
            const expiresInMilliSeconds = expiresIn * 1000;
            const now = new Date();
            const expiresAt = now.getTime() + expiresInMilliSeconds;
            this.storage.setItem('expires_at', '' + expiresAt);
        }

        if (refreshToken) {
            this.storage.setItem('refresh_token', refreshToken);
        }
    }

    private checkAtHash(
        params: NgxMAuthOidcValidationParams): Promise<boolean> {

        return Promise.resolve(true);
    }

    private chechkSignature(
        params: NgxMAuthOidcValidationParams): Promise<any> {

        return Promise.resolve(null);
    }
}
