import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgxMAuthOidcConfig, NgxMAuthOidcService } from 'ngx-mauth-oidc';

const apiUrl = 'https://localhost:5001';
const appUrl = 'http://localhost:4200';

export function oidcConfig(url: string): NgxMAuthOidcConfig {
    return {
        origin: appUrl,
        issuer: apiUrl + '/',
        loginUrl: apiUrl + '/login',
        redirectUri: appUrl + '/auth',
        responseType: 'code',
        clientId: 'app2',
        dummyClientSecret: '95eaed5e-a3f2-4c51-a574-2d2165a07d73',
        scope: 'openid profile email roles offline_access api-resource-server-A api-resource-server-B'
    };
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(public oidcService: NgxMAuthOidcService) { }

  public ngOnInit(): void {
    this.oidcService.configure(oidcConfig(apiUrl));
    this.oidcService.setStorage(sessionStorage);
    this.oidcService.loadDocumentAndTryLogin({ customHashFragment: '?' })
      .then(d => {
        console.log('loadDocumentAndTryLogin', d);
      });

    this.oidcService.events.subscribe(e => {
      console.log('[app events]', e);

      switch (e.type) {
        case 'token_received': {
          this.oidcService.loadUserProfile()
            .then()
            .catch(error => console.log(error));
          break;
        }
        case 'token_expires': {
          this.oidcService.scope = 'openid profile email roles offline_access api-resource-server-A api-resource-server-B';
          this.oidcService.refreshToken()
            .then(result => console.log(e, result))
            .catch(error => console.log(e, error));
          break;
        }
        case 'token_error':
        case 'token_refresh_error': {
          break;
        }

        case 'logout': {
          break;
        }
      }
    });
  }

  public passwordFlow(): void {
    this.oidcService.fetchTokenUsingPasswordFlow('m.murawski@wasko.pl', '12W@sko3');
  }

  public authorizationCode(): void {
    this.oidcService.initAuthorizationCode({ provider: 'Facebook' });
  }

  get isLoggedIn(): boolean {
    return this.oidcService.hasValidAccessToken();
  }

  get user() {
    return this.oidcService.getIdentityClaims();
  }

  get accessToken() {
    return this.oidcService.getAccessToken();
  }

  get accessTokenExpiration() {
    return this.oidcService.getAccessTokenExpiration();
  }

  public logout(): void {
    this.oidcService.logout();
  }
}
